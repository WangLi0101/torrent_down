import { Activity, RotateCcw } from "lucide-react";
import type { TaskDetail } from "../api/types";
import { formatBytes, formatSpeed } from "../lib/format";
import { Button, SectionCard } from "./md";

export function NetworkStatus({ detail, busy, onReconnect }: {
  detail: TaskDetail;
  busy: boolean;
  onReconnect: () => void;
}) {
  const network = detail.network;
  const downloading = detail.state === "Downloading";
  const stalled = downloading && (network.idleSeconds ?? 0) >= 30;
  let message = "正在等待节点传输文件数据，节点速率将在下一次采样后更新。";
  if (detail.state === "Paused") {
    message = "任务已暂停，继续下载后开始观察节点传输。";
  } else if (detail.state === "Error") {
    message = detail.error ?? "任务发生错误，请检查网络后重试。";
  } else if (detail.state === "Seeding") {
    message = "所选文件已下载完成，正在做种。";
  } else if (!network.available) {
    message = "正在等待下载引擎的连接统计。";
  } else if (stalled) {
    message = detail.peers > 0
      ? `已连续 ${network.idleSeconds} 秒未收到文件数据。连接成功不代表对方能提供分片，可尝试重新连接并检查网络。`
      : `已连续 ${network.idleSeconds} 秒未收到文件数据，正在寻找可用节点。可检查网络或尝试重新连接。`;
  } else if (network.transferringPeers > 0) {
    message = "正在接收文件数据，完整分片校验后会计入下载进度。";
  }
  const stats: [string, number][] = [
    ["发现节点", network.seenPeers],
    ["正在连接", network.connectingPeers],
    ["实际传输", network.transferringPeers],
    ["失效节点", network.failedPeers],
  ];

  return (
    <SectionCard
      title="连接与传输"
      subtitle="每 2 秒更新，区分连接数与实际文件传输"
      icon={<Activity className="h-[18px] w-[18px]" />}
      action={
        <Button variant="outlined" disabled={!downloading || busy} onClick={onReconnect}>
          <RotateCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          重新连接
        </Button>
      }
    >
      <p role="status" className={`rounded-xl px-3 py-3 text-body-sm leading-6 ${stalled ? "bg-warning/10 text-ink" : "bg-surface-1 text-ink-2"}`}>
        {message}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-1 p-3">
            <dt className="text-caption text-ink-3">{label}</dt>
            <dd className="mt-1 text-body font-semibold tabular-nums text-ink">{network.available ? value : "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-caption leading-5 text-ink-3">
        本次运行已接收 {formatBytes(network.receivedBytes)} · DHT 网络节点 {network.dhtNodes}
        {network.queuedPeers > 0 && ` · ${network.queuedPeers} 个节点等待连接`}
      </p>
      {network.peers.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {network.peers.slice(0, 6).map((peer, index) => (
            <div key={index} className="flex items-center justify-between gap-3 text-caption">
              <div className="min-w-0">
                <p className="truncate text-ink-2" title={peer.clientName}>{peer.clientName}</p>
                <p className="text-ink-3">{peer.connection} · 已接收 {formatBytes(peer.receivedBytes)}</p>
              </div>
              <span className="shrink-0 tabular-nums text-primary">
                {peer.downSpeed > 0 ? formatSpeed(peer.downSpeed) : "等待数据"}
              </span>
            </div>
          ))}
          {network.peers.length > 6 && (
            <p className="text-caption text-ink-3">另有 {network.peers.length - 6} 个已连接节点</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
