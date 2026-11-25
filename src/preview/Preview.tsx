import {
  Fragment,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import CandidateA from "../arena/candidate-a";
import CandidateB from "../arena/candidate-b";
import CandidateC from "../arena/candidate-c";
import { NOTCH_SIZES, PAGES, type CandidateProps } from "../arena/contract";
import { createMockSnapshot } from "../ipc/mock";
import type { NotchPhase, PageId } from "../ipc/types";
import "./Preview.css";

type Theme = "dark" | "light";
type CandidateId = "a" | "b" | "c";
type Mode = "compare" | "solo";

interface CandidateEntry {
  id: CandidateId;
  name: string;
  thesis: string;
  accent: string;
  Component: (props: CandidateProps) => ReactElement;
}

const CANDIDATES: CandidateEntry[] = [
  {
    id: "a",
    name: "Candidate A",
    thesis: "Quiet instrument",
    accent: "#d7f56b",
    Component: CandidateA,
  },
  {
    id: "b",
    name: "Candidate B",
    thesis: "Soft hardware",
    accent: "#f0714a",
    Component: CandidateB,
  },
  {
    id: "c",
    name: "Candidate C",
    thesis: "Editorial light",
    accent: "#7a2f2a",
    Component: CandidateC,
  },
];

const VISIBLE_PHASES = ["collapsed", "hover", "expanded"] as const;
type VisiblePhase = (typeof VISIBLE_PHASES)[number];
const COMPARE_ZOOM: Record<VisiblePhase, number> = {
  collapsed: 1.5,
  hover: 1.25,
  expanded: 0.68,
};

export default function Preview() {
  const [snapshot] = useState(createMockSnapshot);
  const [mode, setMode] = useState<Mode>("compare");
  const [selected, setSelected] = useState<CandidateId>("a");
  const [phase, setPhase] = useState<VisiblePhase>("expanded");
  const [page, setPage] = useState<PageId>("music");
  const [theme, setTheme] = useState<Theme>("dark");
  const [zoom, setZoom] = useState(1);

  const candidate =
    CANDIDATES.find((entry) => entry.id === selected) ?? CANDIDATES[0];
  const SoloComponent = candidate.Component;

  const stateSnapshot = useMemo(
    () => ({
      ...snapshot,
      settings: { ...snapshot.settings, theme },
      notch: { ...snapshot.notch, phase, page },
    }),
    [snapshot, phase, page, theme],
  );

  const openSolo = (id: CandidateId, nextPhase: NotchPhase = phase) => {
    setSelected(id);
    if (nextPhase !== "hidden") setPhase(nextPhase);
    setMode("solo");
  };

  return (
    <div className="preview" data-theme={theme}>
      <header className="preview-head">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span className="brand-name">Miro</span>
          <span className="brand-sep">/</span>
          <span className="brand-context">arena preview</span>
          <span className="mock-badge">mock data</span>
        </div>

        <div className="head-controls">
          <div className="seg" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={mode === "compare"}
              className="seg-btn"
              onClick={() => setMode("compare")}
            >
              Compare
            </button>
            <button
              type="button"
              aria-pressed={mode === "solo"}
              className="seg-btn"
              onClick={() => setMode("solo")}
            >
              Inspect
            </button>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>
      </header>

      <main className="preview-body">
        {mode === "compare" ? (
          <section className="compare" aria-label="Candidate comparison">
            <div className="compare-corner" />
            {CANDIDATES.map((entry) => (
              <header key={entry.id} className="compare-head">
                <span
                  className="accent-dot"
                  style={{ background: entry.accent }}
                  aria-hidden="true"
                />
                <div className="compare-title">
                  <span>{entry.name}</span>
                  <span className="compare-thesis">{entry.thesis}</span>
                </div>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => openSolo(entry.id, "expanded")}
                >
                  Open
                </button>
              </header>
            ))}

            {VISIBLE_PHASES.map((state) => (
              <Fragment key={state}>
                <div className="row-label">
                  <span>{state}</span>
                  <span className="row-size">
                    {NOTCH_SIZES[state].width}×{NOTCH_SIZES[state].height}
                  </span>
                </div>
                {CANDIDATES.map((entry) => {
                  const Component = entry.Component;
                  return (
                    <div
                      key={`${state}-${entry.id}`}
                      className="compare-cell"
                    >
                      <div className="desk desk--compact" data-theme={theme} inert>
                        <div className="desk-art" aria-hidden="true" />
                        <div className="desk-window" aria-hidden="true" />
                        <div className="desk-dock" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                        <div
                          className="notch-slot"
                          style={
                            {
                              "--zoom": COMPARE_ZOOM[state],
                            } as CSSProperties
                          }
                        >
                          <Component
                            phase={state}
                            page={page}
                            snapshot={stateSnapshot}
                            onPage={setPage}
                            onPhase={(next) => openSolo(entry.id, next)}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="cell-hit"
                        onClick={() => openSolo(entry.id, state)}
                        aria-label={`${entry.name}, ${state} state, inspect`}
                      />
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </section>
        ) : (
          <section className="solo" aria-label={`${candidate.name} preview`}>
            <div className="desk desk--solo" data-theme={theme}>
              <div className="desk-art" aria-hidden="true" />
              <div className="desk-window" aria-hidden="true" />
              <div className="desk-dock" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div
                className="notch-slot"
                style={{ "--zoom": zoom } as CSSProperties}
              >
                <SoloComponent
                  phase={phase}
                  page={page}
                  snapshot={stateSnapshot}
                  onPage={setPage}
                  onPhase={(next) => {
                    if (next !== "hidden") setPhase(next);
                  }}
                />
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="preview-foot">
        {mode === "solo" ? (
          <>
            <div className="control">
              <span className="control-label">Candidate</span>
              <div className="seg">
                {CANDIDATES.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="seg-btn"
                    aria-pressed={selected === entry.id}
                    onClick={() => setSelected(entry.id)}
                  >
                    {entry.id.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="control">
              <span className="control-label">State</span>
              <div className="seg">
                {VISIBLE_PHASES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className="seg-btn"
                    aria-pressed={phase === entry}
                    onClick={() => setPhase(entry)}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="foot-hint">
            Click any state to inspect it at full size. Compare column by column.
          </p>
        )}

        <div className="control control--pages">
          <span className="control-label">Page</span>
          <div className="seg seg--pages">
            {PAGES.map((entry) => (
              <button
                key={entry}
                type="button"
                className="seg-btn"
                aria-pressed={page === entry}
                onClick={() => setPage(entry)}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>

        <div className="control">
          <span className="control-label">Zoom</span>
          <div className="seg">
            {[0.75, 1, 1.5, 2].map((entry) => (
              <button
                key={entry}
                type="button"
                className="seg-btn"
                aria-pressed={zoom === entry}
                onClick={() => setZoom(entry)}
              >
                {entry}×
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            setMode("compare");
            setSelected("a");
            setPhase("expanded");
            setPage("music");
            setTheme("dark");
            setZoom(1);
          }}
        >
          Reset
        </button>
      </footer>
    </div>
  );
}
