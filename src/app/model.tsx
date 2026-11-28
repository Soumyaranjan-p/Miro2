import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  getAppSnapshot,
  controlMedia,
  driftSystemState,
  isTauri,
  mockBluetoothState,
  mockPowerState,
  mockSystemState,
  onBluetoothUpdate,
  onFocusUpdate,
  onLyricsUpdate,
  onMediaUpdate,
  onNotchState,
  onPowerUpdate,
  onSettingsUpdate,
  onShelfUpdate,
  onSystemUpdate,
  onTodoUpdate,
  onWaterUpdate,
} from "../ipc/client";
import type {
  AppSnapshot,
  BluetoothState,
  NotchPhase,
  PageId,
  PowerState,
  SystemState,
} from "../ipc/types";
import { PAGE_IDS } from "./pages";

interface NotchModel {
  snapshot: AppSnapshot;
  phase: NotchPhase;
  page: PageId;
  clock: Date;
  isPreview: boolean;
  system: SystemState | null;
  power: PowerState | null;
  bluetooth: BluetoothState | null;
  setPage: (page: PageId) => void;
  setPreviewPhase: (phase: NotchPhase | null) => void;
  togglePlay: () => void;
  seek: (ms: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  drink: () => void;
  toggleTodo: (id: string) => void;
  toggleFocus: () => void;
  endFocus: () => void;
}

const ModelContext = createContext<NotchModel | null>(null);

const PHASES: NotchPhase[] = ["collapsed", "hover", "expanded", "hidden"];

function readPhase(value: string | null): NotchPhase | null {
  return PHASES.find((phase) => phase === value) ?? null;
}

function readPage(value: string | null): PageId | null {
  return PAGE_IDS.find((page) => page === value) ?? null;
}

const query =
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search);

// Preview-only deep links, so each page can be reviewed in a browser tab.
// Tauri always loads the app without a query string, so this never fires there.
const forcedPhase = import.meta.env.DEV ? readPhase(query?.get("phase") ?? null) : null;
const forcedPage = import.meta.env.DEV ? readPage(query?.get("page") ?? null) : null;

