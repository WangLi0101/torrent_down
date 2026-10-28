use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MagnetInfo {
    pub info_hash: String,
    pub name: Option<String>,
    pub trackers: Vec<String>,
    pub length: Option<u64>,
    pub magnet_uri: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskState {
    FetchingMetadata,
    Connecting,
    Downloading,
    Seeding,
    Paused,
    Error,
}

impl TaskState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::FetchingMetadata => "fetching",
            Self::Connecting => "connecting",
            Self::Downloading => "downloading",
            Self::Seeding => "seeding",
            Self::Paused => "paused",
            Self::Error => "error",
        }
    }

    pub fn from_stored(value: &str) -> Self {
        match value {
            "connecting" => Self::Connecting,
            "downloading" => Self::Downloading,
            "seeding" => Self::Seeding,
            "paused" => Self::Paused,
            "error" => Self::Error,
            _ => Self::FetchingMetadata,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentFileMeta {
    pub idx: usize,
    pub path: String,
    pub size: u64,
    pub is_video: bool,
    pub included: bool,
    pub progress: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSummary {
    pub id: usize,
    pub info_hash: String,
    pub name: String,
    pub state: TaskState,
    pub progress: f64,
    pub down_speed: u64,
    pub up_speed: u64,
    pub peers: u32,
    pub eta: Option<u64>,
    pub total_size: u64,
    pub downloaded_bytes: u64,
    pub output_dir: String,
    pub created_at: i64,
    pub has_metadata: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDetail {
    #[serde(flatten)]
    pub summary: TaskSummary,
    pub files: Vec<TorrentFileMeta>,
    pub trackers: Vec<String>,
    pub piece_bitmap: String,
    pub total_pieces: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataEvent {
    pub task_id: usize,
    pub name: String,
    pub files: Vec<TorrentFileMeta>,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub download_dir: String,
    pub theme: String,
    pub accent: String,
    pub auto_select: String,
    pub download_limit: u64,
    pub upload_limit: u64,
    pub stream_port: u16,
}
