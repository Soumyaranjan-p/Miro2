import { useMemo } from "react";

import { useModel } from "../../app/model";
import { EmptyState } from "./EmptyState";

const LINE_HEIGHT = 24;
const VIEWPORT_HEIGHT = 90;

export function LyricsPage() {
  const { snapshot, seek } = useModel();
  const { lyrics, media } = snapshot;

  const activeIndex = useMemo(() => {
    if (!media) return 0;
    let index = 0;
    lyrics.lines.forEach((line, position) => {
      if (line.atMs <= media.positionMs) index = position;
    });
    return index;
  }, [lyrics.lines, media]);

  if (lyrics.status !== "ready" || lyrics.lines.length === 0) {
    return (
      <EmptyState
        title="No lyrics yet"
        hint="Synced lyrics appear once this track has them."
      />
    );
  }

  // Center the active line in the viewport; nearby lines fade at the edges.
  const offset =
    VIEWPORT_HEIGHT / 2 - (activeIndex * LINE_HEIGHT + LINE_HEIGHT / 2);

  return (
    <div className="page lyrics-page">
      <div className="lyrics-viewport">
        <div
          className="lyrics-track"
          style={{ transform: `translateY(${offset}px)` }}
        >
          {lyrics.lines.map((line, index) => (
            <button
              key={`${line.atMs}-${index}`}
              type="button"
              className="lyric t-body"
              data-active={index === activeIndex ? "true" : undefined}
              tabIndex={-1}
              onClick={() => seek(line.atMs)}
            >
              {line.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
