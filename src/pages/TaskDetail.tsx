import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock3,
  Download,
  FolderOpen,
  Gauge,
  Globe2,
  HardDrive,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Users,
} from "lucide-react";
import { commands, errorMessage } from "../api/commands";
import { useTaskEvents } from "../api/events";
import type { TaskDetail as TaskDetailType, TaskSummary } from "../api/types";
import { FileList } from "../components/FileList";
import { PieceMap } from "../components/PieceMap";
import { stateLabels } from "../components/TaskCard";
import {
  Button,
  Card,
  Chip,
  ProgressBar,
  SectionCard,
  Spinner,
} from "../components/md";
import { formatBytes, formatEta, formatSpeed } from "../lib/format";
import { useSnackbar } from "../hooks/useSnackbar";

export default function TaskDetail() {
  const { id } = useParams();
  const taskId = Number(id);
  const navigate = useNavigate();
  const notify = useSnackbar();
  const [detail, setDetail] = useState<TaskDetailType>();

  const load = useCallback(() => {
    void commands
      .getTaskDetail(taskId)
      .then(setDetail)
      .catch((error) => notify(errorMessage(error), "error"));
  }, [taskId, notify]);
  useEffect(load, [load]);

  const onProgress = useCallback(
    (task: TaskSummary) => {
      if (task.id !== taskId) return;
      setDetail((current) => (current ? { ...current, ...task } : current));
      if (Math.random() < 0.2)
        void commands.getTaskDetail(taskId).then(setDetail);
    },
    [taskId],
  );
  useTaskEvents(onProgress);

  if (!detail)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={30} />
      </div>
    );

  const video = detail.files.find((file) => file.isVideo && file.included);
  const stateTone =
    detail.state === "Error"
      ? "error"
      : detail.state === "Seeding"
        ? "success"
        : detail.state === "Paused"
          ? "warning"
          : "primary";

  const stats = [
    {
      icon: Download,
      label: "下载速度",
      value: formatSpeed(detail.downSpeed),
      note: `${formatBytes(detail.downloadedBytes)} 已下载`,
      tone: "primary" as const,
    },
    {
      icon: Users,
      label: "已连接节点",
      value: detail.peers.toLocaleString(),
      note: `${detail.trackers.length} 个 Tracker`,
      tone: "secondary" as const,
    },
    {
      icon: Clock3,
      label: "预计剩余",
      value: formatEta(detail.eta),
      note: stateLabels[detail.state],
      tone: "neutral" as const,
    },
    {
      icon: HardDrive,
      label: "文件大小",
      value: formatBytes(detail.totalSize),
      note: `${detail.files.filter((file) => file.included).length} 个所选文件`,
      tone: "success" as const,
    },
  ];

  const toggle = async () => {
    try {
      if (detail.state === "Paused") await commands.resumeTask(taskId);
      else await commands.pauseTask(taskId);
      load();
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/tasks")}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-1 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          返回任务列表
        </button>
      </div>

      <Card className="relative overflow-hidden">
        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={stateTone}>{stateLabels[detail.state]}</Chip>
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-3">
                  {detail.infoHash.slice(0, 16)}…
                </span>
              </div>
              <h2 className="mt-3 text-balance text-[22px] font-semibold leading-snug tracking-[-0.02em] text-ink sm:text-[28px]">
                {detail.name}
              </h2>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3">
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{detail.outputDir}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outlined"
                disabled={detail.state === "Seeding"}
                onClick={() => void toggle()}
              >
                {detail.state === "Paused" ? (
                  <RotateCcw size={16} />
                ) : (
                  <Pause size={16} />
                )}
                {detail.state === "Paused" ? "继续" : "暂停"}
              </Button>
              <Button disabled={!video} onClick={() => video && navigate(`/player/${taskId}/${video.idx}`)}>
                <Play size={16} fill="currentColor" />
                立即播放
              </Button>
            </div>
          </div>

          <div className="relative mt-7">
            <div className="mb-2.5 flex items-end justify-between gap-3">
              <div>
                <span className="text-[12px] text-ink-2">整体进度</span>
                <p className="mt-0.5 text-[12px] text-ink-3">
                  {formatBytes(detail.downloadedBytes)} / {formatBytes(detail.totalSize)}
                </p>
              </div>
              <span className="text-[30px] font-semibold leading-none tabular-nums text-primary">
                {Math.floor(detail.progress * 100)}
                <span className="ml-0.5 text-sm">%</span>
              </span>
            </div>
            <ProgressBar value={detail.progress} className="h-2" />
            <div className="mt-2.5 flex justify-between text-[12px] text-ink-3">
              <span>{formatSpeed(detail.downSpeed)}</span>
              <span>顺序下载 · 为流畅播放优化</span>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, note, tone }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-ink-2">{label}</span>
              <span
                className={`grid size-8 place-items-center rounded-xl ${
                  tone === "primary"
                    ? "bg-primary/10 text-primary"
                    : tone === "secondary"
                      ? "bg-secondary/12 text-secondary"
                      : tone === "success"
                        ? "bg-success/12 text-success"
                        : "bg-surface-2 text-ink-2"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 truncate text-[22px] font-semibold tracking-tight text-ink tabular-nums">
              {value}
            </p>
            <p className="mt-1 truncate text-[12px] text-ink-3">{note}</p>
          </Card>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard
          title="文件"
          subtitle="每个文件的下载进度"
          icon={<HardDrive className="h-[18px] w-[18px]" />}
          action={
            <span className="text-[12px] text-ink-3">{detail.files.length} 项</span>
          }
          bodyClassName="p-0"
        >
          <div className="border-t border-line">
            <FileList files={detail.files} readOnly />
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title="分片分布"
            subtitle="实时下载完整性"
            icon={<Gauge className="h-[18px] w-[18px]" />}
          >
            <PieceMap
              bitmap={detail.pieceBitmap}
              totalPieces={detail.totalPieces}
              progress={detail.progress}
            />
          </SectionCard>

          <SectionCard
            title="Tracker 与网络"
            subtitle="当前任务使用的节点发现方式"
            icon={<Radio className="h-[18px] w-[18px]" />}
          >
            {detail.trackers.length ? (
              <div className="space-y-2">
                {detail.trackers.map((tracker) => (
                  <div
                    key={tracker}
                    className="flex items-center gap-2 rounded-xl border border-line bg-surface-1/60 px-3 py-2.5"
                  >
                    <Globe2 className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                    <span
                      className="truncate font-mono text-[11px] text-ink-2"
                      title={tracker}
                    >
                      {tracker}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-line-strong bg-surface-1/40 p-4 text-[13px] leading-5 text-ink-3">
                使用 DHT 分布式节点发现，无额外 Tracker。
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}