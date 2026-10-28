import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  ListVideo,
  Plus,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { cn } from "../lib/cn";

interface NavItem {
  to: string;
  label: string;
  title: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { to: "/", label: "首页", title: "下载中心", icon: Home },
  { to: "/tasks", label: "任务", title: "下载任务", icon: ListVideo },
];

export function NavRail() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <aside className="relative z-20 hidden w-[88px] shrink-0 flex-col items-center border-r border-line bg-card/60 py-5 backdrop-blur-xl md:flex">
      <button
        type="button"
        onClick={() => navigate("/")}
        title="TorrNet Player"
        aria-label="TorrNet Player 首页"
        className="group relative mb-7 grid h-11 w-11 cursor-pointer place-items-center transition-transform duration-300 hover:scale-105 active:scale-95"
      >
        <BrandMark className="h-11 w-11 rounded-2xl" />
      </button>

      <nav className="flex flex-col items-center gap-2">
        {ITEMS.map(({ to, label, title, icon: Icon }) => {
          const active = isActive(to);
          return (
            <button
              key={to}
              type="button"
              title={title}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(to)}
              className="group flex w-[68px] cursor-pointer flex-col items-center gap-1 rounded-2xl py-1"
            >
              <span
                className={cn(
                  "grid h-[30px] w-14 place-items-center rounded-full transition-all duration-200",
                  active
                    ? "bg-primary/14 text-primary"
                    : "text-ink-3 group-hover:bg-surface-1 group-hover:text-ink",
                )}
              >
                <Icon
                  className="h-[19px] w-[19px]"
                  strokeWidth={active ? 2.2 : 1.9}
                />
              </span>
              <span
                className={cn(
                  "text-caption font-medium transition-colors duration-200",
                  active
                    ? "font-semibold text-primary"
                    : "text-ink-3 group-hover:text-ink-2",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/")}
          title="新建下载任务"
          className="group flex w-[68px] cursor-pointer flex-col items-center gap-1"
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-on-primary transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="text-caption font-semibold text-primary">新建</span>
        </button>
      </div>

      <div className="flex-1" />

      <div className="mb-4 flex flex-col items-center gap-1.5 text-caption font-medium text-ink-3">
        <ShieldCheck className="h-[17px] w-[17px] text-success" />
        本地引擎就绪
      </div>

      <button
        type="button"
        title="设置"
        aria-label="设置"
        aria-current={isActive("/settings") ? "page" : undefined}
        onClick={() => navigate("/settings")}
        className="group flex w-[68px] cursor-pointer flex-col items-center gap-1 rounded-2xl py-1"
      >
        <span
          className={cn(
            "grid h-[30px] w-14 place-items-center rounded-full transition-all duration-200",
            isActive("/settings")
              ? "bg-primary/14 text-primary"
              : "text-ink-3 group-hover:bg-surface-1 group-hover:text-ink",
          )}
        >
          <Settings
            className="h-[19px] w-[19px]"
            strokeWidth={isActive("/settings") ? 2.2 : 1.9}
          />
        </span>
        <span
          className={cn(
            "text-caption font-medium",
            isActive("/settings")
              ? "font-semibold text-primary"
              : "text-ink-3 group-hover:text-ink-2",
          )}
        >
          设置
        </span>
      </button>

      <span className="mt-3 text-mini font-semibold tracking-[0.14em] text-ink-3/70">
        V0.1
      </span>
    </aside>
  );
}

export function MobileNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-center justify-around border-t border-line bg-card/95 px-3 backdrop-blur-xl md:hidden">
      {ITEMS.map(({ to, label, icon: Icon }) => {
        const active = isActive(to);
        return (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            className={cn(
              "flex w-16 cursor-pointer flex-col items-center gap-1 text-caption font-medium",
              active ? "text-primary" : "text-ink-3",
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
            {label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex w-16 cursor-pointer flex-col items-center gap-1 text-caption font-semibold text-primary"
      >
        <span className="grid h-9 w-14 place-items-center rounded-full bg-primary text-on-primary">
          <Plus size={19} strokeWidth={2.4} />
        </span>
        新建
      </button>
      <button
        type="button"
        onClick={() => navigate("/settings")}
        className={cn(
          "flex w-16 cursor-pointer flex-col items-center gap-1 text-caption font-medium",
          isActive("/settings") ? "text-primary" : "text-ink-3",
        )}
      >
        <Settings size={20} strokeWidth={isActive("/settings") ? 2.3 : 1.9} />
        设置
      </button>
    </nav>
  );
}