import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauri, mockApi } from "./mock";
import type { MagnetInfo, Settings, TaskDetail, TaskSummary } from "./types";

const call = <T,>(command: string, args?: Record<string, unknown>): Promise<T> =>
  isTauri ? invoke<T>(command, args) : Promise.reject(new Error(`Missing mock: ${command}`));

export const commands = {
  openSearchSite: (siteId: string): Promise<void> =>
    isTauri
      ? call("open_search_site", { siteId })
      : Promise.reject(new Error("请在桌面应用中使用 WebView 访问搜索站点")),
  parseMagnet: (text: string): Promise<MagnetInfo> =>
    isTauri ? call("parse_magnet", { text }) : mockApi.parseMagnet(text),
  addTask: (magnet: string): Promise<{ taskId: number }> =>
    isTauri ? call("add_task", { magnet }) : mockApi.addTask(magnet),
  confirmTask: (taskId: number, onlyFiles: number[], outputDir: string): Promise<void> =>
    isTauri ? call("confirm_task", { taskId, onlyFiles, outputDir }) : mockApi.confirmTask(taskId, onlyFiles, outputDir),
  listTasks: (): Promise<TaskSummary[]> => (isTauri ? call("list_tasks") : mockApi.listTasks()),
  getTaskDetail: (taskId: number): Promise<TaskDetail> =>
    isTauri ? call("get_task_detail", { taskId }) : mockApi.getTaskDetail(taskId),
  pauseTask: (taskId: number): Promise<void> =>
    isTauri ? call("pause_task", { taskId }) : mockApi.pauseTask(taskId),
  resumeTask: (taskId: number): Promise<void> =>
    isTauri ? call("resume_task", { taskId }) : mockApi.resumeTask(taskId),
  removeTask: (taskId: number, deleteFiles: boolean): Promise<void> =>
    isTauri ? call("remove_task", { taskId, deleteFiles }) : mockApi.removeTask(taskId),
  getStreamUrl: (taskId: number, fileIdx: number): Promise<string> =>
    isTauri ? call("get_stream_url", { taskId, fileIdx }) : mockApi.getStreamUrl(),
  setSpeedLimit: (down?: number, up?: number): Promise<void> =>
    isTauri ? call("set_speed_limit", { down, up }) : mockApi.setSpeedLimit(down, up),
  getSettings: (): Promise<Settings> => (isTauri ? call("get_settings") : mockApi.getSettings()),
  setSettings: (settings: Settings): Promise<void> =>
    isTauri ? call("set_settings", { settings }) : mockApi.setSettings(settings),
};

export async function selectDirectory() {
  if (!isTauri) return "~/Downloads/TorrNet";
  return open({ directory: true, multiple: false, title: "选择下载目录" });
}

export function errorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return "操作未完成，请稍后重试";
}
