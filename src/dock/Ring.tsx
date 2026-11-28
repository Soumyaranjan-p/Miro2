import { metaFor } from "./meta";
import type { ProviderUsage } from "../ipc/types";

const CIRCUMFERENCE = 2 * Math.PI * 17;

interface RingProps {
  provider: ProviderUsage;
  side: "left" | "right";
  hovered: boolean;
  onHover: (id: string | null) => void;
  registerRef: (id: string, element: HTMLElement | null) => void;
}

/**
 * One circular gauge per provider: ring fill = percent used, provider
 * monogram in the center, percentage below. The fill animates via a CSS
 * transition on stroke-dashoffset — usage ticks once a minute, so a smooth
 * settle reads better than a hard jump.
 */
export function Ring({ provider, side, hovered, onHover, registerRef }: RingProps) {
  const meta = metaFor(provider);
  const window = provider.windows[0];
  const percent = window ? Math.min(100, Math.max(0, window.percent)) : 0;
  const critical = percent > 90;

  return (
    <button
      type="button"
      ref={(element) => registerRef(provider.id, element)}
      className="dock-ring"
      data-provider={provider.id}
      data-critical={critical || undefined}
      data-hovered={hovered || undefined}
      onMouseEnter={() => onHover(provider.id)}
      onMouseLeave={() => onHover(null)}
      aria-label={`${meta.name} usage ${Math.round(percent)} percent`}
    >
      <svg className="dock-ring-svg" viewBox="0 0 40 40" aria-hidden="true">
        <circle className="dock-ring-track" cx="20" cy="20" r="17" />
        <circle
          className="dock-ring-fill"
          cx="20"
          cy="20"
          r="17"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
          transform={`rotate(-90 20 20)`}
          data-side={side}
        />
      </svg>
      <span className="dock-ring-mark" aria-hidden="true">
        {meta.monogram}
      </span>
      <span className="dock-ring-pct tnum" aria-hidden="true">
        {Math.round(percent)}%
      </span>
    </button>
  );
}
