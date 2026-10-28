import { useEffect, useState } from "react";
import {
  Check,
  Download,
  FolderOpen,
  Gauge,
  HardDrive,
  Info,
  Monitor,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  Wifi,
} from "lucide-react";
import { selectDirectory } from "../api/commands";
import type {
  AutoSelectMode,
  Settings as SettingsType,
  ThemeMode,
} from "../api/types";
import {
  Button,
  Card,
  Chip,
  FieldLabel,
  SectionCard,
  Segmented,
  Spinner,
} from "../components/md";
import { usePreferences } from "../context/PreferencesContext";
import { useSnackbar } from "../hooks/useSnackbar";
import { ACCENTS, getAccent } from "../lib/accents";
import { cn } from "../lib/cn";

const themeOptions: { value: ThemeMode; label: string; icon: typeof Moon }[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
];

const selectOptions: { value: AutoSelectMode; label: string }[] = [
  { value: "videos", label: "仅视频" },
  { value: "all", label: "全部文件" },
  { value: "none", label: "不勾选" },
];

export default function Settings() {
  const notify = useSnackbar();
  const { settings, mode, updateSettings, saveSettings } = usePreferences();
  const [draft, setDraft] = useState<SettingsType>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setDraft((current) =>
      current
        ? {
            ...current,
            theme: settings.theme,
            accent: settings.accent,
            streamPort: settings.streamPort,
          }
        : settings,
    );
  }, [settings]);

  if (!draft) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={30} />
      </div>
    );
  }

  const update = <K extends keyof SettingsType>(
    key: K,
    value: SettingsType[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const changeTheme = (theme: ThemeMode) => {
    update("theme", theme);
    void updateSettings({ theme });
  };

  const changeAccent = (accent: SettingsType["accent"]) => {
    update("accent", accent);
    void updateSettings({ accent });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings({ ...draft, streamPort: 0 });
      notify("设置已保存", "success");
    } catch {
      // 错误提示由 PreferencesContext 统一展示
    } finally {
      setSaving(false);
    }
  };

  const downMbps = draft.downloadLimit / 1024 / 1024;
  const upMbps = draft.uploadLimit / 1024 / 1024;
  const accent = getAccent(draft.accent);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-ink-2">
          所有设置都保存在本机，修改主题与强调色会立即生效。
        </p>
        <div>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner size={15} /> : <Save size={16} />}
            {saving ? "正在保存" : "保存设置"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <SectionCard
            title="外观"
            subtitle="主题模式与强调色"
            icon={<Palette className="h-[18px] w-[18px]" />}
          >
            <FieldLabel>主题模式</FieldLabel>
            <Segmented<ThemeMode>
              ariaLabel="主题模式"
              value={draft.theme}
              onChange={changeTheme}
              options={themeOptions.map(({ value, label, icon: Icon }) => ({
                value,
                label,
                icon: <Icon className="h-3.5 w-3.5" />,
              }))}
              className="w-full justify-between sm:w-auto sm:justify-start"
            />

            <div className="mt-5">
              <FieldLabel>强调色</FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ACCENTS.map((item) => {
                  const active = draft.accent === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => changeAccent(item.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-left transition-all duration-200",
                        active
                          ? "border-primary/45 bg-primary/8"
                          : "border-line bg-surface-1/40 hover:border-line-strong hover:bg-surface-1",
                      )}
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-sm"
                        style={{ background: item.swatch }}
                      >
                        {active && <Check className="h-4 w-4" strokeWidth={3} />}
                      </span>
                      <span
                        className={cn(
                          "text-body-sm font-medium",
                          active ? "text-primary" : "text-ink-2",
                        )}
                      >
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-4 text-caption leading-relaxed text-ink-3">
              强调色会同步应用到按钮、进度条、导航与图表，并自动保存。
            </p>
          </SectionCard>

          <SectionCard
            title="下载"
            subtitle="默认保存位置与文件选择策略"
            icon={<Download className="h-[18px] w-[18px]" />}
          >
            <div className="grid gap-5">
              <div>
                <FieldLabel htmlFor="download-dir">默认下载目录</FieldLabel>
                <div className="flex gap-2">
                  <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-1/60 px-3">
                    <FolderOpen className="h-4 w-4 shrink-0 text-ink-3" />
                    <input
                      id="download-dir"
                      value={draft.downloadDir}
                      onChange={(event) => update("downloadDir", event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none"
                    />
                  </div>
                  <Button
                    variant="outlined"
                    onClick={async () => {
                      const path = await selectDirectory();
                      if (path) update("downloadDir", path);
                    }}
                  >
                    浏览
                  </Button>
                </div>
              </div>

              <div>
                <FieldLabel>新任务默认勾选</FieldLabel>
                <Segmented<AutoSelectMode>
                  ariaLabel="新任务默认勾选"
                  value={draft.autoSelect}
                  onChange={(value) => update("autoSelect", value)}
                  options={selectOptions}
                  className="w-full justify-between sm:w-auto sm:justify-start"
                />
                <p className="mt-3 flex items-start gap-1.5 text-caption leading-5 text-ink-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  选择「仅视频」会自动勾选常见视频格式，仍可在添加任务时手动调整。
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="速度限制"
            subtitle="单位为 MiB/s，设置为 0 表示不限制"
            icon={<Gauge className="h-[18px] w-[18px]" />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="down-limit">下载速度上限</FieldLabel>
                <div className="flex h-11 items-center rounded-xl bg-surface-1/60 px-3.5 transition-colors focus-within:bg-card">
                  <input
                    id="down-limit"
                    type="number"
                    min="0"
                    step="0.5"
                    value={downMbps}
                    onChange={(event) =>
                      update(
                        "downloadLimit",
                        Math.round(Math.max(0, Number(event.target.value)) * 1024 * 1024),
                      )
                    }
                    className="min-w-0 flex-1 bg-transparent text-body-sm tabular-nums text-ink outline-none"
                  />
                  <span className="text-caption text-ink-3">MiB/s</span>
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="up-limit">上传速度上限</FieldLabel>
                <div className="flex h-11 items-center rounded-xl bg-surface-1/60 px-3.5 transition-colors focus-within:bg-card">
                  <input
                    id="up-limit"
                    type="number"
                    min="0"
                    step="0.5"
                    value={upMbps}
                    onChange={(event) =>
                      update(
                        "uploadLimit",
                        Math.round(Math.max(0, Number(event.target.value)) * 1024 * 1024),
                      )
                    }
                    className="min-w-0 flex-1 bg-transparent text-body-sm tabular-nums text-ink outline-none"
                  />
                  <span className="text-caption text-ink-3">MiB/s</span>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="本地流媒体服务"
            subtitle="仅绑定回环地址，局域网设备无法访问"
            icon={<Wifi className="h-[18px] w-[18px]" />}
            action={<Chip tone="success">运行中</Chip>}
          >
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-1/60 p-4 text-caption">
              <div>
                <span className="text-ink-3">监听地址</span>
                <p className="mt-1.5 font-mono text-body-sm text-ink">127.0.0.1</p>
              </div>
              <div>
                <span className="text-ink-3">端口</span>
                <p className={cn("mt-1.5 text-body-sm text-ink", draft.streamPort > 0 && "font-mono")}>
                  {draft.streamPort || "启动时自动分配"}
                </p>
              </div>
            </div>
            <p className="mt-4 flex items-start gap-2 text-caption leading-5 text-ink-3">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              请仅下载和播放你有权访问的内容。TorrNet 不提供资源搜索或内容推荐。
            </p>
          </SectionCard>

          <div className="sm:hidden">
            <Button
              onClick={() => void save()}
              disabled={saving}
              fullWidth
            >
              {saving ? <Spinner size={15} /> : <Save size={16} />}
              {saving ? "正在保存" : "保存设置"}
            </Button>
          </div>
        </div>

        <div className="space-y-5 xl:sticky xl:top-0">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-title text-ink">实时预览</h2>
              <span className="rounded-lg bg-primary/10 px-2 py-1 text-caption font-medium text-primary">
                {mode === "dark" ? "深色" : "浅色"} · {accent.name}
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-on-primary">
                  <HardDrive className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="h-2 w-20 rounded-full bg-ink/70" />
                  <div className="mt-1.5 h-1.5 w-12 rounded-full bg-ink-3/40" />
                </div>
                <span className="size-1.5 rounded-full bg-success" />
              </div>

              <div className="mt-3 rounded-xl border border-line bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-mini font-semibold text-ink">
                    正在下载 · 示例任务
                  </span>
                  <span className="text-mini font-semibold tabular-nums text-primary">68%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full w-[68%] rounded-full bg-primary" />
                </div>
                <div className="mt-2 flex items-center justify-between text-mini tabular-nums text-ink-3">
                  <span>8.4 MB/s</span>
                  <span>剩余 5 分钟</span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <span className="flex h-7 flex-1 items-center justify-center rounded-lg bg-primary text-mini font-medium text-on-primary">
                  开始播放
                </span>
                <span className="flex h-7 items-center justify-center rounded-lg bg-primary/10 px-3 text-mini font-semibold text-primary">
                  详情
                </span>
              </div>
            </div>

            <p className="mt-3 text-caption leading-relaxed text-ink-3">
              预览使用当前主题与强调色，实际界面会即时切换。
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="text-title text-ink">当前配置</h2>
            <div className="mt-4 space-y-3 text-body-sm">
              <SummaryRow label="主题模式" value={mode === "dark" ? "深色" : "浅色"} />
              <SummaryRow label="强调色" value={accent.name} />
              <SummaryRow
                label="默认勾选"
                value={
                  draft.autoSelect === "videos"
                    ? "仅视频"
                    : draft.autoSelect === "all"
                      ? "全部文件"
                      : "不勾选"
                }
              />
              <SummaryRow
                label="下载限速"
                value={draft.downloadLimit > 0 ? `${downMbps} MiB/s` : "不限制"}
              />
              <SummaryRow
                label="下载目录"
                value={draft.downloadDir}
                mono
              />
            </div>
            <div className="mt-4 rounded-xl bg-surface-1/60 p-3">
              <div className="flex items-center gap-2 text-caption font-medium text-ink">
                <ShieldCheck className="h-4 w-4 text-success" />
                本地优先与隐私保护
              </div>
              <p className="mt-1.5 text-caption leading-5 text-ink-3">
                磁力解析、下载与播放全部在本机完成，视频流只监听 127.0.0.1。
              </p>
            </div>
            <div className="mt-4 hidden xl:block">
              <Button fullWidth onClick={() => void save()} disabled={saving}>
                {saving ? <Spinner size={15} /> : <Save size={16} />}
                {saving ? "正在保存" : "保存设置"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-ink-3">{label}</span>
      <span
        className={cn(
          "truncate text-right font-medium text-ink",
          mono && "font-mono text-caption",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
