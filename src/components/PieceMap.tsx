import { useMemo } from "react";

function downloadedPieces(bitmap: string, total: number, progress: number) {
  if (!bitmap) return new Set(Array.from({ length: Math.floor(total * progress) }, (_, index) => index));
  try {
    const bytes = Uint8Array.from(atob(bitmap), (character) => character.charCodeAt(0));
    const result = new Set<number>();
    for (let index = 0; index < total; index += 1) {
      if ((bytes[Math.floor(index / 8)] & (1 << (7 - (index % 8)))) !== 0) result.add(index);
    }
    return result;
  } catch {
    return new Set<number>();
  }
}

export function PieceMap({ bitmap, totalPieces, progress }: { bitmap: string; totalPieces: number; progress: number }) {
  const pieces = useMemo(() => downloadedPieces(bitmap, totalPieces, progress), [bitmap, totalPieces, progress]);
  if (!totalPieces) return <div className="p-8 text-center text-sm text-ink-3">元数据就绪后显示分片分布</div>;
  const visiblePieces = Math.min(totalPieces, 512);
  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(10px, 1fr))" }}>
        {Array.from({ length: visiblePieces }, (_, index) => {
          const pieceIndex = Math.floor(index * totalPieces / visiblePieces);
          const complete = pieces.has(pieceIndex);
          return (
            <span
              key={index}
              title={`分片 ${pieceIndex + 1} · ${complete ? "已下载" : "等待下载"}`}
              className={`aspect-square rounded-[3px] ${complete ? "bg-primary" : "bg-surface-2"}`}
            />
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between text-[12px] text-ink-3">
        <span>{totalPieces.toLocaleString()} 个分片{totalPieces > visiblePieces ? ` · 合并为 ${visiblePieces} 格` : ""}</span>
        <span className="flex items-center gap-3"><span className="flex items-center gap-1.5"><i className="size-2 rounded-[1px] bg-primary" />已下载</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-[1px] bg-surface-2" />等待</span></span>
      </div>
    </div>
  );
}
