import { useEffect, useState } from "react";

import { getNotchState, onNotchState } from "./ipc/client";
import type { NotchPhase } from "./ipc/types";
import "./App.css";

function useNotchPhase(): NotchPhase {
  const [phase, setPhase] = useState<NotchPhase>("collapsed");

  useEffect(() => {
    let cancelled = false;
    let stopListening: (() => void) | undefined;

    getNotchState().then((state) => {
      if (!cancelled) setPhase(state.phase);
    });

    onNotchState((state) => setPhase(state.phase)).then((unlisten) => {
      if (cancelled) unlisten();
      else stopListening = unlisten;
    });

    return () => {
      cancelled = true;
      stopListening?.();
    };
  }, []);

  return phase;
}

function useClock(): string {
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatTime()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return time;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CollapsedView() {
  const time = useClock();

  return (
    <div className="pill">
      <span className="wordmark">Miro</span>
      <span className="clock">{time}</span>
    </div>
  );
}

function ExpandedView() {
  const time = useClock();

  return (
    <section className="panel" aria-label="Miro notch">
      <header className="panel-header">
        <span className="wordmark">Miro</span>
        <span className="clock">{time}</span>
      </header>
      <p className="panel-copy">Media, focus and files land here.</p>
      <div className="panel-pages" aria-hidden="true">
        <span>Media</span>
        <span>Focus</span>
        <span>Files</span>
      </div>
    </section>
  );
}

export default function App() {
  const phase = useNotchPhase();

  return (
    <main className="notch" data-phase={phase}>
      {phase === "expanded" ? <ExpandedView /> : <CollapsedView />}
    </main>
  );
}
