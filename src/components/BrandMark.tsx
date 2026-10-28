import { useId } from "react";

export function BrandMark({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const backgroundId = `brand-bg-${uid}`;
  const arrowId = `brand-arrow-${uid}`;

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={backgroundId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--secondary)" />
        </linearGradient>
        <linearGradient id={arrowId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--secondary)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${backgroundId})`} />
      <circle cx="53" cy="11" r="17" fill="var(--on-primary)" opacity="0.1" />
      <circle cx="10" cy="56" r="19" fill="var(--on-primary)" opacity="0.07" />
      <circle
        cx="30"
        cy="30"
        r="15.5"
        fill="none"
        stroke="var(--on-primary)"
        strokeOpacity="0.28"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="73 24"
        transform="rotate(-90 30 30)"
      />
      <path
        d="M25.5 22.6c0-2 2.2-3.2 3.9-2.2l12.2 7.4c1.7 1 1.7 3.5 0 4.5l-12.2 7.4c-1.7 1-3.9-.2-3.9-2.2z"
        fill="var(--on-primary)"
      />
      <circle cx="47.5" cy="47.5" r="9.5" fill="var(--on-primary)" />
      <path
        d="M47.5 42.5v8.4m-3.4-3.4 3.4 3.5 3.4-3.5"
        fill="none"
        stroke={`url(#${arrowId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
