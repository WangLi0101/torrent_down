use crate::commands::magnet::parse_magnet_input;
use crate::error::{ApiError, CmdResult};
use crate::models::{MetadataEvent, Settings, TaskDetail, TaskState, TaskSummary, TorrentFileMeta};
use crate::store::{Store, TaskRecord};
use base64::Engine as Base64Engine;
use librqbit::api::TorrentIdOrHash;
use librqbit::http_api::{HttpApi, HttpApiOptions};
use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, Api, ListenerMode, ListenerOptions, Session,
    SessionOptions, SessionPersistenceConfig, TorrentStatsState,
};
use librqbit_dualstack_sockets::{BindOpts, TcpListener};
use std::net::{Ipv4Addr, SocketAddr};
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub struct Engine {
    pub session: Arc<Session>,
    pub api: Api,
    pub store: Arc<Store>,
    pub app: AppHandle,
    pub stream_port: u16,
    default_download_dir: String,
}

impl Engine {
    pub async fn new(
        app: AppHandle,
        store: Arc<Store>,
        default_download_dir: PathBuf,
        data_dir: PathBuf,
    ) -> CmdResult<Arc<Self>> {
        let session = Session::new_with_opts(
            default_download_dir.clone(),
            SessionOptions {
                fastresume: true,
                persistence: Some(SessionPersistenceConfig::Json {
                    folder: Some(data_dir.join("session")),
                }),
                listen: Some(ListenerOptions {
                    mode: ListenerMode::TcpAndUtp,
                    enable_upnp_port_forwarding: true,
                    ..Default::default()
                }),
                ..Default::default()
            },
        )
        .await?;
        let api = Api::new(session.clone(), None, None);
        let listener = TcpListener::bind_tcp(
            SocketAddr::from((Ipv4Addr::LOCALHOST, 0)),
            BindOpts {
                request_dualstack: false,
                reuseport: false,
                device: None,
            },
        )
        .map_err(ApiError::internal)?;
        let stream_port = listener.bind_addr().port();
        let http_api = HttpApi::new(
            api.clone(),
            Some(HttpApiOptions {
                read_only: true,
                ..Default::default()
            }),
        );
        tauri::async_runtime::spawn(async move {
            if let Err(error) = http_api.make_http_api_and_run(listener, None).await {
                tracing::error!(%error, "local streaming server stopped");
            }
        });
        let engine = Arc::new(Self {
            session,
            api,
            store,
            app,
            stream_port,
            default_download_dir: default_download_dir.to_string_lossy().into_owned(),
        });
        let settings = engine.get_settings()?;
        engine.set_speed_limit(Some(settings.download_limit), Some(settings.upload_limit))?;
        Ok(engine)
    }

    pub fn restore_incomplete(self: &Arc<Self>) {
        let Ok(tasks) = self.store.tasks() else {
            return;
        };
        for task in tasks {
            if task.has_metadata || self.session.get(TorrentIdOrHash::Id(task.id)).is_some() {
                continue;
            }
            let engine = self.clone();
            tauri::async_runtime::spawn(async move {
                engine.resolve_metadata(task.id).await;
            });
        }
    }

    pub fn get_settings(&self) -> CmdResult<Settings> {
        self.store
            .settings(&self.default_download_dir, self.stream_port)
    }

    pub fn set_settings(&self, settings: Settings) -> CmdResult<()> {
        if !matches!(settings.theme.as_str(), "dark" | "light" | "system") {
            return Err(ApiError::invalid("无效的主题设置"));
        }
        if !matches!(
            settings.accent.as_str(),
            "violet" | "ocean" | "forest" | "amber"
        ) {
            return Err(ApiError::invalid("无效的强调色设置"));
        }
        if !matches!(settings.auto_select.as_str(), "videos" | "all" | "none") {
            return Err(ApiError::invalid("无效的文件选择策略"));
        }
        if settings.download_dir.trim().is_empty() {
            return Err(ApiError::invalid("下载目录不能为空"));
        }
        self.store.save_settings(&settings)?;
        self.set_speed_limit(Some(settings.download_limit), Some(settings.upload_limit))
    }

    pub fn set_speed_limit(&self, down: Option<u64>, up: Option<u64>) -> CmdResult<()> {
        let to_nonzero = |value: Option<u64>| {
            NonZeroU32::new(u32::try_from(value.unwrap_or(0)).unwrap_or(u32::MAX))
        };
        self.session.ratelimits.set_download_bps(to_nonzero(down));
        self.session.ratelimits.set_upload_bps(to_nonzero(up));
        Ok(())
    }

