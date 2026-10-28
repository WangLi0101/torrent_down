export type TaskState =
  | "FetchingMetadata"
  | "Connecting"
  | "Downloading"
  | "Seeding"
  | "Paused"
  | "Error";

export interface MagnetInfo {
  infoHash: string;
  name?: string;
  trackers: string[];
  length?: number;
  magnetUri: string;
}

export interface TorrentFileMeta {
  idx: number;
  path: string;
  size: number;
  isVideo: boolean;
  included: boolean;
  progress: number;
}

export interface TaskSummary {
  id: number;
  infoHash: string;
  name: string;
  state: TaskState;
  progress: number;
  downSpeed: number;
  upSpeed: number;
  peers: number;
  eta?: number;
  totalSize: number;
  downloadedBytes: number;
  outputDir: string;
  createdAt: number;
  hasMetadata: boolean;
  error?: string;
}

export interface TaskDetail extends TaskSummary {
  files: TorrentFileMeta[];
  trackers: string[];
  pieceBitmap: string;
  totalPieces: number;
}

export interface MetadataEvent {
  taskId: number;
  name: string;
  files: TorrentFileMeta[];
  totalSize: number;
}

export type ThemeMode = "dark" | "light" | "system";
export type AccentId = "violet" | "ocean" | "forest" | "amber";
export type AutoSelectMode = "videos" | "all" | "none";

export interface Settings {
  downloadDir: string;
  theme: ThemeMode;
  accent: AccentId;
  autoSelect: AutoSelectMode;
  downloadLimit: number;
  uploadLimit: number;
  streamPort: number;
}

export interface ApiError {
  code: string;
  message: string;
}
