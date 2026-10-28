import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

type Tone = "info" | "success" | "error";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const TONES: Record<Tone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: "text-success bg-success/10" },
  error: { icon: CircleAlert, className: "text-danger bg-danger/10" },
  info: { icon: Info, className: "text-primary bg-primary/10" },
};

const SnackbarContext = createContext<(message: string, tone?: Tone) => void>(
  () => undefined,
);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );
  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = Date.now() + Math.random();
      setToasts((items) => [...items.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 3800);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[120] flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
          role="status"
          aria-live="polite"
        >
          {toasts.map((toast) => {
            const tone = TONES[toast.tone];
            const Icon = tone.icon;
            return (
              <div
                key={toast.id}
                className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border border-line-strong bg-card/95 p-3 pr-2 shadow-float backdrop-blur-xl"
              >
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone.className}`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <p className="min-w-0 flex-1 whitespace-pre-line break-words pt-1.5 text-body-sm leading-relaxed text-ink">
                  {toast.message}
                </p>
                <button
                  type="button"
                  aria-label="关闭提示"
                  className="mt-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                  onClick={() => dismiss(toast.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  return useContext(SnackbarContext);
}