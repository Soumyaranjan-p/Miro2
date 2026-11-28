import { useEffect, useState, type CSSProperties } from "react";

import { formatTokens } from "../../app/format";
import { onUsageUpdate } from "../../ipc/client";
import { isTauri } from "../../ipc/client";
import { mockUsageState } from "../../ipc/mock";
import type { UsageState, UsageWindow } from "../../ipc/types";
import { EmptyState } from "./EmptyState";

const PROVIDER_NAMES: Record<string, string> = {
  zcode: "Zcode",
  opencode: "OpenCode",
  claude: "Claude Code",
  codex: "Codex",
  devin: "Devin",
};

interface WindowItem {
  provider: string;
  window: UsageWindow;
}

/**
 * AI usage, in the notch. The glance question is always the same — which
 * window is closest to its limit — so the most-constrained window leads as
 * the hero: name and percent at full size, a thick bar, its reset. Every
 * other window sits beneath as quiet context rows, sorted by the same
 * concern. The used/limit detail rides in each row's tooltip; no provider
 * detected means a short empty state, not an empty frame.
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

  const windows: WindowItem[] = active.flatMap((provider) =>
    provider.windows.map((window) => ({
      provider: PROVIDER_NAMES[provider.id] ?? provider.id,
      window,
    })),
  );

  const hero = windows.reduce((top, item) =>
    item.window.percent > top.window.percent ? item : top,
  );
  const rest = windows
    .filter((item) => item !== hero)
    .sort((a, b) => b.window.percent - a.window.percent);

  return (
    <div className="page usage-page">
      <HeroWindow item={hero} />
      {rest.map((item) => (
        <ContextRow key={`${item.provider}-${item.window.label}`} item={item} />
      ))}
    </div>
  );
}

function HeroWindow({ item }: { item: WindowItem }) {
  const { provider, window } = item;
  const percent = Math.min(100, Math.max(0, window.percent));
  const critical = percent > 90;
  const reset = resetLabel(window.resetsAt);

  return (
    <div
      className="usage-hero"
      data-critical={critical || undefined}
      title={detailTitle(window, reset)}
    >
      <div className="usage-hero-head">
        <span className="usage-hero-name">
          <span className="usage-provider">{provider}</span>
          <span className="usage-window">{window.label}</span>
        </span>
        {reset && (
          <span className="t-label usage-hero-reset tnum" aria-label={`resets ${reset}`}>
            {reset}
          </span>
        )}
        <span className="t-display usage-hero-pct tnum">
          {percent.toFixed(0)}%
        </span>
      </div>
      <span className="usage-hero-bar" aria-hidden="true">
        <span
          className="usage-hero-fill"
          style={{ "--p": (percent / 100).toFixed(4) } as CSSProperties}
        />
      </span>
    </div>
  );
}

function ContextRow({ item }: { item: WindowItem }) {
  const { provider, window } = item;
  const percent = Math.min(100, Math.max(0, window.percent));
  const critical = percent > 90;

  return (
    <div
      className="usage-row"
      data-critical={critical || undefined}
      title={detailTitle(window, resetLabel(window.resetsAt))}
    >
      <span className="usage-row-label t-label">
        <span className="usage-provider">{provider}</span>
        <span className="usage-window">{window.label}</span>
      </span>
      <span className="usage-row-bar" aria-hidden="true">
        <span
          className="usage-row-fill"
          style={{ "--p": (percent / 100).toFixed(4) } as CSSProperties}
        />
      </span>
      <span className="usage-row-pct t-label tnum">{percent.toFixed(0)}%</span>
    </div>
  );
}

/** Hover detail the glance surface leaves out: the real numbers. */
function detailTitle(usage: UsageWindow, reset: string): string {
  const base = `${formatTokens(usage.used)} of ${formatTokens(usage.limit)} used`;
  return reset ? `${base} · resets ${reset}` : base;
}

/** "in 51 min" / "in 3h" / "Mon, 3:53 PM"; empty when it never resets. */
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
