use crate::error::CmdResult;
use crate::models::{Settings, TorrentFileMeta};
use parking_lot::Mutex;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{from_str, to_string};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct TaskRecord {
    pub id: usize,
    pub info_hash: String,
    pub name: String,
    pub magnet_uri: String,
    pub output_dir: String,
    pub state: String,
    pub only_files: Option<Vec<usize>>,
    pub created_at: i64,
    pub has_metadata: bool,
    pub error: Option<String>,
}

pub struct Store {
    connection: Mutex<Connection>,
}

impl Store {
    pub fn open(path: &Path) -> CmdResult<Self> {
        let connection = Connection::open(path)?;
        connection.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS tasks (
               id INTEGER PRIMARY KEY,
               info_hash TEXT NOT NULL UNIQUE,
               name TEXT,
               magnet_uri TEXT NOT NULL,
               output_dir TEXT NOT NULL,
               state TEXT NOT NULL DEFAULT 'fetching',
               only_files TEXT,
               created_at INTEGER NOT NULL,
               last_active INTEGER,
               has_metadata INTEGER NOT NULL DEFAULT 0,
               error TEXT
             );
             CREATE TABLE IF NOT EXISTS files (
               task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
               file_idx INTEGER NOT NULL,
               path TEXT NOT NULL,
               size INTEGER NOT NULL,
               is_video INTEGER NOT NULL,
               PRIMARY KEY (task_id, file_idx)
             );
             CREATE TABLE IF NOT EXISTS settings (
               key TEXT PRIMARY KEY,
               value TEXT
             );",
        )?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn read_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskRecord> {
        let only_files: Option<String> = row.get(6)?;
        Ok(TaskRecord {
            id: row.get::<_, i64>(0)? as usize,
            info_hash: row.get(1)?,
            name: row
                .get::<_, Option<String>>(2)?
                .unwrap_or_else(|| "未命名任务".into()),
            magnet_uri: row.get(3)?,
            output_dir: row.get(4)?,
            state: row.get(5)?,
            only_files: only_files.and_then(|value| from_str(&value).ok()),
            created_at: row.get(7)?,
            has_metadata: row.get::<_, i64>(8)? != 0,
            error: row.get(9)?,
        })
    }

    const TASK_COLUMNS: &'static str = "id, info_hash, name, magnet_uri, output_dir, state, only_files, created_at, has_metadata, error";

    pub fn create_task(
        &self,
        info_hash: &str,
        name: Option<&str>,
        magnet_uri: &str,
        output_dir: &str,
    ) -> CmdResult<usize> {
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let connection = self.connection.lock();
        connection.execute(
            "INSERT INTO tasks (info_hash, name, magnet_uri, output_dir, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![info_hash, name, magnet_uri, output_dir, created_at],
        )?;
        Ok(connection.last_insert_rowid() as usize)
    }

    pub fn task(&self, id: usize) -> CmdResult<TaskRecord> {
        let connection = self.connection.lock();
        connection
            .query_row(
                &format!("SELECT {} FROM tasks WHERE id = ?1", Self::TASK_COLUMNS),
                [id as i64],
                Self::read_task,
            )
            .optional()?
            .ok_or_else(|| crate::error::ApiError::not_found("任务不存在或已删除"))
    }

    pub fn task_by_hash(&self, info_hash: &str) -> CmdResult<Option<TaskRecord>> {
        let connection = self.connection.lock();
        Ok(connection
            .query_row(
                &format!(
                    "SELECT {} FROM tasks WHERE info_hash = ?1",
                    Self::TASK_COLUMNS
                ),
                [info_hash],
                Self::read_task,
            )
            .optional()?)
    }

