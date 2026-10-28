import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  FileVideo2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { commands, errorMessage } from "../api/commands";
import type { TaskState, TaskSummary } from "../api/types";
import { formatBytes, formatEta, formatSpeed } from "../lib/format";
import { useSnackbar } from "../hooks/useSnackbar";
import { cn } from "../lib/cn";
import { Button, Card, Dialog, IconButton, ProgressBar } from "./md";

export const stateLabels: Record<TaskState, string> = {
  FetchingMetadata: "获取元数据",
  Connecting: "连接节点",
  Downloading: "下载中",
  Seeding: "已完成",
  Paused: "已暂停",
  Error: "出错",
};

const stateTones: Record<TaskState, string> = {
  FetchingMetadata: "bg-primary/10 text-primary",
  Connecting: "bg-primary/10 text-primary",
  Downloading: "bg-primary/10 text-primary",
  Seeding: "bg-success/12 text-success",
  Paused: "bg-warning/12 text-warning",
  Error: "bg-danger/10 text-danger",
};

const stateDots: Record<TaskState, string> = {
  FetchingMetadata: "bg-primary",
  Connecting: "bg-primary",
  Downloading: "bg-primary",
  Seeding: "bg-success",
  Paused: "bg-warning",
  Error: "bg-danger",
};

export function TaskCard({
  task,
  onChanged,
  compact = false,
}: {
  task: TaskSummary;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const notify = useSnackbar();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);

  const action = async (callback: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await callback();
      notify(message, "success");
      onChanged?.();
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const play = async () => {
    try {
      const detail = await commands.getTaskDetail(task.id);
      const file = detail.files.find((item) => item.isVideo && item.included);
      if (!file) return notify("所选文件中没有可播放的视频", "error");
      void navigate(`/player/${task.id}/${file.idx}`);
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  const statusPulse =
    task.state === "Downloading" ||
    task.state === "FetchingMetadata" ||
    task.state === "Connecting";

  return (
    <Card
      className={cn(
        "group relative rounded-3xl transition-all duration-200 hover:border-line-strong",
        compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5",
      )}
    >
      <div className={cn("flex items-start", compact ? "gap-3" : "gap-3.5")}>
        <button
          type="button"
          onClick={() => navigate(`/tasks/${task.id}`)}
          className={cn(
            "grid shrink-0 cursor-pointer place-items-center rounded-2xl bg-primary/10 text-primary transition-colors hover:bg-primary/15",
            compact ? "size-10" : "size-11",
          )}
          aria-label={`查看 ${task.name} 详情`}
        >
          <FileVideo2 className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="min-w-0 cursor-pointer text-left"
            >
              <h3
                className={cn(
                  "truncate text-body font-medium text-ink transition-colors group-hover:text-primary",
                )}
              >
                {task.name}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption tabular-nums text-ink-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium",
                    stateTones[task.state],
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      stateDots[task.state],
                      statusPulse && "animate-pulse-dot",
                    )}
                  />
                  {stateLabels[task.state]}
                </span>
                <span className="text-ink-3/60">·</span>
                <span>{formatBytes(task.totalSize)}</span>
                {!compact && task.state === "Downloading" && (
                  <>
                    <span className="text-ink-3/60">·</span>
                    <span>{task.peers} 个节点</span>
                  </>
                )}
              </div>
            </button>

            {compact ? (
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            ) : (
              <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                <IconButton
                  label={task.state === "Paused" ? "继续下载" : "暂停下载"}
                  disabled={
                    busy ||
                    task.state === "FetchingMetadata" ||
                    task.state === "Seeding"
                  }
                  onClick={() =>
                    void action(
                      () =>
                        task.state === "Paused"
                          ? commands.resumeTask(task.id)
                          : commands.pauseTask(task.id),
                      task.state === "Paused" ? "任务已继续" : "任务已暂停",
                    )
                  }
                >
                  {task.state === "Paused" ? (
                    <RotateCcw size={17} />
                  ) : (
                    <Pause size={17} />
                  )}
                </IconButton>
                <IconButton
                  label="删除任务"
                  disabled={busy}
                  onClick={() => {
                    setDeleteFiles(false);
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2 size={17} />
                </IconButton>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={task.progress} className="flex-1" />
            <span className="w-9 text-right text-caption font-semibold tabular-nums text-ink-2">
              {Math.floor(task.progress * 100)}%
            </span>
          </div>

          <div className="mt-2 flex min-h-6 items-center justify-between gap-3 text-caption tabular-nums text-ink-3">
            <span className="truncate">
              {task.state === "Downloading"
                ? `${formatSpeed(task.downSpeed)} · 剩余 ${formatEta(task.eta)}`
                : `${formatBytes(task.downloadedBytes)} 已下载`}
            </span>
            {!compact &&
              task.hasMetadata && (
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => void play()}
                  className="-mr-2 h-7 px-2.5 text-caption"
                >
                  <Play size={13} fill="currentColor" />
                  播放
                </Button>
              )}
          </div>
        </div>
      </div>

      <Dialog
        open={confirmDelete}
        dismissible={!busy}
        onClose={() => setConfirmDelete(false)}
        title="删除这个任务？"
        description={
          deleteFiles
            ? "任务记录和已下载文件都会被删除，此操作无法撤销。"
            : "仅移除任务记录，已下载文件会保留在磁盘中。"
        }
      >
        <p className="mb-4 break-words rounded-xl bg-primary/8 px-3 py-2.5 text-body-sm font-medium text-ink">
          {task.name}
        </p>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-1/60 p-3 text-body-sm text-ink">
          <input
            type="checkbox"
            checked={deleteFiles}
            disabled={busy}
            onChange={(event) => setDeleteFiles(event.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          同时删除已下载文件
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="text" disabled={busy} onClick={() => setConfirmDelete(false)}>
            取消
          </Button>
          <Button
            variant="outlined"
            className="text-danger"
            disabled={busy}
            loading={busy}
            onClick={() =>
              void action(async () => {
                await commands.removeTask(task.id, deleteFiles);
                setConfirmDelete(false);
              }, "任务已删除")
            }
          >
            {!busy && <Trash2 size={15} />}
            {busy ? "正在删除" : "确认删除"}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
