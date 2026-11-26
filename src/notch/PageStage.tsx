import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useModel } from "../app/model";
import {
  prefersReducedMotion,
  project,
  rubberband,
  Spring,
  springPresets,
} from "../motion/spring";
import type { PageId } from "../ipc/types";
import { FocusPage } from "./pages/FocusPage";
import { LyricsPage } from "./pages/LyricsPage";
import { MusicPage } from "./pages/MusicPage";
import { ShelfPage } from "./pages/ShelfPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodoPage } from "./pages/TodoPage";
import { WaterPage } from "./pages/WaterPage";

/** §10 — a gesture only commits to a direction past a small threshold. */
const DRAG_THRESHOLD_PX = 10;

function PageView({ page }: { page: PageId }) {
  switch (page) {
    case "music":
      return <MusicPage />;
    case "lyrics":
      return <LyricsPage />;
    case "focus":
      return <FocusPage />;
    case "water":
      return <WaterPage />;
    case "shelf":
      return <ShelfPage />;
    case "todo":
      return <TodoPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return null;
  }
}

interface DragState {
  active: boolean;
  captured: boolean;
  startX: number;
  moved: boolean;
  history: Array<{ t: number; x: number }>;
}

/**
 * The page strip is one continuous value, not a pair of keyframed layers.
 *
 * §3/§4 — a critically damped spring owns `cursor`; changing pages only
 * re-targets it, so a tab picked mid-slide never jumps. §2 — a swipe grabs the
 * spring where it is (`pause`) and tracks the pointer 1:1. §5 — release
 * velocity is handed to the spring. §6 — the landing page is chosen by
 * projecting that velocity, not by wherever the finger happened to stop.
 * §7/§8 — pages enter and leave along the same horizontal path, in the
 * direction the user chose. §11 — the per-frame work writes transform/opacity
 * straight to the DOM, so no React render happens during a gesture.
 */
export function PageStage() {
  const { page, setPage, snapshot } = useModel();

  const pages = useMemo(
    () =>
      snapshot.notch.pagesOrder.filter(
        (id) => id !== "clock" && !snapshot.notch.pagesHidden.includes(id),
      ),
    [snapshot.notch.pagesOrder, snapshot.notch.pagesHidden],
  );
  const index = Math.max(0, pages.indexOf(page));

  const stripRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<Array<HTMLDivElement | null>>([]);
  const springRef = useRef<Spring | null>(null);
  const cursorRef = useRef(index);
  const indexRef = useRef(index);
  const pagesRef = useRef(pages);
  const paintRef = useRef<(cursor: number) => void>(() => undefined);
  const reducedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<DragState>({
    active: false,
    captured: false,
    startX: 0,
    moved: false,
    history: [],
  });

  indexRef.current = index;
  pagesRef.current = pages;

  /** One spring value paints every slot: position, legibility, hit-testing. */
  const paint = useCallback((cursor: number) => {
    cursorRef.current = cursor;
    slotsRef.current.forEach((slot, i) => {
      if (!slot) return;
      const distance = Math.abs(i - cursor);
      slot.style.transform = `translate3d(${((i - cursor) * 100).toFixed(3)}%, 0, 0)`;
      slot.style.opacity = Math.max(0, Math.min(1, 1 - distance)).toFixed(3);
      slot.style.pointerEvents = distance < 0.5 ? "auto" : "none";
    });
  }, []);
  paintRef.current = paint;

  const bindStrip = useCallback(
    (node: HTMLDivElement | null) => {
      stripRef.current = node;
      springRef.current?.dispose();
      springRef.current = null;
      if (!node) return;

      reducedRef.current = prefersReducedMotion();
      paint(indexRef.current);
      if (!reducedRef.current) {
        springRef.current = new Spring(indexRef.current, springPresets.ui, (value) =>
          paintRef.current(value),
        );
      }
    },
    [paint],
  );

  // §14 — respond when the OS preference flips while the app is running.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      reducedRef.current = query.matches;
      if (query.matches) {
        springRef.current?.dispose();
        springRef.current = null;
        paint(cursorRef.current);
      } else if (!springRef.current) {
        springRef.current = new Spring(
          cursorRef.current,
          springPresets.ui,
          (value) => paintRef.current(value),
        );
        springRef.current.setTarget(indexRef.current);
      }
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [paint]);

  // A tab press re-targets the same spring — never a fresh fixed-duration
  // animation (§3). While a swipe owns the value, the gesture is authoritative.
  useEffect(() => {
    slotsRef.current.length = pages.length;
    if (dragRef.current.active) return;
    if (reducedRef.current) paint(index);
    else springRef.current?.setTarget(index);
  }, [index, pages.length, paint]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // A drag ended without a following click: do not swallow the next real tap.
    suppressClickRef.current = false;
    if (reducedRef.current) return;
    // Let a control's own gesture win (the scrubber has its own pointer capture).
    if (
      (event.target as HTMLElement).closest(
        "button, input, a, [role='slider'], .scrubber",
      )
    ) {
      return;
    }
    const drag = dragRef.current;
    drag.active = true;
    drag.captured = false;
    drag.moved = false;
    drag.startX = event.clientX;
    drag.history = [{ t: performance.now(), x: event.clientX }];
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active) return;

    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    if (!drag.moved) {
      // §2 — capture so tracking survives leaving the strip; §3 — grab the
      // spring at its current on-screen value instead of restarting it.
      drag.moved = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.captured = true;
      } catch {
        // §2 — capture keeps tracking outside the element; if the platform
        // refuses it, keep tracking inside instead of dropping the gesture.
      }
      springRef.current?.pause();
    }

    const width = stripRef.current?.getBoundingClientRect().width || 1;
    const max = pagesRef.current.length - 1;
    const raw = indexRef.current - dx / width;
    let cursor = raw;
    if (raw < 0) cursor = -rubberband(-raw * width, width) / width;
    else if (raw > max) {
      cursor = max + rubberband((raw - max) * width, width) / width;
    }
    paint(cursor);

    drag.history.push({ t: performance.now(), x: event.clientX });
    if (drag.history.length > 5) drag.history.shift();
  };

  const settle = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (drag.captured && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.active = false;
    if (!drag.moved) return;

    suppressClickRef.current = !cancelled;
    const width = stripRef.current?.getBoundingClientRect().width || 1;
    const samples = drag.history;
    let velocityPx = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const seconds = (last.t - first.t) / 1000;
      if (seconds > 0.002) velocityPx = (last.x - first.x) / seconds;
    }
    const velocity = -velocityPx / width; // cursor units per second

    // §6 — aim at the page nearest the projected resting point.
    const projected = cursorRef.current + project(velocity);
    const target = Math.min(
      pagesRef.current.length - 1,
      Math.max(0, Math.round(projected)),
    );

    if (!cancelled) setPage(pagesRef.current[target]);
    // §5 — resume from the finger's exact velocity, so there is no seam.
    springRef.current?.setTarget(
      cancelled ? indexRef.current : target,
      cancelled ? 0 : velocity,
    );
  };

  return (
    <div
      ref={bindStrip}
      className="page-stage"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => settle(event, false)}
      onPointerCancel={(event) => settle(event, true)}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      {pages.map((id, i) => (
        <div
          key={id}
          className="page-slot"
          style={{ "--i": i } as CSSProperties}
          ref={(node) => {
            slotsRef.current[i] = node;
          }}
          aria-hidden={i !== index}
          inert={i !== index ? true : undefined}
        >
          <PageView page={id} />
        </div>
      ))}
    </div>
  );
}
