import { useEffect, useState } from "react";

import { onUsageUpdate } from "../../ipc/client";
import { isTauri } from "../../ipc/client";
import { mockUsageState } from "../../ipc/mock";
import type { ProviderUsage, UsageState } from "../../ipc/types";
import { EmptyState } from "./EmptyState";

interface ProviderMeta {
  name: string;
  monogram: string;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  zcode: { name: "Zcode", monogram: "Z" },
  opencode: { name: "OpenCode", monogram: "O" },
  claude: { name: "Claude Code", monogram: "C" },
  codex: { name: "Codex", monogram: "X" },
  devin: { name: "Devin", monogram: "D" },
};

const CIRCUMFERENCE = 2 * Math.PI * 11;

/**
 * AI usage, in the notch: one compact card per provider the engine detects —
 * ring gauge on the left, name and per-window bars on the right. Data comes
 * from the same 60-second engine and notifications as everywhere else; no
 * provider detected means a short empty state, not an empty frame.
 */
export function UsagePage() {
  const [usage, setUsage] = useState<UsageState | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isTauri) {
      setUsage(mockUsageState());
      return () => {
        cancelled = true;
      };
    }

    const watch = onUsageUpdate((state) => setUsage(state));
    watch.then((stop) => {
      if (cancelled) stop();
    });
    return () => {
      cancelled = true;
      void watch.then((stop) => stop());
    };
  }, []);

  const active =
    usage?.providers.filter(
      (provider) =>
        provider.present &&
        provider.enabled &&
        provider.windows.length > 0,
    ) ?? [];

  if (!usage) {
    return (
      <div className="page usage-page">
        <EmptyState title="Reading usage…" hint="One moment." />
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="page usage-page">
        <EmptyState
          title="No AI usage detected"
          hint="Zcode, OpenCode, Claude or Codex activity lands here. Providers can be toggled in Settings."
        />
      </div>
    );
  }

  return (
    <div className="page usage-page">
      {active.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderUsage }) {
  const meta = PROVIDER_META[provider.id] ?? {
    name: provider.id,
    monogram: provider.id.charAt(0).toUpperCase(),
  };
  const primary = provider.windows[0];
  const percent = primary ? Math.min(100, Math.max(0, primary.percent)) : 0;
  const critical = percent > 90;

  return (
    <div className="usage-card" data-provider={provider.id}>
      <div className="usage-card-ring" data-critical={critical || undefined} aria-hidden="true">
        <svg viewBox="0 0 26 26">
          <circle className="usage-ring-track" cx="13" cy="13" r="11" />
          <circle
            className="usage-ring-fill"
            cx="13"
            cy="13"
            r="11"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            transform="rotate(-90 13 13)"
          />
        </svg>
        <span className="usage-ring-mark">{meta.monogram}</span>
      </div>

      <div className="usage-card-body">
        <p className="t-body usage-card-name">{meta.name}</p>
        {provider.windows.map((window) => (
          <div key={window.label} className="usage-row">
            <span className="usage-row-label t-meta">{window.label}</span>
            <span className="usage-row-bar" aria-hidden="true">
              <span
                className="usage-row-fill"
                data-critical={window.percent > 90 || undefined}
                style={{ width: `${Math.min(100, Math.max(0, window.percent))}%` }}
              />
            </span>
            <span className="usage-row-pct t-meta tnum">
              {window.percent.toFixed(0)}%
            </span>
            <span className="usage-row-reset t-meta">{resetLabel(window.resetsAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Resets in 51 min" / "Resets Thu, 8:22 AM". */
function resetLabel(iso: string): string {
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return "";
  const diffMinutes = (target - Date.now()) / 60_000;
  if (diffMinutes <= 0) return "Resetting…";
  if (diffMinutes < 60) return `in ${Math.max(1, Math.round(diffMinutes))} min`;
  if (diffMinutes < 10 * 60) {
    return `in ${Math.floor(diffMinutes / 60)}h`;
  }
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(target));
  return formatted;
}
