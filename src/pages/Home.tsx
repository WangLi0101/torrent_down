import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Clipboard,
  ClipboardCheck,
  Download,
  Gauge,
  Link2,
  ListVideo,
  LoaderCircle,
  Play,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { commands, errorMessage } from "../api/commands";
import { useTaskEvents } from "../api/events";
import type { TaskSummary } from "../api/types";
import { TaskCard } from "../components/TaskCard";
import { Button, Card, IconButton, SectionCard } from "../components/md";
import { usePreferences } from "../context/PreferencesContext";
import { useSnackbar } from "../hooks/useSnackbar";
import { formatSpeed } from "../lib/format";

const FEATURES = [
  { icon: Zap, label: "DHT + Tracker" },
  { icon: Download, label: "选择性下载" },
  { icon: Play, label: "HTTP Range 边下边播" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const notify = useSnackbar();
  const { settings } = usePreferences();
  const [magnet, setMagnet] = useState("");
  const [parsing, setParsing] = useState(false);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    void commands
      .listTasks()
      .then(setTasks)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const onProgress = useCallback((task: TaskSummary) => {
    setTasks((items) => {
      const exists = items.some((item) => item.id === task.id);
      return exists
        ? items.map((item) => (item.id === task.id ? { ...item, ...task } : item))
        : [task, ...items];
    });
  }, []);
  useTaskEvents(onProgress);

  const stats = useMemo(() => {
    const active = tasks.filter((task) => task.state === "Downloading");
    return {
      active: active.length,
      speed: active.reduce((sum, task) => sum + task.downSpeed, 0),
      done: tasks.filter((task) => task.state === "Seeding").length,
      peers: active.reduce((sum, task) => sum + task.peers, 0),
    };
  }, [tasks]);

  const recent = tasks.slice(0, 3);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!magnet.trim()) return notify("请先粘贴磁力链接或 info-hash", "error");
    setParsing(true);
    try {
      const parsed = await commands.parseMagnet(magnet);
      void navigate(`/task/new?magnet=${encodeURIComponent(parsed.magnetUri)}`);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setParsing(false);
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return notify("剪贴板中没有内容");
      setMagnet(text);
    } catch {
      notify("无法读取剪贴板，请使用系统粘贴快捷键", "error");
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-5xl border border-line bg-card shadow-card">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-12">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1.5 text-caption font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              边下边播 · 本地优先
            </span>
            <h2 className="mt-4 text-balance text-hero text-ink sm:text-hero-lg">
              下载还没结束，
              <br />
              <span className="text-primary">精彩已经开始。</span>
            </h2>
            <p className="mt-3 max-w-md text-balance text-body leading-6 text-ink-2">
              粘贴磁力链接，勾选想看的内容。TorrNet 会优先下载播放所需分片，
              让你在最少的等待里进入画面。
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-ink-3">
              {FEATURES.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-primary/80" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <form
            onSubmit={submit}
            className="rounded-2xl border border-primary/15 bg-linear-to-br from-primary/8 to-primary/3 p-4 sm:p-5"
          >
            <div className="mb-3">
              <p className="text-body font-medium text-primary">从磁力链接开始</p>
              <p className="mt-1 text-caption text-ink-2">
                支持 magnet 链接、40 位 hex 或 32 位 base32
              </p>
            </div>

            <div className="flex h-12 items-center gap-2 rounded-xl border border-primary/20 bg-card pl-3 pr-1.5 transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10">
              <Link2 className="h-[18px] w-[18px] shrink-0 text-primary" />
              <input
                value={magnet}
                onChange={(event) => setMagnet(event.target.value)}
                placeholder="粘贴 magnet:?xt=urn:btih:…"
                aria-label="磁力链接"
                spellCheck={false}
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent font-mono text-body-sm text-ink outline-none placeholder:font-sans placeholder:text-ink-3"
              />
              <IconButton
                label="从剪贴板粘贴"
                onClick={() => void paste()}
                className="size-9 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Clipboard className="h-[17px] w-[17px]" />
              </IconButton>
            </div>

            <Button
              type="submit"
              fullWidth
              disabled={parsing || !magnet.trim()}
              className="magnet-submit mt-3"
            >
              {parsing ? (
                <LoaderCircle className="h-[17px] w-[17px] animate-spin" />
              ) : (
                <Zap className="h-[17px] w-[17px]" fill="currentColor" />
              )}
              {parsing ? "正在解析链接" : "开始解析"}
              {!parsing && <ArrowRight className="h-4 w-4" />}
            </Button>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-caption text-ink-3">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/80" />
                仅在本地解析，保护隐私
              </span>
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 truncate rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2/60 hover:text-ink-2 sm:max-w-[45%]"
                title={settings?.downloadDir}
              >
                <ClipboardCheck className="h-3 w-3 shrink-0" />
                <span className="truncate">{settings?.downloadDir ?? "默认下载目录"}</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Download className="h-[18px] w-[18px]" />}
          label="正在下载"
          value={`${stats.active}`}
          note="个活跃任务"
          tone="primary"
        />
        <StatCard
          icon={<Gauge className="h-[18px] w-[18px]" />}
          label="当前速度"
          value={formatSpeed(stats.speed)}
          note={`${stats.peers} 个已连接节点`}
          tone="secondary"
        />
        <StatCard
          icon={<Play className="h-[18px] w-[18px]" />}
          label="已完成"
          value={`${stats.done}`}
          note="可随时离线播放"
          tone="success"
        />
        <StatCard
          icon={<ListVideo className="h-[18px] w-[18px]" />}
          label="全部任务"
          value={`${tasks.length}`}
          note="本地任务记录"
          tone="neutral"
        />
      </section>

      <SectionCard
        title="最近任务"
        subtitle="接着下载，或继续上次观看"
        icon={<ListVideo className="h-[18px] w-[18px]" />}
        action={
          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-caption font-semibold text-ink-2 transition-colors hover:bg-surface-1 hover:text-primary"
          >
            全部任务
            <ArrowRight className="h-3 w-3" />
          </button>
        }
      >
        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[86px] animate-pulse rounded-2xl bg-surface-1"
              />
            ))}
          </div>
        ) : recent.length ? (
          <div className="grid gap-3">
            {recent.map((task) => (
              <TaskCard key={task.id} task={task} onChanged={load} compact />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong px-6 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ListVideo className="h-5 w-5" />
            </span>
            <p className="mt-3 text-body font-semibold text-ink">
              还没有下载任务
            </p>
            <p className="mt-1 max-w-xs text-body-sm leading-5 text-ink-3">
              在上方粘贴第一个磁力链接，解析后即可选择文件并开始下载。
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone: "primary" | "secondary" | "success" | "neutral";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/12 text-secondary",
    success: "bg-success/12 text-success",
    neutral: "bg-surface-2 text-ink-2",
  } as const;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-medium text-ink-2">{label}</span>
        <span className={`grid size-8 place-items-center rounded-xl ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 truncate text-stat text-ink">
        {value}
      </p>
      <p className="mt-1 truncate text-caption text-ink-3">{note}</p>
    </Card>
  );
}
