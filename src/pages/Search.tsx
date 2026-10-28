import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Copy, Globe2, Link2, Magnet, Search, SquareArrowOutUpRight } from "lucide-react";
import { commands, errorMessage } from "../api/commands";
import { isTauri } from "../api/mock";
import { Button, Card, Chip, IconButton, SectionCard, TextInput } from "../components/md";
import sites from "../data/search-sites.json";
import { useSnackbar } from "../hooks/useSnackbar";

export default function SearchPage() {
  const navigate = useNavigate();
  const notify = useSnackbar();
  const [opening, setOpening] = useState<string>();
  const [magnet, setMagnet] = useState("");
  const [parsing, setParsing] = useState(false);

  const openSite = async (siteId: string) => {
    setOpening(siteId);
    try {
      await commands.openSearchSite(siteId);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setOpening(undefined);
    }
  };

  const copyAddress = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      notify("站点地址已复制", "success");
    } catch {
      notify("无法复制，请选中站点地址后使用系统复制快捷键", "error");
    }
  };

  const addMagnet = async (event: FormEvent) => {
    event.preventDefault();
    if (!magnet.trim() || parsing) return;
    setParsing(true);
    try {
      const parsed = await commands.parseMagnet(magnet);
      navigate(`/task/new?magnet=${encodeURIComponent(parsed.magnetUri)}`);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-5xl border border-line bg-card p-6 shadow-card sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-primary/6 blur-3xl" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1.5 text-caption font-medium text-primary">
              <Globe2 size={14} />
              站点导航 · WebView 访问
            </span>
            <h2 className="mt-4 text-hero text-ink sm:text-hero-lg">
              找到资源，<span className="text-primary">接着播放。</span>
            </h2>
            <p className="mt-3 max-w-2xl text-body leading-6 text-ink-2">
              选择一个搜索站点，在独立的应用窗口内搜索。点击网页中的磁力链接，即可回到 TorrNet 选择文件并添加任务。
            </p>
          </div>
          <span className="hidden size-20 shrink-0 place-items-center rounded-3xl border border-primary/15 bg-primary/8 text-primary sm:grid">
            <Search size={34} strokeWidth={1.6} />
          </span>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 text-caption text-ink-3">
          {["原生 WebView 窗口", "磁力链接一键接入", "保留已打开的搜索页面"].map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Check size={14} className="text-primary" />
              {label}
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="search-sites-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <h2 id="search-sites-title" className="text-title text-ink">常用搜索站点</h2>
            <p className="mt-1 text-body-sm text-ink-2">进入站点后，使用网页内的搜索框查找资源。</p>
          </div>
          <span className="text-caption text-ink-3">{sites.length} 个站点</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {sites.map((site, index) => (
            <Card key={site.id} className="flex flex-col p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
                  {site.name.slice(0, 1)}
                </span>
                <Chip tone={index === 0 ? "primary" : "outline"}>{site.tag}</Chip>
              </div>
              <h3 className="mt-5 text-title text-ink">{site.name}</h3>
              <div className="mt-1 flex items-center gap-1">
                <span className="min-w-0 select-text break-all font-mono text-caption text-ink-3">{site.url}</span>
                <IconButton
                  label={`复制 ${site.name} 地址`}
                  className="size-7 rounded-lg"
                  onClick={() => void copyAddress(site.url)}
                >
                  <Copy size={13} />
                </IconButton>
              </div>
              <p className="mb-5 mt-3 flex-1 text-body-sm leading-6 text-ink-2">{site.description}</p>
              <Button
                variant={index === 0 ? "filled" : "tonal"}
                fullWidth
                disabled={opening !== undefined || !isTauri}
                loading={opening === site.id}
                onClick={() => void openSite(site.id)}
                aria-label={`在 WebView 中访问 ${site.name}`}
              >
                {opening === site.id ? "正在打开" : "进入站点"}
                {opening !== site.id && <SquareArrowOutUpRight size={16} />}
              </Button>
            </Card>
          ))}
        </div>
        <p className="mt-3 px-1 text-caption leading-5 text-ink-3">
          {isTauri
            ? "站点可用性取决于网络和站点状态；无法访问时可切换其他站点。窗口内支持 Alt + ← / → 前进后退，以及 Ctrl / ⌘ + R 刷新。"
            : "当前为浏览器预览。请启动 TorrNet 桌面应用，通过原生 WebView 访问这些站点。"}
        </p>
      </section>

      <SectionCard
        title="已经找到磁力链接？"
        subtitle="也可以把复制的链接粘贴到这里，直接添加任务。"
        icon={<Magnet size={20} />}
      >
        <form onSubmit={(event) => void addMagnet(event)} className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <TextInput
              value={magnet}
              onChange={(event) => setMagnet(event.target.value)}
              aria-label="搜索结果磁力链接"
              placeholder="粘贴 magnet 链接或 info-hash"
              spellCheck={false}
              leading={<Link2 size={17} />}
            />
          </div>
          <Button type="submit" disabled={!magnet.trim() || parsing} loading={parsing}>
            {parsing ? "正在解析" : "添加任务"}
            {!parsing && <ArrowRight size={16} />}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
