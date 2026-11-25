import { useEffect, useState } from "react";

import {
  getAppSnapshot,
  onFocusUpdate,
  onLyricsUpdate,
  onMediaUpdate,
  onNotchState,
  onShelfUpdate,
  onSettingsUpdate,
  onTodoUpdate,
  onWaterUpdate,
} from "../ipc/client";
import type { AppSnapshot } from "../ipc/types";

export function useSnapshot(): AppSnapshot | null {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stops: Array<() => void> = [];

    getAppSnapshot().then((initial) => {
      if (!cancelled) setSnapshot(initial);
    });

    const watch = <T,>(
      subscribe: (
        handler: (value: T) => void,
      ) => Promise<() => void>,
      patch: (current: AppSnapshot, value: T) => AppSnapshot,
    ) => {
      subscribe((value) => {
        setSnapshot((current) => (current ? patch(current, value) : current));
      }).then((stop) => {
        if (cancelled) stop();
        else stops.push(stop);
      });
    };

    watch(onNotchState, (current, notch) => ({ ...current, notch }));
    watch(onMediaUpdate, (current, media) => ({ ...current, media }));
    watch(onLyricsUpdate, (current, lyrics) => ({ ...current, lyrics }));
    watch(onFocusUpdate, (current, focus) => ({ ...current, focus }));
    watch(onWaterUpdate, (current, water) => ({ ...current, water }));
    watch(onShelfUpdate, (current, shelf) => ({ ...current, shelf }));
    watch(onTodoUpdate, (current, todo) => ({ ...current, todo }));
    watch(onSettingsUpdate, (current, settings) => ({ ...current, settings }));

    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);

  return snapshot;
}