    pub async fn add_task(self: &Arc<Self>, magnet: String) -> CmdResult<usize> {
        let parsed = parse_magnet_input(&magnet)?;
        if let Some(existing) = self.store.task_by_hash(&parsed.info_hash)? {
            return Ok(existing.id);
        }
        let output_dir = self.get_settings()?.download_dir;
        let id = self.store.create_task(
            &parsed.info_hash,
            parsed.name.as_deref(),
            &parsed.magnet_uri,
            &output_dir,
        )?;
        let engine = self.clone();
        tauri::async_runtime::spawn(async move {
            engine.resolve_metadata(id).await;
        });
        Ok(id)
    }

    async fn resolve_metadata(self: Arc<Self>, id: usize) {
        let record = match self.store.task(id) {
            Ok(record) => record,
            Err(_) => return,
        };
        let options = AddTorrentOptions {
            list_only: true,
            output_folder: Some(record.output_dir.clone()),
            ..Default::default()
        };
        let result = tokio::time::timeout(
            Duration::from_secs(180),
            self.session.add_torrent(
                AddTorrent::from_url(record.magnet_uri.clone()),
                Some(options),
            ),
        )
        .await;
        let response = match result {
            Ok(Ok(AddTorrentResponse::ListOnly(response))) => response,
            Ok(Ok(_)) => {
                self.fail_task(id, "元数据请求返回了意外结果").await;
                return;
            }
            Ok(Err(error)) => {
                self.fail_task(id, &format!("无法获取元数据：{error:#}"))
                    .await;
                return;
            }
            Err(_) => {
                self.fail_task(
                    id,
                    "获取元数据超时，请检查网络或尝试包含更多 Tracker 的链接",
                )
                .await;
                return;
            }
        };
        let files = response
            .info
            .iter_file_details()
            .enumerate()
            .map(|(idx, file)| {
                let path = file.filename.to_string();
                TorrentFileMeta {
                    idx,
                    is_video: is_video_file(&path),
                    path,
                    size: file.len,
                    included: false,
                    progress: 0.0,
                }
            })
            .collect::<Vec<_>>();
        let settings = match self.get_settings() {
            Ok(settings) => settings,
            Err(error) => {
                self.fail_task(id, &error.message).await;
                return;
            }
        };
        let selected = files
            .iter()
            .filter(|file| match settings.auto_select.as_str() {
                "all" => true,
                "none" => false,
                _ => file.is_video,
            })
            .map(|file| file.idx)
            .collect::<Vec<_>>();
        let files = files
            .into_iter()
            .map(|file| TorrentFileMeta {
                included: selected.contains(&file.idx),
                ..file
            })
            .collect::<Vec<_>>();
        let name = response
            .info
            .name()
            .map(|name| name.into_owned())
            .unwrap_or(record.name);
        if let Err(error) = self.store.save_metadata(id, &name, &files, &selected) {
            self.fail_task(id, &error.message).await;
            return;
        }
        let options = AddTorrentOptions {
            paused: true,
            only_files: Some(selected.clone()),
            output_folder: Some(record.output_dir),
            overwrite: true,
            preferred_id: Some(id),
            ..Default::default()
        };
        let added = self
            .session
            .add_torrent(
                AddTorrent::from_bytes(response.torrent_bytes),
                Some(options),
            )
            .await;
        match added {
            Ok(AddTorrentResponse::Added(_, _)) | Ok(AddTorrentResponse::AlreadyManaged(_, _)) => {
                let total_size = files
                    .iter()
                    .filter(|file| file.included)
                    .map(|file| file.size)
                    .sum();
                let _ = self.app.emit(
                    "task:metadata-resolved",
                    MetadataEvent {
                        task_id: id,
                        name,
                        files,
                        total_size,
                    },
                );
                self.emit_progress(id);
            }
            Ok(AddTorrentResponse::ListOnly(_)) => self.fail_task(id, "无法初始化下载任务").await,
            Err(error) => {
                self.fail_task(id, &format!("无法初始化下载任务：{error:#}"))
                    .await
            }
        }
    }

    async fn fail_task(&self, id: usize, message: &str) {
        let _ = self.store.set_error(id, message);
        let _ = self.app.emit(
            "task:error",
            serde_json::json!({
                "taskId": id,
                "code": "MetadataError",
                "message": message,
            }),
        );
        self.emit_progress(id);
    }

