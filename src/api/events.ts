import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { isTauri, mockListen } from "./mock";
import type { ApiError, MetadataEvent, TaskSummary } from "./types";

export function onTaskProgress(callback: (task: TaskSummary) => void) {
  return isTauri
    ? listen<TaskSummary>("task:progress", (event) => callback(event.payload))
    : mockListen<TaskSummary>("task:progress", callback);
}

export function onMetadataResolved(callback: (metadata: MetadataEvent) => void) {
  return isTauri
    ? listen<MetadataEvent>("task:metadata-resolved", (event) => callback(event.payload))
    : mockListen<MetadataEvent>("task:metadata-resolved", callback);
}

export function onTaskError(callback: (taskId: number, error: ApiError) => void) {
  return isTauri
    ? listen<{ taskId: number; code: string; message: string }>("task:error", (event) =>
        callback(event.payload.taskId, {
          code: event.payload.code,
          message: event.payload.message,
        }),
      )
    : mockListen<{ taskId: number; code: string; message: string }>("task:error", (payload) =>
        callback(payload.taskId, { code: payload.code, message: payload.message }),
      );
}

export function useTaskEvents(onProgress: (task: TaskSummary) => void) {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void onTaskProgress((task) => {
      if (!disposed) onProgress(task);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onProgress]);
}
