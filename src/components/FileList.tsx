import { File, FileVideo2, FolderOpen } from "lucide-react";
import type { TorrentFileMeta } from "../api/types";
import { fileExtension, fileName, formatBytes } from "../lib/format";
import { cn } from "../lib/cn";
import { Chip, ProgressBar } from "./md";

export function FileList({
  files,
  onToggle,
  readOnly = false,
}: {
  files: TorrentFileMeta[];
  onToggle?: (idx: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="divide-y divide-line">
      {files.map((file) => (
        <div
          key={file.idx}
          className={cn(
            "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-1/60 sm:px-5",
            !file.included && readOnly && "opacity-55",
          )}
        >
          {!readOnly && (
            <input
              type="checkbox"
              checked={file.included}
              onChange={() => onToggle?.(file.idx)}
              aria-label={`选择 ${fileName(file.path)}`}
              className="size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
            />
          )}
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              file.isVideo
                ? "bg-secondary/12 text-secondary"
                : "bg-surface-2 text-ink-3",
            )}
          >
            {file.isVideo ? (
              <FileVideo2 className="h-[18px] w-[18px]" />
            ) : (
              <File className="h-[17px] w-[17px]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-body font-medium text-ink" title={file.path}>
                {fileName(file.path)}
              </p>
              <FolderOpen className="hidden shrink-0 text-ink-3 sm:block" size={12} />
            </div>
            <p
              className="mt-1 truncate text-caption tabular-nums text-ink-3"
              title={file.path}
            >
              {readOnly ? file.path : `${formatBytes(file.size)} · ${fileExtension(file.path)}`}
            </p>
            {readOnly && file.included && (
              <ProgressBar value={file.progress} className="mt-2 max-w-md" />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {readOnly && (
              <span className="w-11 text-right text-caption font-medium tabular-nums text-ink-2">
                {file.included ? `${Math.floor(file.progress * 100)}%` : "未选择"}
              </span>
            )}
            {!readOnly && (
              <Chip tone={file.isVideo ? "video" : "outline"}>
                {file.isVideo ? "视频" : fileExtension(file.path)}
              </Chip>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
