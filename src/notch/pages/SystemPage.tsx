import type { CSSProperties, ReactNode } from "react";

import { useModel } from "../../app/model";
import {
  DiskIcon,
  MemoryIcon,
  SystemIcon,
} from "../../ui/icons";
import { EmptyState } from "./EmptyState";

const GB = 1_000_000_000;

/**
 * System stats, in one section: CPU, RAM and storage as compact meters. The
 * Rust thread samples every 2 s; fills ease toward each new value instead of
 * jumping. A meter turns the danger color only when its resource is nearly
 * exhausted.
 */
export function SystemPage() {
  const system = useModel().system;

  if (!system) {
    return (
      <div className="page system-page">
        <EmptyState title="Reading the machine…" hint="One moment." />
      </div>
    );
  }

  return (
    <div className="page system-page">
      <StatRow
        icon={<SystemIcon />}
        label="CPU"
        ratio={system.cpuPercent / 100}
        value={`${Math.round(system.cpuPercent)}%`}
        title={`${system.cpuPercent.toFixed(0)}% processor in use`}
      />
      <StatRow
        icon={<MemoryIcon />}
        label="RAM"
        ratio={system.ramUsedBytes / Math.max(1, system.ramTotalBytes)}
        value={`${(system.ramUsedBytes / GB).toFixed(1)} of ${(system.ramTotalBytes / GB).toFixed(0)} GB`}
        danger={system.ramUsedBytes / system.ramTotalBytes > 0.9}
        title={`${(system.ramUsedBytes / GB).toFixed(1)} GB of ${(system.ramTotalBytes / GB).toFixed(0)} GB memory in use`}
      />
      <StatRow
        icon={<DiskIcon />}
        label="Disk"
        ratio={system.diskUsedBytes / Math.max(1, system.diskTotalBytes)}
        value={`${(system.diskUsedBytes / GB).toFixed(0)} of ${(system.diskTotalBytes / GB).toFixed(0)} GB`}
        danger={system.diskUsedBytes / system.diskTotalBytes > 0.9}
        title={`${(system.diskUsedBytes / GB).toFixed(0)} GB of ${(system.diskTotalBytes / GB).toFixed(0)} GB used on the system drive`}
      />
    </div>
  );
}

function StatRow({
  icon,
  label,
  ratio,
  value,
  title,
  danger,
}: {
  icon: ReactNode;
  label: string;
  ratio: number;
  value: string;
  title: string;
  danger?: boolean;
}) {
  return (
    <div className="stat-row" data-critical={danger || undefined} title={title}>
      <span className="stat-well" aria-hidden="true">
        {icon}
      </span>
      <span className="t-label stat-label">{label}</span>
      <span className="stat-meter" aria-hidden="true">
        <span
          className="stat-meter-fill"
          style={{ "--stat-p": Math.min(1, Math.max(0, ratio)).toFixed(4) } as CSSProperties}
        />
      </span>
      <span className="t-label stat-value tnum">{value}</span>
    </div>
  );
}