/** §1 — the clock should flip on the minute, not up to half a minute late. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer = 0;

    const schedule = () => {
      const current = new Date();
      const elapsed = current.getSeconds() * 1000 + current.getMilliseconds();
      timer = window.setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        Math.max(250, 60_000 - elapsed),
      );
    };

    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return now;
}

function patchSnapshot(
  update: (snapshot: AppSnapshot) => AppSnapshot,
): (snapshot: AppSnapshot | null) => AppSnapshot | null {
  return (snapshot) => (snapshot ? update(snapshot) : snapshot);
}

export function NotchProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [previewPhase, setPreviewPhase] = useState<NotchPhase | null>(null);
  const [system, setSystem] = useState<SystemState | null>(null);
  const [power, setPower] = useState<PowerState | null>(null);
  const [bluetooth, setBluetooth] = useState<BluetoothState | null>(null);
  const clock = useMinuteClock();
  // A seek races the next poll: SMTC reports the old position for a beat
  // after the command, and painting it would yank the scrubber backwards.
  const seekGuardRef = useRef<{ targetMs: number; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stops: Array<() => void> = [];

    getAppSnapshot().then((initial) => {
      if (!cancelled) setSnapshot(initial);
    });

    const watch = <T,>(
      subscribe: (handler: (value: T) => void) => Promise<() => void>,
      apply: (current: AppSnapshot, value: T) => AppSnapshot,
    ) => {
      subscribe((value) => {
        setSnapshot((current) => (current ? apply(current, value) : current));
      }).then((stop) => {
        if (cancelled) stop();
        else stops.push(stop);
      });
    };

    watch(onNotchState, (current, notch) => ({
      ...current,
      notch: { ...current.notch, ...notch },
    }));
    watch(onMediaUpdate, (current, media) => {
      const guard = seekGuardRef.current;
      if (guard && media) {
        const arrived = Math.abs(media.positionMs - guard.targetMs) <= 2_500;
        if (arrived) {
          seekGuardRef.current = null;
        } else if (Date.now() - guard.at < 1_000) {
          // The player still reports the pre-seek position; hold ours and
          // take the rest of the report (title, playing, artwork).
          return {
            ...current,
            media: { ...media, positionMs: current.media?.positionMs ?? media.positionMs },
          };
        } else {
          seekGuardRef.current = null;
        }
      }
      return { ...current, media };
    });
    watch(onLyricsUpdate, (current, lyrics) => ({ ...current, lyrics }));
    watch(onFocusUpdate, (current, focus) => ({ ...current, focus }));
    watch(onWaterUpdate, (current, water) => ({ ...current, water }));
    watch(onShelfUpdate, (current, shelf) => ({ ...current, shelf }));
    watch(onTodoUpdate, (current, todo) => ({ ...current, todo }));
    watch(onSettingsUpdate, (current, settings) => ({ ...current, settings }));

    const subscribeSide = <T,>(
      subscribe: (handler: (value: T) => void) => Promise<() => void>,
      set: (value: T) => void,
    ) => {
      subscribe(set).then((stop) => {
        if (cancelled) stop();
        else stops.push(stop);
      });
    };
    subscribeSide(onSystemUpdate, setSystem);
    subscribeSide(onPowerUpdate, setPower);
    subscribeSide(onBluetoothUpdate, setBluetooth);

    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);

  // Preview clock: keep the mock timeline moving so motion can be judged live.
  useEffect(() => {
    if (isTauri || !snapshot?.media?.playing) return;
    const timer = window.setInterval(() => {
      setSnapshot(
        patchSnapshot((current) => {
          const media = current.media;
          if (!media?.playing) return current;
          // Live streams have no clock to tick; their playing state just holds.
          if (media.durationMs <= 0) return current;
          const positionMs = Math.min(media.durationMs, media.positionMs + 1000);
          return {
            ...current,
            media: {
              ...media,
              positionMs,
              playing: positionMs < media.durationMs,
            },
          };
        }),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.media?.playing]);

  // Preview countdown for the focus page.
  useEffect(() => {
    if (isTauri || !snapshot?.focus?.running) return;
    const timer = window.setInterval(() => {
      setSnapshot(
        patchSnapshot((current) => {
          const focus = current.focus;
          if (!focus.running) return current;
          const remainingMs = Math.max(0, focus.remainingMs - 1000);
          return {
            ...current,
            focus: { ...focus, remainingMs, running: remainingMs > 0 },
          };
        }),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.focus?.running]);

  // Preview system stats: the meters drift like a real machine so the
  // smooth-update motion can be judged in a browser tab.
  useEffect(() => {
    if (isTauri) return;
    const timer = window.setInterval(() => {
      setSystem((current) => (current ? driftSystemState(current) : current));
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const setPage = useCallback((page: PageId) => {
    setSnapshot(
      patchSnapshot((current) => ({
        ...current,
        notch: { ...current.notch, page },
      })),
    );
  }, []);

  // §1 — optimistic first: the button reacts instantly, then the command goes
  // out and the next SMTC poll (≤1 s) reports what YouTube actually did.
  const togglePlay = useCallback(() => {
    setSnapshot(
      patchSnapshot((current) => {
        const media = current.media;
        if (!media) return current;
        return { ...current, media: { ...media, playing: !media.playing } };
      }),
    );
    void controlMedia("toggle");
  }, []);

  const seek = useCallback((ms: number) => {
    setSnapshot(
      patchSnapshot((current) => {
        const media = current.media;
        if (!media) return current;
        const positionMs = Math.min(media.durationMs, Math.max(0, ms));
        return { ...current, media: { ...media, positionMs } };
      }),
    );
    seekGuardRef.current = { targetMs: ms, at: Date.now() };
    void controlMedia("seek", ms);
  }, []);

  const nextTrack = useCallback(() => {
    void controlMedia("next");
  }, []);

  const previousTrack = useCallback(() => {
    void controlMedia("previous");
  }, []);

  const drink = useCallback(() => {
    setSnapshot(
      patchSnapshot((current) => {
        const water = current.water;
        if (water.todayMl >= water.goalMl) return current;
        const ml = Math.min(water.bottleMl, water.goalMl - water.todayMl);
        return {
          ...current,
          water: {
            ...water,
            todayMl: water.todayMl + ml,
            entries: [...water.entries, { atMs: Date.now(), ml }],
          },
        };
      }),
    );
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setSnapshot(
      patchSnapshot((current) => ({
        ...current,
        todo: current.todo.map((item) =>
          item.id === id ? { ...item, done: !item.done } : item,
        ),
      })),
    );
  }, []);

  const toggleFocus = useCallback(() => {
    setSnapshot(
      patchSnapshot((current) => ({
        ...current,
        focus: { ...current.focus, running: !current.focus.running },
      })),
    );
  }, []);

  const endFocus = useCallback(() => {
    setSnapshot(
      patchSnapshot((current) => ({
        ...current,
        focus: { ...current.focus, running: false, remainingMs: 0 },
      })),
    );
  }, []);

  // §16 wayfinding — a fresh expansion always opens on Focus: the notch's
  // home face is the deep-work timer (the user's last page still wins while
  // already expanded, and a hidden Focus page is never forced).
  const prevPhaseRef = useRef<NotchPhase | null>(null);
  const phase: NotchPhase =
    forcedPhase ?? previewPhase ?? snapshot?.notch.phase ?? "collapsed";

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (!snapshot) return;
    if (prev !== null && prev !== "expanded" && phase === "expanded") {
      const focusHidden = snapshot.notch.pagesHidden.includes("focus");
      if (!focusHidden && snapshot.notch.page !== "focus") {
        setPage("focus");
      }
    }
  }, [phase, snapshot, setPage]);

  const value = useMemo<NotchModel | null>(() => {
    if (!snapshot) return null;
    return {
      snapshot,
      phase,
      page: forcedPage ?? snapshot.notch.page,
      clock,
      isPreview: !isTauri,
      system: isTauri ? system : mockSystemState(),
      power: isTauri ? power : mockPowerState(),
      bluetooth: isTauri ? bluetooth : mockBluetoothState(),
      setPage,
      setPreviewPhase,
      togglePlay,
      seek,
      nextTrack,
      previousTrack,
      drink,
      toggleTodo,
      toggleFocus,
      endFocus,
    };
  }, [
    snapshot,
    phase,
    clock,
    system,
    power,
    bluetooth,
    setPage,
    togglePlay,
    seek,
    nextTrack,
    previousTrack,
    drink,
    toggleTodo,
    toggleFocus,
    endFocus,
  ]);

  if (!value) return null;

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export function useModel(): NotchModel {
  const model = useContext(ModelContext);
  if (!model) throw new Error("useModel must be used inside NotchProvider");
  return model;
}
