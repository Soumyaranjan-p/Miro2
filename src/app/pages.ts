import type { PageId } from "../ipc/types";

export const PAGE_IDS: PageId[] = [
  "music",
  "widgets",
  "usage",
  "focus",
  "water",
  "shelf",
  "todo",
  "system",
  "settings",
];

/** §16 — direct, specific labels beat generic umbrellas. */
export const PAGE_LABELS: Record<PageId, string> = {
  clock: "Clock",
  music: "Now Playing",
  widgets: "Widgets",
  usage: "AI Usage",
  focus: "Focus",
  water: "Water",
  shelf: "Shelf",
  todo: "To-do",
  system: "System",
  settings: "Settings",
};

export const PAGE_SHORT_LABELS: Record<PageId, string> = {
  clock: "Clock",
  music: "Music",
  widgets: "Widgets",
  usage: "Usage",
  focus: "Focus",
  water: "Water",
  shelf: "Shelf",
  todo: "To-do",
  system: "System",
  settings: "Settings",
};

export function pageIndex(page: PageId): number {
  return Math.max(0, PAGE_IDS.indexOf(page));
}
