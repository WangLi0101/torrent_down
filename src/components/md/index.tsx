import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "../../lib/cn";

type ButtonVariant =
  | "filled"
  | "tonal"
  | "text"
  | "outlined"
  | "soft"
  | "danger";

export function Button({
  variant = "filled",
  size = "md",
  className = "",
  type = "button",
  loading = false,
  fullWidth = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  fullWidth?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    filled:
      "bg-primary text-on-primary hover:bg-primary-hover disabled:bg-surface-3 disabled:text-ink-2",
    tonal: "bg-primary/10 text-primary hover:bg-primary/15 disabled:opacity-45",
    text: "text-primary hover:bg-primary/8 disabled:opacity-45",
    outlined:
      "border border-line-strong bg-card/50 text-ink hover:border-ink-3/40 hover:bg-surface-1 disabled:opacity-45",
    soft: "bg-surface-1 text-ink hover:bg-surface-2 disabled:opacity-45",
    danger: "text-danger hover:bg-danger/10 disabled:opacity-45",
  };
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-200",
        "active:scale-[0.985] disabled:pointer-events-none",
        size === "sm"
          ? "h-9 gap-1.5 rounded-xl px-3 text-label"
          : "h-11 gap-2 rounded-xl px-4 text-body leading-none",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-ink-2 transition-all duration-200",
        "hover:bg-surface-1 hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-4xl border border-line bg-card shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-4xl border border-line bg-card shadow-card",
        className,
      )}
    >
      <div className={cn("p-5 sm:p-6", bodyClassName)}>
        {(title || action) && (
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
              {icon && (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="text-title text-ink">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-body-sm text-ink-2">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {action && <div className="ml-auto shrink-0">{action}</div>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Chip({
  children,
  tone = "outline",
  className,
  icon,
}: {
  children: ReactNode;
  tone?: "outline" | "video" | "primary" | "success" | "warning" | "error";
  className?: string;
  icon?: ReactNode;
}) {
  const tones = {
    outline: "border-line-strong text-ink-2",
    video: "border-transparent bg-secondary/12 text-secondary",
    primary: "border-transparent bg-primary/12 text-primary",
    success: "border-transparent bg-success/12 text-success",
    warning: "border-transparent bg-warning/12 text-warning",
    error: "border-transparent bg-danger/12 text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2 text-caption font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  buffered,
  className = "",
}: {
  value: number;
  buffered?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-1.5 overflow-hidden rounded-full bg-surface-2",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      {buffered !== undefined && (
        <div
          className="absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-500"
          style={{ width: `${Math.min(100, buffered * 100)}%` }}
        />
      )}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (dismissible) onCloseRef.current();
      }
      if (event.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex="0"]',
      );
      if (!items?.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, dismissible]);

  if (!open) return null;
  // Keep the overlay outside animated page containers, whose transforms constrain fixed positioning.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm"
      onMouseDown={(event) => dismissible && event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="animate-scale-in max-h-[calc(100dvh-2.5rem)] w-full max-w-md overflow-y-auto rounded-4xl border border-line bg-card p-6 shadow-float outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id={titleId}
              className="text-page-title text-ink"
            >
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-2 text-body leading-6 text-ink-2">{description}</p>
            )}
          </div>
          <IconButton label="关闭" onClick={onClose} disabled={!dismissible} className="-mr-2 -mt-2">
            <X size={19} />
          </IconButton>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-primary/25 border-t-primary"
      style={{ width: size, height: size }}
      aria-label="加载中"
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-title font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-body-sm leading-6 text-ink-2">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
  trailing,
}: {
  children: ReactNode;
  htmlFor?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <label
        htmlFor={htmlFor}
        className="text-label text-ink-2"
      >
        {children}
      </label>
      {trailing}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-2xl border border-line bg-surface-1/70 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-label transition-all duration-200",
              active
                ? "bg-card text-ink shadow-sm ring-1 ring-line"
                : "text-ink-2 hover:bg-card/50 hover:text-ink",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:opacity-45",
        checked
          ? "border-transparent bg-primary"
          : "border-line-strong bg-surface-2",
      )}
    >
      <span
        className={cn(
          "pointer-events-none rounded-full bg-white shadow-sm transition-transform duration-200",
          checked
            ? "h-[20px] w-[20px] translate-x-[22px]"
            : "h-[18px] w-[18px] translate-x-[4px]",
        )}
      />
    </button>
  );
}

export function TextInput({
  className = "",
  leading,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode }) {
  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
          {leading}
        </span>
      )}
      <input
        className={cn(
          "h-11 w-full rounded-xl bg-surface-1/70 px-3.5 text-body-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink-3 hover:bg-surface-1 focus:bg-card",
          leading ? "pl-10" : "",
          className,
        )}
        {...props}
      />
    </div>
  );
}
