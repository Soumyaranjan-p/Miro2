import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { LucideProps } from "lucide-react";

import { formatDuration } from "../app/format";
import { useModel } from "../app/model";
import { PAGE_LABELS } from "../app/pages";
import type { MediaState, PageId } from "../ipc/types";
import { FocusPage } from "./pages/FocusPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ShelfPage } from "./pages/ShelfPage";
import { SystemPage } from "./pages/SystemPage";
import { TodoPage } from "./pages/TodoPage";
import { UsagePage } from "./pages/UsagePage";
import { WaterPage } from "./pages/WaterPage";
import { WidgetsPage } from "./pages/WidgetsPage";
import {
  FocusIcon,
  MusicIcon,
  SettingsIcon,
  ShelfIcon,
  SystemIcon,
  TodoIcon,
  UsageIcon,
  WaterIcon,
  WidgetsIcon,
} from "../ui/icons";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const PAGE_ICONS: Record<PageId, ComponentType<LucideProps>> = {
  clock: MusicIcon,
  music: MusicIcon,
  widgets: WidgetsIcon,
  usage: UsageIcon,
  focus: FocusIcon,
  water: WaterIcon,
  shelf: ShelfIcon,
  todo: TodoIcon,
  system: SystemIcon,
  settings: SettingsIcon,
};

function IslandPageView({
  id,
  media,
  live,
}: {
  id: PageId;
  media: MediaState | null;
  live: boolean;
}): ReactNode {
  switch (id) {
    case "music":
      return <MediaPage media={media} live={live} />;
    case "widgets":
      return <WidgetsPage />;
    case "usage":
      return <UsagePage />;
    case "focus":
      return <FocusPage />;
    case "water":
      return <WaterPage />;
    case "shelf":
      return <ShelfPage />;
    case "todo":
      return <TodoPage />;
    case "system":
      return <SystemPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return null;
  }
}

/**
 * The Dynamic Island notch: one black shell morphing between collapsed
 * (ring · time · visualizer) and expanded (header · pages · icon tabs). The
 * morph is the shell's own spring value --t, so width, height and radius
 * move as one continuous animation and stay interruptible mid-flight.
 * Media comes from the system media session, battery from the power thread,
 * and every page of the app lives in the swipeable strip — the icon row
 * doubles as wayfinding and tap-to-jump navigation.
 */