    pub async fn confirm_task(
        &self,
        id: usize,
        only_files: Vec<usize>,
        output_dir: String,
    ) -> CmdResult<()> {
        if only_files.is_empty() {
            return Err(ApiError::invalid("请至少选择一个文件"));
        }
        if output_dir.trim().is_empty() {
            return Err(ApiError::invalid("请选择下载目录"));
        }
        let record = self.store.task(id)?;
        let files = self.store.files(id, record.only_files.as_deref())?;
        if only_files.iter().any(|index| *index >= files.len()) {
            return Err(ApiError::invalid("所选文件索引无效"));
        }
        tokio::fs::create_dir_all(&output_dir).await?;
        let handle = self.handle(id)?;
        let torrent_bytes = handle.with_metadata(|metadata| metadata.torrent_bytes.clone())?;
        self.session.delete(TorrentIdOrHash::Id(id), false).await?;
        let options = AddTorrentOptions {
            paused: false,
            only_files: Some(only_files.clone()),
            output_folder: Some(output_dir.clone()),
            overwrite: true,
            preferred_id: Some(id),
            ..Default::default()
        };
        match self
            .session
            .add_torrent(AddTorrent::from_bytes(torrent_bytes), Some(options))
            .await?
        {
            AddTorrentResponse::Added(_, _) | AddTorrentResponse::AlreadyManaged(_, _) => {}
            AddTorrentResponse::ListOnly(_) => {
                return Err(ApiError::internal("下载任务初始化失败"))
            }
        }
        self.store.confirm_task(id, &only_files, &output_dir)?;
        self.emit_progress(id);
        Ok(())
    }

    pub async fn pause_task(&self, id: usize) -> CmdResult<()> {
        let handle = self.handle(id)?;
        self.session.pause(&handle).await?;
        self.store.set_state(id, TaskState::Paused.as_str())?;
        self.emit_progress(id);
        Ok(())
    }

    pub async fn resume_task(&self, id: usize) -> CmdResult<()> {
        let handle = self.handle(id)?;
        self.session.unpause(&handle).await?;
        self.store.set_state(id, TaskState::Downloading.as_str())?;
        self.emit_progress(id);
        Ok(())
    }

    pub async fn remove_task(&self, id: usize, delete_files: bool) -> CmdResult<()> {
        self.store.task(id)?;
        if self.session.get(TorrentIdOrHash::Id(id)).is_some() {
            self.session
                .delete(TorrentIdOrHash::Id(id), delete_files)
                .await?;
        }
        self.store.remove_task(id)?;
        Ok(())
    }

    pub fn stream_url(&self, id: usize, file_idx: usize) -> CmdResult<String> {
        let record = self.store.task(id)?;
        let files = self.store.files(id, record.only_files.as_deref())?;
        let file = files
            .get(file_idx)
            .ok_or_else(|| ApiError::not_found("文件不存在"))?;
        if !file.is_video {
            return Err(ApiError::invalid("所选文件不是支持播放的视频"));
        }
        self.handle(id)?;
        Ok(format!(
            "http://127.0.0.1:{}/torrents/{}/stream/{}",
            self.stream_port, record.info_hash, file_idx
        ))
    }

    pub fn list_tasks(&self) -> CmdResult<Vec<TaskSummary>> {
        Ok(self
            .store
            .tasks()?
            .iter()
            .map(|record| self.summary(record))
            .collect())
    }

    pub fn task_detail(&self, id: usize) -> CmdResult<TaskDetail> {
        let record = self.store.task(id)?;
        let handle = self.session.get(TorrentIdOrHash::Id(id));
        let only_files = handle
            .as_ref()
            .and_then(|handle| handle.only_files())
            .or_else(|| record.only_files.clone());
        let stats = handle.as_ref().map(|handle| handle.stats());
        let mut files = self.store.files(id, only_files.as_deref())?;
        if let Some(stats) = &stats {
            for file in &mut files {
                let progress = stats.file_progress.get(file.idx).copied().unwrap_or(0);
                file.progress = if file.size > 0 {
                    (progress as f64 / file.size as f64).min(1.0)
                } else {
                    1.0
                };
            }
        }
        let total_pieces = handle
            .as_ref()
            .and_then(|handle| {
                handle
                    .with_metadata(|metadata| metadata.info.lengths().total_pieces())
                    .ok()
            })
            .unwrap_or(0);
        let piece_bitmap = self
            .api
            .api_dump_haves(TorrentIdOrHash::Id(id))
            .map(|(bitmap, _)| {
                base64::engine::general_purpose::STANDARD.encode(bitmap.into_bitvec().into_vec())
            })
            .unwrap_or_default();
        let trackers = parse_magnet_input(&record.magnet_uri)
            .map(|magnet| magnet.trackers)
            .unwrap_or_default();
        Ok(TaskDetail {
            summary: self.summary(&record),
            files,
            trackers,
            piece_bitmap,
            total_pieces,
        })
    }

