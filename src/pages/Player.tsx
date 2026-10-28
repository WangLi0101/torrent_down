import Artplayer from "artplayer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, Expand, FileVideo2, LoaderCircle, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { commands, errorMessage } from "../api/commands";
import { useTaskEvents } from "../api/events";
import type { TaskDetail, TaskSummary } from "../api/types";
import { fileName, formatBytes, formatSpeed, formatTime } from "../lib/format";
import { IconButton } from "../components/md";
import { useSnackbar } from "../hooks/useSnackbar";

const rates = [1, 1.25, 1.5, 2, 0.5];

export default function Player() {
  const { id, fileIdx } = useParams();
  const taskId = Number(id);
  const fileIndex = Number(fileIdx);
  const navigate = useNavigate();
  const notify = useSnackbar();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerShellRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<Artplayer | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [detail, setDetail] = useState<TaskDetail>();
  const [streamUrl, setStreamUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    Promise.all([commands.getTaskDetail(taskId), commands.getStreamUrl(taskId, fileIndex)])
      .then(([task, url]) => {
        setDetail(task);
        setStreamUrl(url);
        if (!task.files.some((file) => file.idx === fileIndex && file.isVideo)) {
          setLoadError("所选文件不是支持播放的视频文件");
        }
      })
      .catch((error) => setLoadError(errorMessage(error)));
  }, [taskId, fileIndex]);

  const onProgress = useCallback((task: TaskSummary) => {
    if (task.id === taskId) setDetail((current) => current ? { ...current, ...task } : current);
  }, [taskId]);
  useTaskEvents(onProgress);

  useEffect(() => {
    if (!streamUrl || !containerRef.current) return;
    const accent =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--player-accent")
        .trim() || "#8b85ff";
    const art = new Artplayer({
      container: containerRef.current,
      url: streamUrl,
      volume: 0.8,
      autoplay: true,
      autoSize: false,
      autoMini: false,
      setting: false,
      loop: false,
      playbackRate: true,
      aspectRatio: false,
      fullscreen: true,
      fullscreenWeb: false,
      pip: true,
      miniProgressBar: false,
      mutex: true,
      backdrop: true,
      playsInline: true,
      theme: accent,
      lang: "zh-cn",
      moreVideoAttr: { preload: "auto" },
    });
    artRef.current = art;
    art.on("ready", () => {
      setDuration(art.duration);
      setVolume(art.volume);
    });
    art.on("video:play", () => { setPlaying(true); setBuffering(false); });
    art.on("video:pause", () => setPlaying(false));
    art.on("video:waiting", () => setBuffering(true));
    art.on("video:playing", () => setBuffering(false));
    art.on("video:timeupdate", () => {
      setCurrentTime(art.currentTime);
      setDuration(art.duration || 0);
    });
    art.on("video:volumechange", () => {
      setVolume(art.volume);
      setMuted(art.muted);
    });
    art.on("video:error", () => {
      setBuffering(false);
      setLoadError("视频暂时无法解码或读取。请确认 WebView 支持该编码，并等待更多分片下载。 ");
    });
    return () => {
      art.destroy(false);
      artRef.current = null;
    };
  }, [streamUrl]);

  const togglePlay = useCallback(() => {
    const art = artRef.current;
    if (!art) { setPlaying((value) => !value); return; }
    if (art.playing) art.pause();
    else void art.play().catch((error) => notify(errorMessage(error), "error"));
  }, [notify]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void playerShellRef.current?.requestFullscreen().catch(() => notify("当前环境不支持全屏显示", "error"));
  }, [notify]);

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const art = artRef.current;
      if (event.code === "Space") { event.preventDefault(); togglePlay(); }
      if (event.key.toLowerCase() === "f") toggleFullscreen();
      if (event.key.toLowerCase() === "m" && art) art.muted = !art.muted;
      if (event.key === "ArrowRight" && art) art.currentTime = Math.min(art.duration, art.currentTime + 5);
      if (event.key === "ArrowLeft" && art) art.currentTime = Math.max(0, art.currentTime - 5);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [togglePlay, toggleFullscreen]);

  const revealControls = () => {
    setControlsVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => playing && setControlsVisible(false), 2600);
  };

  const seek = (value: number) => {
    setCurrentTime(value);
    if (artRef.current) artRef.current.currentTime = value;
  };
  const changeVolume = (value: number) => {
    setVolume(value);
    if (artRef.current) { artRef.current.volume = value; artRef.current.muted = value === 0; }
  };
  const cycleRate = () => {
    const next = rates[(rates.indexOf(rate) + 1) % rates.length];
    setRate(next);
    if (artRef.current) artRef.current.playbackRate = next;
  };
  const file = detail?.files.find((item) => item.idx === fileIndex);
  const playbackPosition = duration ? currentTime / duration : 0;
  const healthy = !detail || detail.progress >= 0.999 || detail.progress > playbackPosition + 0.015;

  return (
    <div ref={playerShellRef} onMouseMove={revealControls} onTouchStart={revealControls} className="relative h-screen min-h-[480px] w-screen overflow-hidden bg-[#08090c] text-white">
      <div ref={containerRef} className="art-video-player absolute inset-0" />
      {!streamUrl && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,#29223b_0%,#101117_52%,#08090c_100%)]">
          <div className="flex flex-col items-center text-center"><div className="flex size-24 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--player-accent)] backdrop-blur"><FileVideo2 size={38} /></div><p className="mt-6 text-body font-medium">播放器预览</p><p className="mt-2 max-w-xs text-caption leading-5 text-white/45">浏览器预览不会加载视频。桌面应用会通过本地 Range 流在此处播放。</p></div>
        </div>
      )}
      {loadError && <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#101117]/95 p-8"><div className="max-w-md text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger"><RotateCcw size={24} /></div><h2 className="mt-5 text-page-title font-semibold">暂时无法播放</h2><p className="mt-3 text-body leading-6 text-white/55">{loadError}</p><button type="button" onClick={() => window.location.reload()} className="mt-6 h-10 rounded-full bg-[var(--player-accent)] px-5 text-body font-semibold text-[#17141f]">重新加载</button></div></div>}
      {buffering && !loadError && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><div className="flex flex-col items-center rounded-2xl bg-black/40 px-6 py-5 backdrop-blur-md"><LoaderCircle size={32} className="animate-spin text-[var(--player-accent)]" /><p className="mt-3 text-caption text-white/70">正在等待所需分片…</p></div></div>}

      <div className={`absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-5 pb-12 pt-5 transition-opacity duration-300 sm:px-7 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className="flex items-center gap-3"><IconButton label="返回任务详情" onClick={() => navigate(`/tasks/${taskId}`)} className="text-white hover:bg-white/10 hover:text-white"><ArrowLeft size={22} /></IconButton><div className="min-w-0 flex-1"><h1 className="truncate text-body font-semibold sm:text-title">{file ? fileName(file.path) : detail?.name ?? "正在加载"}</h1><p className="mt-1 truncate text-caption text-white/60">{detail?.name}</p></div>{detail && <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-caption tabular-nums text-white/70 backdrop-blur sm:flex"><Download size={13} className="text-[var(--player-accent)]" />{Math.floor(detail.progress * 100)}%<span className="text-white/25">·</span>{formatSpeed(detail.downSpeed)}</div>}</div>
      </div>

      <button type="button" aria-label={playing ? "暂停" : "播放"} onClick={togglePlay} className={`absolute left-1/2 top-1/2 z-10 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-black/45 ${streamUrl && controlsVisible && !buffering && !loadError ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {playing ? <Pause size={27} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
      </button>

      <div className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-5 pb-5 pt-16 transition-opacity duration-300 sm:px-7 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className="relative mb-3 h-5 group">
          <div className="absolute inset-x-0 top-2 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full" style={{ width: `${(detail?.progress ?? 0) * 100}%`, backgroundColor: "color-mix(in srgb, var(--player-accent) 35%, transparent)" }} /><div className="absolute inset-y-0 left-0" style={{ width: `${playbackPosition * 100}%`, backgroundColor: "var(--player-accent)" }} /></div>
          <input type="range" min={0} max={duration || 100} step={0.05} value={Math.min(currentTime, duration || 100)} onChange={(event) => seek(Number(event.target.value))} aria-label="播放进度" className="absolute inset-0 h-5 w-full cursor-pointer opacity-0" />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <IconButton label={playing ? "暂停" : "播放"} onClick={togglePlay} className="text-white hover:bg-white/10 hover:text-white">{playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</IconButton>
          <div className="flex items-center gap-2"><IconButton label={muted ? "取消静音" : "静音"} onClick={() => { if (artRef.current) artRef.current.muted = !muted; setMuted(!muted); }} className="text-white hover:bg-white/10 hover:text-white">{muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}</IconButton><input type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume} onChange={(event) => changeVolume(Number(event.target.value))} aria-label="音量" className="hidden h-1 w-20 cursor-pointer sm:block" /></div>
          <span className="ml-1 whitespace-nowrap text-caption font-medium tabular-nums text-white/70"><span className="text-white">{formatTime(currentTime)}</span><span className="mx-1.5 text-white/30">/</span>{formatTime(duration)}</span>
          <div className="flex-1" />
          <div className={`mr-1 hidden items-center gap-1.5 text-caption md:flex ${healthy ? "text-white/50" : "text-[var(--player-accent)]"}`}>{healthy ? <CheckCircle2 size={14} /> : <LoaderCircle size={14} className="animate-spin" />}{healthy ? "缓冲充足" : "正在追赶播放位置"}</div>
          <button type="button" onClick={cycleRate} className="state-layer h-9 min-w-12 rounded-full px-2 text-label tabular-nums text-white/80 hover:bg-white/10">{rate}×</button>
          <IconButton label={fullscreen ? "退出全屏" : "全屏"} onClick={toggleFullscreen} className="text-white hover:bg-white/10 hover:text-white">{fullscreen ? <Minimize size={21} /> : <Maximize size={21} />}</IconButton>
        </div>
        {detail && <div className="mt-3 hidden items-center gap-2 text-caption text-white/50 sm:flex"><Expand size={11} /><span>空格 播放/暂停</span><span>·</span><span>← → 快退/快进 5 秒</span><span>·</span><span>F 全屏</span><span className="ml-auto">{formatBytes(file?.size ?? 0)}</span></div>}
      </div>
    </div>
  );
}
