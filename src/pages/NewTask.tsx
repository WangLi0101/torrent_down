import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  Link2,
  LoaderCircle,
  Magnet,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { commands, errorMessage, selectDirectory } from "../api/commands";
import { onMetadataResolved } from "../api/events";
import type { TaskDetail } from "../api/types";
import { FileList } from "../components/FileList";
import { Button, Card, Chip, ProgressBar, SectionCard, Spinner } from "../components/md";
import { usePreferences } from "../context/PreferencesContext";
import { formatBytes } from "../lib/format";
import { useSnackbar } from "../hooks/useSnackbar";
import { cn } from "../lib/cn";

const STEPS = ["解析链接", "选择文件", "开始下载"];

export default function NewTask() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const notify = useSnackbar();
  const { settings } = usePreferences();
  const magnet = params.get("magnet") ?? "";
  const [taskId, setTaskId] = useState<number>();
  const [detail, setDetail] = useState<TaskDetail>();
  const [outputDir, setOutputDir] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (settings && !outputDir) setOutputDir(settings.downloadDir);
  }, [settings, outputDir]);

  useEffect(() => {
    if (!magnet) {
      setError("链接为空，请返回首页重新粘贴磁力链接。");
      return;
    }
    let cancelled = false;
    commands
      .addTask(magnet)
      .then(async ({ taskId: id }) => {
        if (cancelled) return;
        setTaskId(id);
        const value = await commands.getTaskDetail(id);
        if (!cancelled && value.hasMetadata) setDetail(value);
      })
      .catch((reason) => !cancelled && setError(errorMessage(reason)));
    return () => {
      cancelled = true;
    };
  }, [magnet]);

  useEffect(() => {
    if (!taskId || detail) return;
    let unlisten: (() => void) | undefined;
    void onMetadataResolved((event) => {
      if (event.taskId !== taskId) return;
      void commands.getTaskDetail(taskId).then(setDetail);
    }).then((fn) => {
      unlisten = fn;
    });
    const timer = window.setInterval(() => {
      void commands
        .getTaskDetail(taskId)
        .then((value) => {
          if (value.hasMetadata) setDetail(value);
          if (value.state === "Error") setError(value.error ?? "元数据获取失败");
        })
        .catch(() => undefined);
    }, 1800);
    const timeout = window.setTimeout(
      () =>
        setError(
          "获取元数据超时。资源可能没有在线节点，请稍后重试或添加包含更多 Tracker 的链接。",
        ),
      180_000,
    );
    return () => {
      unlisten?.();
      window.clearInterval(timer);
      window.clearTimeout(timeout);
    };
  }, [taskId, detail]);

  const toggle = useCallback((idx: number) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            files: current.files.map((file) =>
              file.idx === idx ? { ...file, included: !file.included } : file,
            ),
          }
        : current,
    );
  }, []);

  const selected = useMemo(
    () => detail?.files.filter((file) => file.included) ?? [],
    [detail],
  );
  const totalSize = selected.reduce((sum, file) => sum + file.size, 0);

  const setSelection = (mode: "all" | "videos" | "none") => {
    setDetail((current) =>
      current
        ? {
            ...current,
            files: current.files.map((file) => ({
              ...file,
              included:
                mode === "all" || (mode === "videos" && file.isVideo),
            })),
          }
        : current,
    );
  };

  const browse = async () => {
    const directory = await selectDirectory();
    if (directory) setOutputDir(directory);
  };

  const confirm = async () => {
    if (!taskId || !selected.length || !outputDir) return;
    setConfirming(true);
    try {
      await commands.confirmTask(
        taskId,
        selected.map((file) => file.idx),
        outputDir,
      );
      notify("下载已开始，可随时边下边播", "success");
      void navigate("/tasks");
    } catch (reason) {
      notify(errorMessage(reason), "error");
    } finally {
      setConfirming(false);
    }
  };

  const activeStep = detail ? 1 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-1 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>

        <div className="flex items-center gap-2 rounded-xl bg-surface-1/70 px-3 py-2">
          {STEPS.map((label, index) => {
            const complete =
              (index === 0 && (taskId !== undefined || !!detail)) ||
              (index === 1 && confirming);
            const active = index === activeStep;
            return (
              <div key={label} className="flex items-center gap-2">
                {index > 0 && <ChevronRight className="h-3 w-3 text-ink-3" />}
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-[12px] font-medium",
                    active ? "text-primary" : complete ? "text-ink" : "text-ink-3",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-full text-[11px]",
                      active
                        ? "bg-primary text-on-primary"
                        : complete
                          ? "bg-primary/12 text-primary"
                          : "bg-surface-2 text-ink-3",
                    )}
                  >
                    {complete ? <Check size={11} strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error ? (
        <Card className="mx-auto max-w-xl p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-danger/10 text-danger">
            <Magnet size={25} />
          </div>
          <h2 className="mt-5 text-[20px] font-semibold tracking-tight text-ink">暂时无法获取内容</h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-ink-2">
            {error}
          </p>
          <div className="mt-7 flex justify-center gap-2">
            <Button variant="outlined" onClick={() => navigate("/")}>
              返回首页
            </Button>
            <Button onClick={() => window.location.reload()}>重新尝试</Button>
          </div>
        </Card>
      ) : !detail ? (
        <Card className="relative mx-auto max-w-xl overflow-hidden">
          <div className="relative flex flex-col items-center px-6 py-12 text-center">
            <div className="grid size-20 place-items-center rounded-3xl bg-primary/10 text-primary">
              <Link2 size={29} />
            </div>
            <h2 className="mt-6 text-[20px] font-semibold tracking-tight text-ink">
              正在发现资源
            </h2>
            <p className="mt-2.5 max-w-sm text-[14px] leading-6 text-ink-2">
              通过 DHT 和 Tracker 连接节点，获取文件信息。冷门资源可能需要几分钟。
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-full bg-surface-1/70 px-4 py-2 text-[12px] text-ink-2">
              <Spinner size={14} />
              {taskId ? "正在交换种子元数据" : "正在初始化下载引擎"}
            </div>
            <p className="mt-7 max-w-full truncate rounded-xl bg-surface-1/60 px-4 py-2 font-mono text-[11px] text-ink-3">
              {magnet}
            </p>
            {taskId && (
              <div className="mt-6 w-full max-w-xs">
                <ProgressBar value={0.35} className="animate-pulse" />
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Card className="relative overflow-hidden">
              <div className="relative p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="success" icon={<Sparkles className="h-3 w-3" />}>
                    元数据已就绪
                  </Chip>
                  <span className="font-mono text-[11px] uppercase tracking-wide text-ink-3">
                    {detail.infoHash.slice(0, 16)}…
                  </span>
                </div>
                <h2
                  className="mt-3 text-balance text-[20px] font-semibold leading-snug tracking-tight text-ink sm:text-[24px]"
                  title={detail.name}
                >
                  {detail.name}
                </h2>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-2">
                  <span>
                    <span className="font-semibold text-ink">{detail.files.length}</span> 个文件
                  </span>
                  <span className="text-ink-3/50">·</span>
                  <span>
                    已选择{" "}
                    <span className="font-semibold text-primary">{selected.length}</span> 个
                  </span>
                  <span className="text-ink-3/50">·</span>
                  <span>{formatBytes(totalSize)}</span>
                </div>
              </div>
            </Card>

            <SectionCard
              title="选择下载内容"
              subtitle="未勾选的文件不会占用磁盘或下载带宽"
              icon={<FolderOpen className="h-[18px] w-[18px]" />}
              action={
                <div className="flex items-center gap-1 rounded-xl bg-surface-1/70 p-1">
                  {(["videos", "all", "none"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSelection(mode)}
                      className="cursor-pointer rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-card hover:text-ink"
                    >
                      {mode === "videos" ? "仅视频" : mode === "all" ? "全选" : "清空"}
                    </button>
                  ))}
                </div>
              }
              bodyClassName="p-0"
            >
              <div className="border-t border-line">
                <FileList files={detail.files} onToggle={toggle} />
              </div>
            </SectionCard>
          </div>

          <div className="space-y-5 xl:sticky xl:top-0">
            <SectionCard
              title="保存位置"
              subtitle="下载完成后文件会保留在此目录"
              icon={<FolderOpen className="h-[18px] w-[18px]" />}
            >
              <div className="flex gap-2">
                <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-1/60 px-3">
                  <Folder className="h-4 w-4 shrink-0 text-ink-3" />
                  <input
                    value={outputDir}
                    onChange={(event) => setOutputDir(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
                    aria-label="下载目录"
                  />
                </div>
                <Button variant="outlined" onClick={() => void browse()}>
                  浏览
                </Button>
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-5 text-ink-3">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                未勾选的文件不会分配磁盘空间，也不会占用下载带宽。
              </p>
            </SectionCard>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-ink-2">本次下载</span>
                <span className="text-[12px] text-ink-2">
                  {selected.length} / {detail.files.length} 个文件
                </span>
              </div>
              <p className="mt-2 text-[26px] font-semibold tracking-tight text-ink tabular-nums">
                {formatBytes(totalSize)}
              </p>
              <ProgressBar
                value={detail.files.length ? selected.length / detail.files.length : 0}
                className="mt-3"
              />
              <Button
                fullWidth
                className="mt-5"
                disabled={!selected.length || !outputDir || confirming || !settings}
                onClick={() => void confirm()}
              >
                {confirming ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {confirming ? "正在创建任务" : "开始下载"}
              </Button>
              <button
                type="button"
                onClick={() => navigate("/tasks")}
                className="mt-2 h-9 w-full cursor-pointer rounded-xl text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-1 hover:text-ink"
              >
                稍后决定
              </button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}