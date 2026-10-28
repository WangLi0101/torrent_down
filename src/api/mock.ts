import type {
  AutoSelectMode,
  MagnetInfo,
  MetadataEvent,
  Settings,
  TaskDetail,
  TaskSummary,
  TorrentFileMeta,
} from "./types";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const videoFiles: TorrentFileMeta[] = [
  { idx: 0, path: "Big Buck Bunny/Big Buck Bunny.mp4", size: 1_482_000_000, isVideo: true, included: true, progress: 0 },
  { idx: 1, path: "Big Buck Bunny/Behind the scenes.mp4", size: 284_000_000, isVideo: true, included: true, progress: 0 },
  { idx: 2, path: "Big Buck Bunny/Artwork.jpg", size: 4_200_000, isVideo: false, included: false, progress: 0 },
  { idx: 3, path: "Big Buck Bunny/Readme.txt", size: 12_400, isVideo: false, included: false, progress: 0 },
];

const now = Date.now();
const tasks: TaskDetail[] = [
  {
    id: 1,
    infoHash: "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    name: "Big Buck Bunny • 4K",
    state: "Downloading",
    progress: 0.684,
    downSpeed: 8_400_000,
    upSpeed: 720_000,
    peers: 24,
    eta: 312,
    totalSize: 1_766_000_000,
    downloadedBytes: 1_208_000_000,
    outputDir: "~/Downloads/TorrNet",
    createdAt: now - 1000 * 60 * 38,
    hasMetadata: true,
    files: videoFiles.map((file, index) => ({ ...file, progress: index === 0 ? 0.76 : index === 1 ? 0.31 : 0 })),
    trackers: ["udp://tracker.opentrackr.org:1337", "udp://exodus.desync.com:6969"],
    pieceBitmap: "",
    totalPieces: 286,
  },
  {
    id: 2,
    infoHash: "08ada5a7a6183aae1e09d831df6748d566095a10",
    name: "Sintel • 1080p",
    state: "Paused",
    progress: 0.421,
    downSpeed: 0,
    upSpeed: 0,
    peers: 0,
    totalSize: 946_000_000,
    downloadedBytes: 398_000_000,
    outputDir: "~/Downloads/TorrNet",
    createdAt: now - 1000 * 60 * 60 * 25,
    hasMetadata: true,
    files: [{ idx: 0, path: "Sintel.mp4", size: 946_000_000, isVideo: true, included: true, progress: 0.421 }],
    trackers: [],
    pieceBitmap: "",
    totalPieces: 182,
  },
  {
    id: 3,
    infoHash: "209c8226b299a0b8384f6e95c9a0e19c9e5909a7",
    name: "Tears of Steel",
    state: "Seeding",
    progress: 1,
    downSpeed: 0,
    upSpeed: 384_000,
    peers: 7,
    totalSize: 2_140_000_000,
    downloadedBytes: 2_140_000_000,
    outputDir: "~/Downloads/TorrNet",
    createdAt: now - 1000 * 60 * 60 * 74,
    hasMetadata: true,
    files: [{ idx: 0, path: "Tears of Steel.webm", size: 2_140_000_000, isVideo: true, included: true, progress: 1 }],
    trackers: [],
    pieceBitmap: "",
    totalPieces: 410,
  },
];

const listeners = new Map<string, Set<(payload: unknown) => void>>();
const emit = <T,>(event: string, payload: T) => {
  listeners.get(event)?.forEach((listener) => listener(payload));
};

export function mockListen<T>(event: string, callback: (payload: T) => void): Promise<() => void> {
  const set = listeners.get(event) ?? new Set();
  set.add(callback as (payload: unknown) => void);
  listeners.set(event, set);
  return Promise.resolve(() => set.delete(callback as (payload: unknown) => void));
}

if (!isTauri) {
  window.setInterval(() => {
    tasks.forEach((task) => {
      if (task.state !== "Downloading") return;
      task.progress = Math.min(1, task.progress + 0.00035);
      task.downloadedBytes = Math.floor(task.totalSize * task.progress);
      task.files = task.files.map((file) => ({
        ...file,
        progress: file.included ? Math.min(1, file.progress + 0.0004) : 0,
      }));
      if (task.progress === 1) {
        task.state = "Seeding";
        task.downSpeed = 0;
      }
      emit<TaskSummary>("task:progress", { ...task });
    });
  }, 1200);
}

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const clone = <T,>(value: T): T => structuredClone(value);
const requiredTask = (id: number) => {
  const task = tasks.find((item) => item.id === id);
  if (!task) throw new Error("任务不存在或已删除");
  return task;
};

