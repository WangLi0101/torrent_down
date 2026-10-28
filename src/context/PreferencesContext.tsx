import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { commands, errorMessage } from "../api/commands";
import type { Settings } from "../api/types";
import { applyTheme, useSystemDark } from "../hooks/useSettings";
import { useSnackbar } from "../hooks/useSnackbar";

interface PreferencesValue {
  settings?: Settings;
  loading: boolean;
  mode: "light" | "dark";
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  saveSettings: (next: Settings) => Promise<void>;
  toggleMode: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const notify = useSnackbar();
  const [settings, setSettings] = useState<Settings>();
  const [loading, setLoading] = useState(true);
  const systemDark = useSystemDark();

  const mode: "light" | "dark" =
    settings?.theme === "light"
      ? "light"
      : settings?.theme === "dark"
        ? "dark"
        : systemDark
          ? "dark"
          : "light";

  useEffect(() => {
    let cancelled = false;
    void commands
      .getSettings()
      .then((value) => {
        if (!cancelled) setSettings({ ...value, accent: value.accent ?? "violet" });
      })
      .catch((error) => {
        if (!cancelled) notify(errorMessage(error), "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notify]);

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme, settings.accent);
  }, [settings?.theme, settings?.accent, mode]);

  const saveSettings = useCallback(
    async (next: Settings) => {
      setSettings(next);
      try {
        await commands.setSettings(next);
      } catch (error) {
        notify(errorMessage(error), "error");
        throw error;
      }
    },
    [notify],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (!settings) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      try {
        await commands.setSettings(next);
      } catch (error) {
        notify(errorMessage(error), "error");
      }
    },
    [settings, notify],
  );

  const toggleMode = useCallback(() => {
    if (!settings) return Promise.resolve();
    const next = mode === "dark" ? "light" : "dark";
    return updateSettings({ theme: next });
  }, [mode, settings, updateSettings]);

  const value = useMemo(
    () => ({ settings, loading, mode, updateSettings, saveSettings, toggleMode }),
    [settings, loading, mode, updateSettings, saveSettings, toggleMode],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences 必须在 PreferencesProvider 内使用");
  }
  return context;
}