export function Island() {
  const { snapshot, clock, page } = useModel();
  const media = snapshot.media;
  const pages = snapshot.notch.pagesOrder.filter(
    (id) => id !== "clock" && !snapshot.notch.pagesHidden.includes(id),
  );
  const [pageIndex, setPageIndex] = useState(() =>
    Math.max(0, pages.indexOf(page)),
  );

  useEffect(() => {
    const index = pages.indexOf(page);
    if (index >= 0) setPageIndex(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const playing = media?.playing ?? false;
  const time = `${String(clock.getHours()).padStart(2, "0")}:${String(
    clock.getMinutes(),
  ).padStart(2, "0")}`;
  const date = dateFmt.format(clock).replace(", ", " ");

  return (
    <>
      <div className="island-collapsed" aria-hidden="true">
        <BatteryRing />
        <span className="island-clock-collapsed">{time}</span>
        <Visualizer playing={playing} />
      </div>

      <div className="island-expanded">
        <header className="island-header island-row" style={{ "--row": 0 } as CSSProperties}>
          <div className="island-header-left">
            <BatteryRing />
            <span className="island-date">{date}</span>
            <span className="island-time">{time}</span>
          </div>
          <Visualizer playing={playing} />
        </header>

        <div className="island-strip-clip island-row" style={{ "--row": 1 } as CSSProperties}>
          <PageStrip pageIndex={pageIndex} pageCount={pages.length} setPageIndex={setPageIndex}>
            {pages.map((id) => (
              <IslandPageSlot key={id} id={id} media={media} live={isLive(media)} />
            ))}
          </PageStrip>
        </div>

        <footer
          className="island-tabs island-row"
          style={{ "--row": 2 } as CSSProperties}
        >
          {pages.map((id, i) => {
            const Icon = PAGE_ICONS[id] ?? MusicIcon;
            return (
              <button
                key={id}
                type="button"
                className="island-tab"
                data-active={i === pageIndex ? "true" : undefined}
                aria-label={PAGE_LABELS[id]}
                aria-current={i === pageIndex ? "page" : undefined}
                onClick={() => setPageIndex(i)}
              >
                <Icon />
              </button>
            );
          })}
        </footer>
      </div>
    </>
  );
}

function IslandPageSlot({
  id,
  media,
  live,
}: {
  id: PageId;
  media: MediaState | null;
  live: boolean;
}) {
  return (
    <section className="island-page" aria-label={PAGE_LABELS[id]}>
      <IslandPageView id={id} media={media} live={live} />
    </section>
  );
}

/* ── battery ring ── */

function BatteryRing() {
  const { power } = useModel();
  const radius = 8; // (18 − 2) / 2
  const circumference = 2 * Math.PI * radius;
  const percent = power?.batteryPercent ?? null;
  const charging = power?.charging ?? false;
  const offset = circumference * (1 - clamp01((percent ?? 0) / 100));

  return (
    <div className="island-ring" aria-hidden="true">
      <svg viewBox="0 0 18 18">
        <circle cx="9" cy="9" r={radius} className="island-ring-track" />
        <circle
          cx="9"
          cy="9"
          r={radius}
          className="island-ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="island-bolt" data-charging={charging ? "true" : undefined}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
        </svg>
      </span>
    </div>
  );
}

/* ── audio visualizer ── */

const VIZ_PROFILE = [8, 12, 6, 14, 9];
const VIZ_DURATION = [900, 760, 1040, 680, 860];
const VIZ_DELAY = [-320, -610, -140, -480, -220];

function Visualizer({ playing }: { playing: boolean }) {
  return (
    <div className="island-visualizer" data-playing={playing ? "true" : undefined} aria-hidden="true">
      {VIZ_PROFILE.map((height, i) => (
        <i
          key={i}
          style={
            {
              "--h": `${height}px`,
              "--d": `${VIZ_DURATION[i]}ms`,
              animationDelay: `${VIZ_DELAY[i]}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ── page strip: swipe with momentum; horizontal wheel flips pages so
   scrollable pages (usage) keep their vertical wheel ── */

function PageStrip({
  pageIndex,
  pageCount,
  setPageIndex,
  children,
}: {
  pageIndex: number;
  pageCount: number;
  setPageIndex: (index: number) => void;
  children: ReactNode;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef({
    active: false,
    moved: false,
    startX: 0,
    startIndex: 0,
    history: [] as Array<{ t: number; x: number }>,
  });
  const wheelLock = useRef(0);
  const lastIndex = pageCount - 1;

  const clampIndex = useCallback(
    (index: number) => Math.min(lastIndex, Math.max(0, index)),
    [lastIndex],
  );

  const rubberband = (distance: number) => {
    const d = Math.abs(distance);
    return Math.sign(distance) * ((d * 160 * 0.55) / (160 + 0.55 * d));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input, .island-progress-track")) return;
    const state = drag.current;
    state.active = true;
    state.moved = false;
    state.startX = event.clientX;
    state.startIndex = pageIndex;
    state.history = [{ t: performance.now(), x: event.clientX }];
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state.active) return;
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dx) < 10) return;
    if (!state.moved) {
      state.moved = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // §2 — capture keeps tracking outside the strip; if the platform
        // refuses it, keep tracking inside instead of dropping the gesture.
      }
      if (stripRef.current) stripRef.current.dataset.dragging = "true";
    }

    const pageWidth = (stripRef.current?.getBoundingClientRect().width ?? 1) / pageCount;
    let offset = dx;
    const atStart = state.startIndex === 0 && dx > 0;
    const atEnd = state.startIndex === lastIndex && dx < 0;
    if (atStart || atEnd) offset = rubberband(dx);
    const progress = state.startIndex - offset / pageWidth;
    stripRef.current?.style.setProperty("--page", progress.toFixed(4));
    if (stripRef.current) stripRef.current.dataset.dragging = "true";

    state.history.push({ t: performance.now(), x: event.clientX });
    if (state.history.length > 5) state.history.shift();
  };

  const settle = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = drag.current;
    if (!state.active) return;
    state.active = false;
    if (stripRef.current) {
      if (stripRef.current.hasPointerCapture?.(event.pointerId)) {
        stripRef.current.releasePointerCapture(event.pointerId);
      }
      stripRef.current.dataset.dragging = "false";
    }
    if (!state.moved) return;

    let velocity = 0;
    if (state.history.length >= 2) {
      const first = state.history[0];
      const last = state.history[state.history.length - 1];
      const seconds = (last.t - first.t) / 1000;
      if (seconds > 0.002) velocity = (last.x - first.x) / seconds;
    }

    // §6 — land on the page nearest the projected resting point; a cancelled
    // gesture returns to the page it started on.
    if (cancelled) {
      setPageIndex(state.startIndex);
      return;
    }
    const pageWidth = (stripRef.current?.getBoundingClientRect().width ?? 1) / pageCount;
    const releasePages = (event.clientX - state.startX) / pageWidth;
    const momentumPages = ((velocity / 1000) * (0.998 / (1 - 0.998))) / pageWidth;
    setPageIndex(clampIndex(state.startIndex - releasePages - momentumPages));
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    if (Math.abs(event.deltaX) < 25) return;
    const now = performance.now();
    if (now - wheelLock.current < 450) return;
    wheelLock.current = now;
    setPageIndex(clampIndex(pageIndex + (event.deltaX > 0 ? 1 : -1)));
  };

  return (
    <div
      ref={stripRef}
      className="island-strip"
      data-dragging="false"
      /* The settled page lives here; a drag rewrites --page imperatively
         while it owns the value, and this syncs again once it settles. */
      style={
        { "--page": pageIndex, "--i-pages": pageCount } as CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => settle(event, false)}
      onPointerCancel={(event) => settle(event, true)}
      onWheel={onWheel}
    >
      {children}
    </div>
  );
}

/* ── page 1: media ── */

function isLive(media: MediaState | null): boolean {
  return media != null && media.durationMs <= 0;
}

function MediaPage({
  media,
  live,
}: {
  media: MediaState | null;
  live: boolean;
}) {
  const { togglePlay, seek, nextTrack, previousTrack } = useModel();
  const trackRef = useRef<HTMLDivElement>(null);
  const seeking = useRef(false);

  const duration = media?.durationMs ?? 0;
  const position = media?.positionMs ?? 0;
  const ratio = duration > 0 ? clamp01(position / duration) : 0;

  const ratioAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  };

  const applySeek = (clientX: number) => {
    if (duration <= 0) return;
    seek(ratioAt(clientX) * duration);
  };

  const hue = trackHue(media?.title ?? "");

  return (
    <div className="island-media-wrap">
      <div className="island-media-row">
        <div className="island-artwork" data-has-art={media ? "true" : undefined} aria-hidden="true">
          <span
            className="island-art-gradient"
            style={
              media
                ? ({
                    background: `linear-gradient(135deg, hsl(${hue} 32% 22%), hsl(${(hue + 40) % 360} 38% 42%))`,
                  } as CSSProperties)
                : undefined
            }
          />
          {media?.artworkUrl && <img src={media.artworkUrl} alt="" />}
          {!media && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          )}
        </div>
        <div className="island-media-text">
          <span className="island-track-title" data-idle={media ? undefined : "true"}>
            {media ? media.title : "Not Playing"}
          </span>
          <span className="island-track-artist">{media?.artist ?? ""}</span>
        </div>
      </div>

      {live ? (
        <div className="island-live" role="status" aria-label="Live stream">
          <span className="island-live-pill">
            <span className="island-live-dot" aria-hidden="true" />
            Live
          </span>
        </div>
      ) : (
        <div className="island-progress">
          <span className="island-progress-time">{formatDuration(position)}</span>
          <div
            ref={trackRef}
            className="island-progress-track"
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuetext={`${formatDuration(position)} of ${formatDuration(duration)}`}
            aria-disabled={media ? undefined : "true"}
            onPointerDown={(event) => {
              if (!media) return;
              event.preventDefault();
              seeking.current = true;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Track inside the strip; the seek still paints 1:1.
              }
              applySeek(event.clientX);
            }}
            onPointerMove={(event) => {
              if (!seeking.current || !media) return;
              applySeek(event.clientX);
            }}
            onPointerUp={(event) => {
              if (!seeking.current) return;
              seeking.current = false;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              applySeek(event.clientX);
            }}
            onKeyDown={(event) => {
              if (!media) return;
              if (event.key === "ArrowRight") seek(position + 5000);
              else if (event.key === "ArrowLeft") seek(position - 5000);
              else if (event.key === "Home") seek(0);
              else if (event.key === "End") seek(duration - 1);
              else return;
              event.preventDefault();
            }}
          >
            <div className="island-progress-rail">
              <div
                className="island-progress-fill"
                style={{ "--p": ratio.toFixed(4) } as CSSProperties}
              />
            </div>
          </div>
          <span className="island-progress-time" data-remaining="true">
            -{formatDuration(Math.max(0, duration - position))}
          </span>
        </div>
      )}

      <div className="island-controls">
        <button className="island-control-side" aria-label="Lyrics">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>

        <div className="island-controls-main">
          <button className="island-transport" aria-label="Previous track" onClick={previousTrack}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 5v14l-9.5-7L19 5zM6 5h2.4v14H6z" />
            </svg>
          </button>
          <button
            className="island-transport"
            aria-label={media?.playing ? "Pause" : "Play"}
            data-playing={media?.playing ? "true" : undefined}
            onClick={togglePlay}
          >
            <svg className="island-glyph island-glyph-play" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11-7.2a1 1 0 0 0 0-1.7l-11-7.3c-.7-.4-1.6.1-1.6.9z" />
            </svg>
            <svg className="island-glyph island-glyph-pause" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4.5" width="3.6" height="15" rx="1.1" />
              <rect x="14.4" y="4.5" width="3.6" height="15" rx="1.1" />
            </svg>
          </button>
          <button className="island-transport" aria-label="Next track" onClick={nextTrack}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 5l9.5 7L5 19V5zM15.6 5H18v14h-2.4z" />
            </svg>
          </button>
        </div>

        <button className="island-control-side" aria-label="Volume">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Deterministic artwork stand-in while SMTC ships no poster. */
function trackHue(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}
