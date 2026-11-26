import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
} from "react";

import { formatDuration } from "../../app/format";
import { Spring, rubberband, springPresets } from "../../motion/spring";

interface ScrubberProps {
  positionMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * §2 — 1:1 tracking with pointer capture and the grab offset respected.
 * §5 — release velocity is handed to the spring that settles the value.
 * §9 — dragging past either end rubber-bands instead of hard-stopping.
 *
 * There is deliberately no momentum projection on release: §6 projects a
 * resting point to pick between snap targets, and a seek bar has none. The
 * projection would seek past where the user let go, which would be dishonest.
 */
export function Scrubber({ positionMs, durationMs, onSeek }: ScrubberProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const springRef = useRef<Spring | null>(null);
  const displayRef = useRef(0);
  const draggingRef = useRef(false);
  const settlingRef = useRef(false);
  const historyRef = useRef<Array<{ t: number; x: number }>>([]);
  const grabRef = useRef({ startX: 0, startTime: 0, moved: false });
  const [dragging, setDragging] = useState(false);

  const paint = useCallback(
    (ratio: number) => {
      displayRef.current = ratio;

      const root = rootRef.current;
      if (root) root.style.setProperty("--p", ratio.toFixed(5));

      const clamped = clamp01(ratio);
      const elapsed = clamped * durationMs;

      if (elapsedRef.current) {
        elapsedRef.current.textContent = formatDuration(elapsed);
      }
      if (remainingRef.current) {
        remainingRef.current.textContent = `-${formatDuration(
          Math.max(0, durationMs - elapsed),
        )}`;
      }

      const track = trackRef.current;
      if (track) {
        track.setAttribute("aria-valuenow", String(Math.round(clamped * 100)));
        track.setAttribute(
          "aria-valuetext",
          `${formatDuration(elapsed)} of ${formatDuration(durationMs)}`,
        );
      }
    },
    [durationMs],
  );

  // Follow the media clock unless the user is holding or settling the value.
  useEffect(() => {
    if (draggingRef.current || settlingRef.current) return;
    paint(durationMs > 0 ? positionMs / durationMs : 0);
  }, [positionMs, durationMs, paint]);

  useEffect(
    () => () => {
      springRef.current?.dispose();
      springRef.current = null;
    },
    [],
  );

  const ratioAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return (clientX - rect.left) / rect.width;
  };

  const finish = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);

    const width = trackRef.current?.getBoundingClientRect().width ?? 1;
    const samples = historyRef.current;
    let velocity = 0;

    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const seconds = (last.t - first.t) / 1000;
      if (seconds > 0.002) velocity = (last.x - first.x) / seconds;
    }

    const released = displayRef.current;
    const target = clamp01(released);

    // Only a rubber-banded release has somewhere to spring back to.
    if (released !== target) {
      settlingRef.current = true;
      springRef.current?.dispose();
      const spring = new Spring(released, springPresets.momentum, paint);
      springRef.current = spring;
      spring.setTarget(target, velocity / width);
      window.setTimeout(() => {
        settlingRef.current = false;
      }, 450);
    }

    onSeek(target * durationMs);
  }, [durationMs, onSeek, paint]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!durationMs) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    springRef.current?.dispose();
    springRef.current = null;
    settlingRef.current = false;
    draggingRef.current = true;
    setDragging(true);

    const now = performance.now();
    grabRef.current = { startX: event.clientX, startTime: now, moved: false };
    historyRef.current = [{ t: now, x: event.clientX }];

    // A slider moves to the press point; from there the thumb tracks 1:1.
    paint(clamp01(ratioAt(event.clientX)));
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;

    const raw = ratioAt(event.clientX);
    const overshoot = raw < 0 ? raw : raw > 1 ? raw - 1 : 0;
    const ratio =
      overshoot === 0
        ? raw
        : (raw < 0 ? 0 : 1) + Math.sign(overshoot) * rubberband(Math.abs(overshoot));

    paint(ratio);

    const now = performance.now();
    historyRef.current.push({ t: now, x: event.clientX });
    if (historyRef.current.length > 5) historyRef.current.shift();
    if (Math.abs(event.clientX - grabRef.current.startX) > 3) {
      grabRef.current.moved = true;
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finish();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!durationMs) return;

    const current = clamp01(positionMs / durationMs);
    let next: number | null = null;

    switch (event.key) {
      case "ArrowRight":
        next = current + 5000 / durationMs;
        break;
      case "ArrowLeft":
        next = current - 5000 / durationMs;
        break;
      case "PageUp":
        next = current + 30000 / durationMs;
        break;
      case "PageDown":
        next = current - 30000 / durationMs;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 1;
        break;
      default:
        break;
    }

    if (next === null) return;
    event.preventDefault();
    const value = clamp01(next);
    paint(value);
    onSeek(value * durationMs);
  };

  return (
    <div
      ref={rootRef}
      className="scrubber"
      data-dragging={dragging ? "true" : undefined}
    >
      <div
        ref={trackRef}
        className="scrubber-track"
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={finish}
        onKeyDown={onKeyDown}
      >
        <span className="scrubber-rail">
          <span className="scrubber-fill" />
        </span>
        <span className="scrubber-thumb" aria-hidden="true" />
      </div>

      <div className="scrubber-times t-meta tnum">
        <span ref={elapsedRef}>0:00</span>
        <span ref={remainingRef} />
      </div>
    </div>
  );
}
