import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { NotchState } from "./types";

export function getNotchState(): Promise<NotchState> {
  return invoke<NotchState>("notch_state");
}

export function onNotchState(
  handler: (state: NotchState) => void,
): Promise<UnlistenFn> {
  return listen<NotchState>("notch:state", (event) => handler(event.payload));
}
