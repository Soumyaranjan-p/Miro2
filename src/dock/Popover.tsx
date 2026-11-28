import { formatCompact, formatResets } from "./format";
import { metaFor } from "./meta";
import type { CSSProperties } from "react";
import type { ProviderUsage } from "../ipc/types";

interface PopoverProps {
  provider: ProviderUsage;
  top: number;
  side: "left" | "right";
  /** Distance from the popover's top to the hovered ring's center. */
  arrowTop: number;
}

/**
 * The hover card: "<Provider> Usage" plus one row per measured window —
 * label, reset time, thin bar, "N% Used". Fades in/out via CSS opacity and
 * is positioned by DockApp next to the hovered ring.
 */
export function Popover({ provider, top, side, arrowTop }: PopoverProps) {
  const meta = metaFor(provider);

  return (
    <div
      className="dock-pop"
      data-side={side}
      style={{ top, "--arrow-top": `${arrowTop}px` } as CSSProperties}
      role="tooltip"
    >
      <div className="dock-pop-head">
        <span className="dock-pop-mark" data-provider={provider.id} aria-hidden="true">
          {meta.monogram}
        </span>
        <span className="dock-pop-title">{meta.name} Usage</span>
      </div>

      {provider.windows.map((window) => (
        <div key={window.label} className="dock-pop-row">
          <div className="dock-pop-line">
            <span className="dock-pop-label">{window.label}</span>
            <span className="dock-pop-reset t-meta">{formatResets(window.resetsAt)}</span>
          </div>
          <div className="dock-pop-track">
            <div
              className="dock-pop-bar"
              data-critical={window.percent > 90 || undefined}
              style={{ width: `${Math.min(100, Math.max(0, window.percent))}%` }}
            />
          </div>
          <div className="dock-pop-line">
            <span className="dock-pop-used">{window.percent.toFixed(0)}% Used</span>
            {window.limit > 0 && (
              <span className="dock-pop-total t-meta tnum">
                {formatCompact(window.used)} / {formatCompact(window.limit)}
              </span>
            )}
          </div>
        </div>
      ))}

      {provider.windows.length === 0 && (
        <div className="dock-pop-row">
          <span className="dock-pop-label">No readable usage yet</span>
        </div>
      )}
    </div>
  );
}
