import { useCallback, useEffect, useRef } from "react";

import { useModel } from "../app/model";
import { springPresets } from "../motion/spring";
import { useSpringDriver } from "../motion/useSpring";
import { Island } from "./Island";
import { TransientLayer } from "./TransientLayer";

export default function Notch() {
  const { phase, isPreview, setPreviewPhase } = useModel();
  const hoverTimer = useRef(0);
  const leaveTimer = useRef(0);

  // §3/§4 — one spring drives the whole shell. Width, height and the bottom
  // radius all derive from --t in CSS, so the collapsed→expanded morph is one
  // continuous animation; the momentum preset gives it the slight overshoot
  // the island spec calls for, and interruption is automatic: the spring
  // keeps its live value when the phase flips mid-flight.
  const applyShell = useCallback((element: HTMLElement, t: number) => {
    element.style.setProperty("--t", t.toFixed(4));
  }, []);

  const bindShell = useSpringDriver(
    phase === "expanded" ? 1 : 0,
    springPresets.momentum,
    applyShell,
    0,
  );

  useEffect(
    () => () => {
      window.clearTimeout(hoverTimer.current);
      window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  if (phase === "hidden") return null;

  // The browser preview has no native hover, so mirror the Rust phases here
  // (140 ms enter delay, 320 ms collapse grace) to review the real motion.
  const onEnter = () => {
    if (!isPreview) return;
    window.clearTimeout(leaveTimer.current);
    setPreviewPhase("hover");
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(
      () => setPreviewPhase("expanded"),
      140,
    );
  };

  const onLeave = () => {
    if (!isPreview) return;
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(
      () => setPreviewPhase("collapsed"),
      320,
    );
  };

  return (
    <div className="notch-root" data-phase={phase}>
      <div
        className="notch-shell"
        ref={bindShell}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        <Island />
        <TransientLayer />
      </div>
    </div>
  );
}
