export type PageId =
  | "clock"
  | "music"
  | "lyrics"
  | "focus"
  | "water"
  | "shelf"
  | "todo"
  | "settings";

export type NotchPhase = "collapsed" | "hover" | "expanded" | "hidden";
export type ThemeMode = "dark" | "light" | "system";
export type Lang = "en" | "id";

export interface AppSnapshot {
  version: 1;
  notch: NotchState;
  settings: Settings;
  media: MediaState | null;
  lyrics: LyricsState;
  focus: FocusState;
  water: WaterState;
  shelf: ShelfItem[];
  todo: TodoItem[];
}

export interface NotchState {
  phase: NotchPhase;
  page: PageId;
  pagesOrder: PageId[];
  pagesHidden: PageId[];
  minimal: boolean;
  showClockDate: boolean;
}

export interface Settings {
  theme: ThemeMode;
  language: Lang;
  startWithWindows: boolean;
  hideOnFullscreen: boolean;
  expandDelayMs: number;
  collapseDelayMs: number;
}

export interface MediaState {
  sessionId: string;
  title: string;
  artist: string;
  album: string | null;
  durationMs: number;
  positionMs: number;
  playing: boolean;
  artworkUrl: string | null;
}

export interface LyricLine {
  atMs: number;
  text: string;
}

export interface LyricsState {
  trackKey: string | null;
  status: "idle" | "loading" | "ready" | "empty" | "error";
  lines: LyricLine[];
  activeIndex: number;
}

export interface FocusState {
  running: boolean;
  kind: "focus" | "short" | "long";
  round: number;
  roundsTotal: number;
  remainingMs: number;
  totalMs: number;
}

export interface WaterEntry {
  atMs: number;
  ml: number;
}

export interface WaterState {
  goalMl: number;
  bottleMl: number;
  todayMl: number;
  entries: WaterEntry[];
  activeFrom: string;
  activeTo: string;
}

export interface ShelfItem {
  id: string;
  path: string;
  name: string;
  isDir: boolean;
  sizeBytes: number | null;
  addedAt: number;
}

export interface TodoItem {
  id: string;
  title: string;
  done: boolean;
  dueAt: number | null;
}

export type MediaAction = "toggle" | "next" | "prev";
export type ShelfAction = "open" | "reveal" | "remove";

export type DockSide = "left" | "right";

export interface UsageWindow {
  label: string;
  used: number;
  limit: number;
  percent: number;
  /** RFC 3339 local time; empty when the window never resets. */
  resetsAt: string;
}

export interface ProviderUsage {
  id: string;
  /** The tool's local data exists on this machine. */
  present: boolean;
  /** The user enabled it in the dock settings. */
  enabled: boolean;
  windows: UsageWindow[];
}

export interface UsageState {
  providers: ProviderUsage[];
}

export interface ProviderSetting {
  enabled: boolean;
  limitOverride: number | null;
}

export interface UsageSettings {
  providers: Record<string, ProviderSetting>;
  dockSide: DockSide;
}

/** Interactive areas of the dock window, logical px, window-relative. */
export interface InteractiveRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
