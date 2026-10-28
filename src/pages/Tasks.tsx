import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, ListFilter, ListVideo, Plus, Search, Users, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { commands } from "../api/commands";
import { useTaskEvents } from "../api/events";
import type { TaskState, TaskSummary } from "../api/types";
import { TaskCard } from "../components/TaskCard";
import { Button, Card, EmptyState } from "../components/md";
import { cn } from "../lib/cn";
import { formatSpeed } from "../lib/format";

const filters: { value: "All" | TaskState; label: string }[] = [
  { value: "All", label: "全部" },
  { value: "Downloading", label: "下载中" },
  { value: "Paused", label: "已暂停" },
  { value: "Seeding", label: "已完成" },
];

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | TaskState>("All");
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    void commands
      .listTasks()
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const onProgress = useCallback((updated: TaskSummary) => {
    setTasks((items) =>
      items.map((task) =>
        task.id === updated.id ? { ...task, ...updated } : task,
      ),
    );
  }, []);
  useTaskEvents(onProgress);

  const visible = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (filter === "All" || task.state === filter) &&
          task.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [tasks, filter, query],
  );

  const active = tasks.filter((task) => task.state === "Downloading");
  const speed = active.reduce((sum, task) => sum + task.downSpeed, 0);
  const peers = active.reduce((sum, task) => sum + task.peers, 0);
  const completed = tasks.filter((task) => task.state === "Seeding").length;

  const countFor = (value: "All" | TaskState) =>
    value === "All"
      ? tasks.length
      : tasks.filter((task) => task.state === value).length;

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden">
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-primary">
              LIBRARY
            </p>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink">
              {active.length > 0 ? "下载进行中" : "所有任务都在你的掌控之中"}
            </h2>
            <p className="mt-1.5 text-[13px] leading-6 text-ink-2">
              {active.length > 0 ? (
                <>
                  <span className="font-semibold text-ink">{active.length}</span>{" "}
                  个任务正在下载，当前总速度{" "}
                  <span className="font-semibold text-primary">
                    {formatSpeed(speed)}
                  </span>
                </>
              ) : (
                "暂无活跃下载，可以继续暂停的任务或添加新的磁力链接。"
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <MiniStat icon={<Zap className="h-3.5 w-3.5" />} value={formatSpeed(speed)} label="总速度" />
            <MiniStat icon={<Users className="h-3.5 w-3.5" />} value={`${peers}`} label="节点" />
            <MiniStat icon={<Download className="h-3.5 w-3.5" />} value={`${completed}`} label="已完成" />
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-surface-1/70 p-1 no-scrollbar">
          {filters.map((item) => {
            const activeFilter = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-all duration-200",
                  activeFilter
                    ? "bg-card text-ink shadow-sm ring-1 ring-line"
                    : "text-ink-2 hover:bg-card/50 hover:text-ink",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-md px-1 text-[11px] tabular-nums",
                    activeFilter ? "bg-primary/10 text-primary" : "text-ink-3",
                  )}
                >
                  {countFor(item.value)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-1/70 px-3.5 transition-colors focus-within:bg-card lg:w-56 lg:flex-none">
            <Search className="h-[15px] w-[15px] shrink-0 text-ink-3" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索任务"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
            />
          </label>
          <Button onClick={() => navigate("/")} className="shrink-0">
            <Plus size={16} />
            添加任务
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-[132px] animate-pulse rounded-3xl bg-surface-1" />
          ))}
        </div>
      ) : visible.length > 0 ? (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {visible.map((task) => (
            <TaskCard key={task.id} task={task} onChanged={load} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={
              tasks.length ? <ListFilter size={27} /> : <ListVideo size={27} />
            }
            title={tasks.length ? "没有匹配的任务" : "任务列表还是空的"}
            description={
              tasks.length
                ? "尝试切换筛选条件或搜索其他关键词。"
                : "添加一个磁力链接，选择文件后就能开始下载。"
            }
            action={
              !tasks.length && (
                <Button onClick={() => navigate("/")}>
                  <Download size={16} />
                  添加第一个任务
                </Button>
              )
            }
          />
        </Card>
      )}
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-[74px] rounded-xl bg-surface-1/70 px-3 py-2">
      <span className="flex items-center gap-1 text-[11px] font-medium text-ink-3">
        {icon}
        {label}
      </span>
      <p className="mt-1 truncate text-[14px] font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}