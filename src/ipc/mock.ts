import type { AppSnapshot, UsageSettings, UsageState } from "./types";

const BASE = Date.now();

const inMinutes = (minutes: number) => new Date(BASE + minutes * 60_000).toISOString();

/** Preview usage so the dock can be designed in a browser tab. */
export function mockUsageState(): UsageState {
  return {
    providers: [
      {
        id: "zcode",
        present: true,
        enabled: true,
        windows: [
          {
            label: "Today",
            used: 61_200_000,
            limit: 89_285_631,
            percent: 68.5,
            resetsAt: inMinutes(51),
          },
          {
            label: "This week",
            used: 6_500_000,
            limit: 89_285_631,
            percent: 7.3,
            resetsAt: inMinutes(2 * 24 * 60),
          },
        ],
      },
      {
        id: "opencode",
        present: true,
        enabled: true,
        windows: [
          {
            label: "Today",
            used: 24_000_000,
            limit: 118_980_653,
            percent: 20.2,
            resetsAt: inMinutes(51),
          },
          {
            label: "This week",
            used: 210_000_000,
            limit: 237_326_773,
            percent: 88.5,
            resetsAt: inMinutes(3 * 24 * 60),
          },
        ],
      },
      {
        id: "claude",
        present: false,
        enabled: true,
        windows: [],
      },
      {
        id: "codex",
        present: false,
        enabled: true,
        windows: [],
      },
    ],
  };
}

export function mockUsageSettings(): UsageSettings {
  return {
    providers: {},
  };
}

export function createMockSnapshot(): AppSnapshot {
  return {
    version: 1,
    notch: {
      phase: "collapsed",
      page: "music",
      pagesOrder: [
        "music",
        "usage",
        "focus",
        "water",
        "shelf",
        "todo",
        "settings",
      ],
      pagesHidden: [],
      minimal: false,
      showClockDate: true,
    },
    settings: {
      theme: "dark",
      language: "en",
      startWithWindows: false,
      hideOnFullscreen: true,
      expandDelayMs: 140,
      collapseDelayMs: 320,
    },
    media: {
      sessionId: "mock:lumen-fields",
      title: "Slow Arc",
      artist: "Lumen Fields",
      album: "Soft Static",
      durationMs: 228_000,
      positionMs: 72_400,
      playing: true,
      artworkUrl: null,
    },
    lyrics: {
      trackKey: "lumen-fields:slow-arc",
      status: "ready",
      activeIndex: 3,
      lines: [
        { atMs: 0, text: "Hold the door, the light is low" },
        { atMs: 14_000, text: "Every window learns the cold" },
        { atMs: 28_000, text: "I keep the map folded small" },
        { atMs: 44_000, text: "A slow arc back to the start" },
        { atMs: 58_000, text: "You said the quiet has a shape" },
        { atMs: 74_000, text: "I drew it once and let it go" },
        { atMs: 90_000, text: "Now the street is full of rain" },
        { atMs: 106_000, text: "And the lights come up again" },
      ],
    },
    focus: {
      running: true,
      kind: "focus",
      round: 2,
      roundsTotal: 4,
      remainingMs: 18 * 60_000 + 42_000,
      totalMs: 25 * 60_000,
    },
    water: {
      goalMl: 1500,
      bottleMl: 400,
      todayMl: 900,
      activeFrom: "08:00",
      activeTo: "22:00",
      entries: [
        { atMs: BASE - 5 * 3_600_000, ml: 400 },
        { atMs: BASE - 2 * 3_600_000, ml: 300 },
        { atMs: BASE - 40 * 60_000, ml: 200 },
      ],
    },
    shelf: [
      {
        id: "shelf-brief",
        path: "C:\\Users\\you\\Documents\\Q4 brief.pdf",
        name: "Q4 brief.pdf",
        isDir: false,
        sizeBytes: 2_400_000,
        addedAt: BASE - 80 * 60_000,
      },
      {
        id: "shelf-coast",
        path: "C:\\Users\\you\\Pictures\\coastline.jpg",
        name: "coastline.jpg",
        isDir: false,
        sizeBytes: 5_100_000,
        addedAt: BASE - 26 * 60_000,
      },
      {
        id: "shelf-studio",
        path: "C:\\Users\\you\\Studio",
        name: "Studio",
        isDir: true,
        sizeBytes: null,
        addedAt: BASE - 8 * 60_000,
      },
    ],
    todo: [
      {
        id: "todo-invoice",
        title: "Send the invoice",
        done: true,
        dueAt: null,
      },
      {
        id: "todo-motion",
        title: "Review the motion pass",
        done: false,
        dueAt: BASE + 3_600_000,
      },
      {
        id: "todo-studio",
        title: "Book the studio",
        done: false,
        dueAt: null,
      },
      {
        id: "todo-monstera",
        title: "Water the monstera",
        done: true,
        dueAt: null,
      },
    ],
  };
}