let settings: Settings = {
  downloadDir: "~/Downloads/TorrNet",
  theme: "system",
  accent: "violet",
  autoSelect: "videos",
  downloadLimit: 0,
  uploadLimit: 0,
  streamPort: 0,
};

try {
  const stored = localStorage.getItem("torrnet-settings");
  if (stored) settings = { ...settings, ...JSON.parse(stored) } as Settings;
} catch {
  // Ignore unavailable browser storage.
}

export const mockApi = {
  async parseMagnet(text: string): Promise<MagnetInfo> {
    await delay(280);
    const magnet = text.match(/magnet:\?[^\s]+/i)?.[0];
    const raw = magnet ?? text.trim();
    if (/^[a-fA-F0-9]{40}$/.test(raw)) {
      return { infoHash: raw.toLowerCase(), trackers: [], magnetUri: `magnet:?xt=urn:btih:${raw}` };
    }
    const url = new URL(raw);
    const xt = url.searchParams.get("xt");
    const hash = xt?.match(/urn:btih:([a-zA-Z0-9]+)/)?.[1];
    if (!hash || !/^([a-fA-F0-9]{40}|[A-Z2-7a-z2-7]{32})$/.test(hash)) {
      throw new Error("请输入有效的磁力链接或 40 位 info-hash");
    }
    return {
      infoHash: hash.toLowerCase(),
      name: url.searchParams.get("dn") ?? undefined,
      trackers: url.searchParams.getAll("tr"),
      length: Number(url.searchParams.get("xl")) || undefined,
      magnetUri: raw,
    };
  },
  async addTask(magnet: string) {
    await delay(1100);
    const parsed = await this.parseMagnet(magnet);
    const existing = tasks.find((task) => task.infoHash === parsed.infoHash);
    if (existing) return { taskId: existing.id };
    const id = Math.max(0, ...tasks.map((task) => task.id)) + 1;
    const files = clone(videoFiles).map((file) => ({ ...file, progress: 0 }));
    const task: TaskDetail = {
      id,
      infoHash: parsed.infoHash,
      name: parsed.name ?? "新添加的磁力任务",
      state: "Paused",
      progress: 0,
      downSpeed: 0,
      upSpeed: 0,
      peers: 0,
      totalSize: files.filter((file) => file.included).reduce((sum, file) => sum + file.size, 0),
      downloadedBytes: 0,
      outputDir: settings.downloadDir,
      createdAt: Date.now(),
      hasMetadata: true,
      files,
      trackers: parsed.trackers,
      pieceBitmap: "",
      totalPieces: 286,
    };
    tasks.unshift(task);
    emit<MetadataEvent>("task:metadata-resolved", {
      taskId: id,
      name: task.name,
      files: task.files,
      totalSize: task.totalSize,
    });
    return { taskId: id };
  },
  async confirmTask(taskId: number, onlyFiles: number[], outputDir: string) {
    await delay(450);
    const task = requiredTask(taskId);
    task.files = task.files.map((file) => ({ ...file, included: onlyFiles.includes(file.idx) }));
    task.totalSize = task.files.filter((file) => file.included).reduce((sum, file) => sum + file.size, 0);
    task.outputDir = outputDir;
    task.state = "Downloading";
    task.downSpeed = 6_200_000;
    task.peers = 12;
    emit("task:progress", { ...task });
  },
  async listTasks() {
    await delay(180);
    return clone(tasks);
  },
  async getTaskDetail(taskId: number) {
    await delay(120);
    return clone(requiredTask(taskId));
  },
  async pauseTask(taskId: number) {
    const task = requiredTask(taskId);
    task.state = "Paused";
    task.downSpeed = 0;
    task.upSpeed = 0;
    task.peers = 0;
    emit("task:progress", { ...task });
  },
  async resumeTask(taskId: number) {
    const task = requiredTask(taskId);
    task.state = "Downloading";
    task.downSpeed = 5_800_000;
    task.peers = 11;
    emit("task:progress", { ...task });
  },
  async removeTask(taskId: number) {
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index >= 0) tasks.splice(index, 1);
  },
  async getStreamUrl() {
    return "";
  },
  async setSpeedLimit(down?: number, up?: number) {
    if (down !== undefined) settings.downloadLimit = down;
    if (up !== undefined) settings.uploadLimit = up;
  },
  async getSettings() {
    return clone(settings);
  },
  async setSettings(next: Settings) {
    settings = clone(next);
    try {
      localStorage.setItem("torrnet-settings", JSON.stringify(settings));
    } catch {
      // Ignore unavailable browser storage.
    }
  },
  async selectFiles(taskId: number, mode: AutoSelectMode) {
    const task = requiredTask(taskId);
    task.files = task.files.map((file) => ({
      ...file,
      included: mode === "all" || (mode === "videos" && file.isVideo),
    }));
  },
};
