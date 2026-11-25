import type { AppSnapshot, NotchPhase, PageId } from "../ipc/types";

export interface CandidateProps {
  phase: NotchPhase;
  page: PageId;
  snapshot: AppSnapshot;
  onPage: (page: PageId) => void;
  onPhase: (phase: NotchPhase) => void;
}

export interface CandidateMeta {
  id: "a" | "b" | "c";
  name: string;
  thesis: string;
  accent: string;
}

export const NOTCH_SIZES = {
  collapsed: { width: 152, height: 30 },
  hover: { width: 248, height: 42 },
  expanded: { width: 420, height: 150 },
} as const;

export const PAGES: PageId[] = [
  "music",
  "lyrics",
  "focus",
  "water",
  "shelf",
  "todo",
];
