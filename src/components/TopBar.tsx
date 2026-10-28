import { useLocation, useNavigate } from "react-router-dom";
import { Moon, Settings, Sun } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import { BrandMark } from "./BrandMark";
import { IconButton } from "./md";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "下载中心", subtitle: "粘贴磁力链接，边下边播" },
  "/tasks": { title: "下载任务", subtitle: "管理所有下载、分片与播放进度" },
  "/task/new": { title: "添加任务", subtitle: "选择要下载与播放的文件" },
  "/settings": { title: "设置", subtitle: "下载策略、播放服务与界面外观" },
};

export function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { mode, toggleMode } = usePreferences();

  const meta = pathname.startsWith("/tasks/") && pathname !== "/tasks"
    ? { title: "任务详情", subtitle: "实时速度、分片分布与网络状态" }
    : PAGE_META[pathname] ?? PAGE_META["/"];

  return (
    <header className="glass relative z-10 flex h-[68px] shrink-0 items-center gap-3 border-b border-line px-4 sm:h-[76px] sm:px-6">
      <BrandMark className="h-8 w-8 shrink-0 rounded-[10px] md:hidden" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[18px] font-semibold leading-tight tracking-tight text-ink">
          {meta.title}
        </h1>
        <p className="mt-0.5 truncate text-[12px] text-ink-2">
          {meta.subtitle}
        </p>
      </div>

      <IconButton
        label={mode === "dark" ? "切换到浅色模式" : "切换到深色模式"}
        onClick={() => void toggleMode()}
      >
        {mode === "dark" ? (
          <Sun className="h-[18px] w-[18px]" />
        ) : (
          <Moon className="h-[18px] w-[18px]" />
        )}
      </IconButton>

      <IconButton
        label="设置"
        onClick={() => navigate("/settings")}
        className="md:hidden"
      >
        <Settings className="h-[18px] w-[18px]" />
      </IconButton>
    </header>
  );
}