    pub fn tasks(&self) -> CmdResult<Vec<TaskRecord>> {
        let connection = self.connection.lock();
        let mut statement = connection.prepare(&format!(
            "SELECT {} FROM tasks ORDER BY created_at DESC",
            Self::TASK_COLUMNS
        ))?;
        let rows = statement
            .query_map([], Self::read_task)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn save_metadata(
        &self,
        id: usize,
        name: &str,
        files: &[TorrentFileMeta],
        only_files: &[usize],
    ) -> CmdResult<()> {
        let mut connection = self.connection.lock();
        let transaction = connection.transaction()?;
        transaction.execute(
            "UPDATE tasks SET name = ?1, has_metadata = 1, state = 'paused', only_files = ?2, error = NULL, last_active = ?3 WHERE id = ?4",
            params![name, to_string(only_files).unwrap_or_default(), chrono_now(), id as i64],
        )?;
        transaction.execute("DELETE FROM files WHERE task_id = ?1", [id as i64])?;
        for file in files {
            transaction.execute(
                "INSERT INTO files (task_id, file_idx, path, size, is_video) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id as i64, file.idx as i64, file.path, file.size as i64, file.is_video as i64],
            )?;
        }
        transaction.commit()?;
        Ok(())
    }

    pub fn files(
        &self,
        id: usize,
        only_files: Option<&[usize]>,
    ) -> CmdResult<Vec<TorrentFileMeta>> {
        let connection = self.connection.lock();
        let mut statement = connection.prepare(
            "SELECT file_idx, path, size, is_video FROM files WHERE task_id = ?1 ORDER BY file_idx",
        )?;
        let rows = statement
            .query_map([id as i64], |row| {
                let idx = row.get::<_, i64>(0)? as usize;
                Ok(TorrentFileMeta {
                    idx,
                    path: row.get(1)?,
                    size: row.get::<_, i64>(2)? as u64,
                    is_video: row.get::<_, i64>(3)? != 0,
                    included: only_files.map(|files| files.contains(&idx)).unwrap_or(true),
                    progress: 0.0,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn confirm_task(&self, id: usize, only_files: &[usize], output_dir: &str) -> CmdResult<()> {
        self.connection.lock().execute(
            "UPDATE tasks SET state = 'downloading', only_files = ?1, output_dir = ?2, error = NULL, last_active = ?3 WHERE id = ?4",
            params![to_string(only_files).unwrap_or_default(), output_dir, chrono_now(), id as i64],
        )?;
        Ok(())
    }

    pub fn set_state(&self, id: usize, state: &str) -> CmdResult<()> {
        self.connection.lock().execute(
            "UPDATE tasks SET state = ?1, error = NULL, last_active = ?2 WHERE id = ?3",
            params![state, chrono_now(), id as i64],
        )?;
        Ok(())
    }

    pub fn set_error(&self, id: usize, message: &str) -> CmdResult<()> {
        self.connection.lock().execute(
            "UPDATE tasks SET state = 'error', error = ?1 WHERE id = ?2",
            params![message, id as i64],
        )?;
        Ok(())
    }

    pub fn remove_task(&self, id: usize) -> CmdResult<()> {
        self.connection
            .lock()
            .execute("DELETE FROM tasks WHERE id = ?1", [id as i64])?;
        Ok(())
    }

    pub fn settings(&self, default_download_dir: &str, stream_port: u16) -> CmdResult<Settings> {
        let connection = self.connection.lock();
        let mut statement = connection.prepare("SELECT key, value FROM settings")?;
        let values = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<std::collections::HashMap<_, _>, _>>()?;
        let value = |key: &str, default: &str| {
            values
                .get(key)
                .cloned()
                .unwrap_or_else(|| default.to_string())
        };
        Ok(Settings {
            download_dir: value("download_dir", default_download_dir),
            theme: value("theme", "system"),
            accent: value("accent", "violet"),
            auto_select: value("auto_select", "videos"),
            download_limit: value("download_limit", "0").parse().unwrap_or(0),
            upload_limit: value("upload_limit", "0").parse().unwrap_or(0),
            stream_port,
        })
    }

    pub fn save_settings(&self, settings: &Settings) -> CmdResult<()> {
        let mut connection = self.connection.lock();
        let transaction = connection.transaction()?;
        let values = [
            ("download_dir", settings.download_dir.clone()),
            ("theme", settings.theme.clone()),
            ("accent", settings.accent.clone()),
            ("auto_select", settings.auto_select.clone()),
            ("download_limit", settings.download_limit.to_string()),
            ("upload_limit", settings.upload_limit.to_string()),
        ];
        for (key, value) in values {
            transaction.execute("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params![key, value])?;
        }
        transaction.commit()?;
        Ok(())
    }
}

fn chrono_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