    fn handle(&self, id: usize) -> CmdResult<Arc<librqbit::ManagedTorrent>> {
        self.session
            .get(TorrentIdOrHash::Id(id))
            .ok_or_else(|| ApiError::not_found("下载引擎中找不到该任务，请重启应用后重试"))
    }

    fn summary(&self, record: &TaskRecord) -> TaskSummary {
        let handle = self.session.get(TorrentIdOrHash::Id(record.id));
        let stats = handle.as_ref().map(|handle| handle.stats());
        let has_metadata = record.has_metadata
            || handle
                .as_ref()
                .is_some_and(|handle| handle.metadata.load().is_some());
        let name = handle
            .as_ref()
            .and_then(|handle| handle.name())
            .unwrap_or_else(|| record.name.clone());
        let total_size = stats
            .as_ref()
            .map(|stats| stats.total_bytes)
            .filter(|size| *size > 0)
            .unwrap_or_else(|| {
                self.store
                    .files(record.id, record.only_files.as_deref())
                    .unwrap_or_default()
                    .iter()
                    .filter(|file| file.included)
                    .map(|file| file.size)
                    .sum()
            });
        let downloaded_bytes = stats
            .as_ref()
            .map(|stats| stats.progress_bytes)
            .unwrap_or(0);
        let down_speed = stats
            .as_ref()
            .and_then(|stats| stats.live.as_ref())
            .map(|live| live.download_speed.as_bytes())
            .unwrap_or(0);
        let up_speed = stats
            .as_ref()
            .and_then(|stats| stats.live.as_ref())
            .map(|live| live.upload_speed.as_bytes())
            .unwrap_or(0);
        let peers = stats
            .as_ref()
            .and_then(|stats| stats.live.as_ref())
            .map(|live| live.snapshot.peer_stats.live)
            .unwrap_or(0);
        let state = if record.error.is_some()
            || stats.as_ref().is_some_and(|stats| stats.error.is_some())
        {
            TaskState::Error
        } else if let Some(stats) = &stats {
            match stats.state {
                TorrentStatsState::Paused => TaskState::Paused,
                TorrentStatsState::Error => TaskState::Error,
                TorrentStatsState::Initializing { .. } => {
                    if has_metadata {
                        TaskState::Connecting
                    } else {
                        TaskState::FetchingMetadata
                    }
                }
                TorrentStatsState::Live => {
                    if stats.finished {
                        TaskState::Seeding
                    } else {
                        TaskState::Downloading
                    }
                }
            }
        } else {
            TaskState::from_stored(&record.state)
        };
        let eta = if down_speed > 0 && total_size > downloaded_bytes {
            Some((total_size - downloaded_bytes) / down_speed)
        } else {
            None
        };
        TaskSummary {
            id: record.id,
            info_hash: record.info_hash.clone(),
            name,
            state,
            progress: if total_size > 0 {
                (downloaded_bytes as f64 / total_size as f64).min(1.0)
            } else {
                0.0
            },
            down_speed,
            up_speed,
            peers,
            eta,
            total_size,
            downloaded_bytes,
            output_dir: record.output_dir.clone(),
            created_at: record.created_at,
            has_metadata,
            error: stats
                .and_then(|stats| stats.error)
                .or_else(|| record.error.clone()),
        }
    }

    pub fn emit_progress(&self, id: usize) {
        if let Ok(record) = self.store.task(id) {
            let _ = self.app.emit("task:progress", self.summary(&record));
        }
    }
}

pub fn is_video_file(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "mp4" | "mkv" | "webm" | "avi" | "mov" | "flv" | "ts" | "m4v" | "wmv"
            )
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::is_video_file;

    #[test]
    fn recognizes_video_extensions_case_insensitively() {
        assert!(is_video_file("folder/Movie.MKV"));
        assert!(is_video_file("clip.webm"));
        assert!(!is_video_file("notes.txt"));
    }
}
