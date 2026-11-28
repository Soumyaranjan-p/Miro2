import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  getUsageSettings,
  onUsageUpdate,
  reportDockLayout,
} from "../ipc/client";
import { isTauri } from "../ipc/client";
import { mockUsageState } from "../ipc/mock";
import type { DockSide, InteractiveRect, UsageSettings, UsageState } from "../ipc/types";
import { Popover } from "./Popover";
import { Ring } from "./Ring";
import { SettingsPanel } from "./SettingsPanel";
import "./dock.css";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * The dock window's root: a slim provider ring strip pinned to one screen
 * edge, with hover popovers and a settings panel in the transparent area
 * beside it. Interactive rects are reported to Rust so the cursor thread can
 * keep the window click-through everywhere else.
 */
export function DockApp() {
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [settings, setSettings] = useState<UsageSettings>({
    providers: {},
    dockSide: "right",
  });
  const [hovered, setHovered] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ringRefs = useRef(new Map<string, HTMLElement>());
  const gearRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const [popTop, setPopTop] = useState(0);
  const [popAnchor, setPopAnchor] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void getUsageSettings().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });

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

  // Dev-only preview deep link: force a popover open for design review.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const preview = new URLSearchParams(window.location.search).get("dockPopover");
    if (preview) setHovered(preview);
  }, []);

  const registerRef = useCallback((id: string, element: HTMLElement | null) => {
    if (element) ringRefs.current.set(id, element);
    else ringRefs.current.delete(id);
  }, []);

  // Report interactive areas on any layout-affecting change so the Rust
  // cursor thread can flip click-through precisely.
  useLayoutEffect(() => {
    const rects: InteractiveRect[] = [];
    for (const element of ringRefs.current.values()) {
      const rect = element.getBoundingClientRect();
      rects.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    const gear = gearRef.current;
    if (gear) {
      const rect = gear.getBoundingClientRect();
      rects.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    if (settingsOpen && settingsRef.current) {
      const rect = settingsRef.current.getBoundingClientRect();
      rects.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    if (hovered && popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      rects.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    void reportDockLayout(rects);
  }, [hovered, settingsOpen, usage, settings]);

  // Position the popover level with the hovered ring, clamped to the window;
  // the arrow points at the ring's own center, wherever the card clamped.
  useLayoutEffect(() => {
    if (!hovered) return;
    const element = ringRefs.current.get(hovered);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    setPopTop(clamp(center - 70, 8, window.innerHeight - 150));
    setPopAnchor(center);
  }, [hovered]);

  const side: DockSide = settings.dockSide;
  const visibleProviders =
    usage?.providers.filter(
      (provider) => provider.present && provider.enabled && provider.windows.length > 0,
    ) ?? [];
  const hoveredProvider = visibleProviders.find((provider) => provider.id === hovered);

  return (
    <div className="dock-root" data-side={side}>
      <div className="dock-strip">
        <div className="dock-rings">
          {visibleProviders.map((provider) => (
            <Ring
              key={provider.id}
              provider={provider}
              side={side}
              hovered={hovered === provider.id && !settingsOpen}
              onHover={(id) => setHovered(settingsOpen ? null : id)}
              registerRef={registerRef}
            />
          ))}
          {visibleProviders.length === 0 && (
            <span className="dock-empty t-meta">No providers</span>
          )}
        </div>

        <button
          type="button"
          ref={gearRef}
          className="dock-gear"
          aria-label="Usage settings"
          aria-expanded={settingsOpen}
          onClick={() => {
            setSettingsOpen((open) => !open);
            setHovered(null);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {hoveredProvider && !settingsOpen && (
        <div ref={popoverRef}>
          <Popover
            provider={hoveredProvider}
            top={popTop}
            side={side}
            arrowTop={popAnchor - popTop}
          />
        </div>
      )}

      <div ref={settingsRef}>
        <SettingsPanel
          settings={settings}
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </div>
  );
}
