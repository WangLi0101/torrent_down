import { useEffect, useState } from "react";
import type { AccentId, ThemeMode } from "../api/types";

export const THEME_CACHE_KEY = "torrnet-theme";
export const ACCENT_CACHE_KEY = "torrnet-accent";

export function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveMode(theme: ThemeMode): "light" | "dark" {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

/** 将主题与强调色写入根节点，同时缓存一份用于首屏无闪烁渲染。 */
export function applyTheme(theme: ThemeMode, accent: AccentId = "violet") {
  const mode = resolveMode(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.accent = accent;
  root.style.colorScheme = mode;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", mode === "dark" ? "#0C0C11" : "#F6F5FB");
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
    localStorage.setItem(ACCENT_CACHE_KEY, accent);
  } catch {
    // 浏览器隐私模式下缓存不可用，忽略即可。
  }
}

export function useSystemDark() {
  const [dark, setDark] = useState(systemPrefersDark);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return dark;
}