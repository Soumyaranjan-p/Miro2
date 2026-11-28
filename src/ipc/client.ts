import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { createMockSnapshot, mockUsageSettings } from "./mock";
import type {
  AppSnapshot,
  FocusState,
  InteractiveRect,
  MediaState,
  NotchState,
  Settings,
  ShelfItem,
  TodoItem,
  UsageSettings,
  UsageState,
  WaterState,
} from "./types";

function hasTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const isTauri = hasTauri();

export async function getAppSnapshot(): Promise<AppSnapshot> {
  if (!isTauri) return createMockSnapshot();

  try {
    return await invoke<AppSnapshot>("app_snapshot");
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[miro] app_snapshot failed, using preview data", error);
      return createMockSnapshot();
    }
    throw error;
  }
}

export function onNotchState(
  handler: (state: NotchState) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<NotchState>("notch:state", (event) => handler(event.payload));
}

export function onMediaUpdate(
  handler: (state: MediaState | null) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<MediaState | null>("media:update", (event) =>
    handler(event.payload),
  );
}

export function onLyricsUpdate(
  handler: (state: AppSnapshot["lyrics"]) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<AppSnapshot["lyrics"]>("lyrics:update", (event) =>
    handler(event.payload),
  );
}

export function onFocusUpdate(
  handler: (state: FocusState) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<FocusState>("focus:update", (event) =>
    handler(event.payload),
  );
}

export function onWaterUpdate(
  handler: (state: WaterState) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<WaterState>("water:update", (event) =>
    handler(event.payload),
  );
}

export function onShelfUpdate(
  handler: (state: ShelfItem[]) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<ShelfItem[]>("shelf:update", (event) =>
    handler(event.payload),
  );
}

export function onTodoUpdate(
  handler: (state: TodoItem[]) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<TodoItem[]>("todo:update", (event) => handler(event.payload));
}

export function onSettingsUpdate(
  handler: (state: Settings) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<Settings>("settings:update", (event) =>
    handler(event.payload),
  );
}

export function onUsageUpdate(
  handler: (state: UsageState) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return Promise.resolve(() => {});
  return listen<UsageState>("usage:update", (event) =>
    handler(event.payload),
  );
}

export async function getUsageSettings(): Promise<UsageSettings> {
  if (!isTauri) return mockUsageSettings();
  return invoke<UsageSettings>("usage_settings_get");
}

export async function setUsageSettings(settings: UsageSettings): Promise<void> {
  if (!isTauri) return;
  await invoke("usage_settings_set", { settings });
}

export async function reportDockLayout(rects: InteractiveRect[]): Promise<void> {
  if (!isTauri) return;
  await invoke("dock_report_layout", { rects });
}
