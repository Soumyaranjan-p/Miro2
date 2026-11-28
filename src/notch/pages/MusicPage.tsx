import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { useModel } from "../../app/model";
import { Artwork } from "../controls/Artwork";
import { IconButton } from "../controls/IconButton";
import { Scrubber } from "../controls/Scrubber";
import { LyricsIcon, PauseIcon, PlayIcon } from "../../ui/icons";
import { EmptyState } from "./EmptyState";
import { LyricsPage } from "./LyricsPage";

type MusicView = "player" | "lyrics";

const VIEW_KEY = "miro.musicView";
const MARQUEE_GAP = 24; // --space-6
const MARQUEE_SPEED = 14; // px/s — readable, and quiet enough to ignore.

/**
 * §16 craft — long stream titles truncate mid-word; Apple's mini players
 * answer with a slow single-direction marquee. Overflow is measured, never
 * assumed, so short titles stay perfectly still. §14 — reduced motion keeps
 * the static ellipsis (the media query in notch.css drops the animation).
 */
function MarqueeTitle({ text }: { text: string }) {
  const clipRef = useRef<HTMLSpanElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const clip = clipRef.current;
    const copy = copyRef.current;
    if (!clip || !copy) return;

    // The text's own width, via a Range: unlike scrollWidth this is immune
    // to which box mode the track is currently laid out in.
    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(copy);
      const textWidth = range.getBoundingClientRect().width;
      if (textWidth - clip.clientWidth > 1) {
        setOverflow(true);
        // One copy + the gap: at this offset the second copy sits exactly
        // where the first began, so the loop seam is invisible.
        setShift(textWidth + MARQUEE_GAP);
      } else {
        setOverflow(false);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(clip);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [text]);

  const style = overflow
    ? ({
        "--marquee-shift": `${shift}px`,
        "--marquee-duration": `${(shift / MARQUEE_SPEED).toFixed(2)}s`,
      } as CSSProperties)
    : undefined;

  return (
    <span
      ref={clipRef}
      className="music-title t-title"
      data-marquee={overflow ? "true" : undefined}
      style={style}
    >
      <span className="music-title-track">
        <span ref={copyRef} className="music-title-copy">
          {text}
        </span>
        {overflow && (
          <span className="music-title-copy" aria-hidden="true">
            {text}
          </span>
        )}
      </span>
    </span>
  );
}

/** §16 agency — the last view the user chose is the view they come back to. */
function readView(): MusicView {
  try {
    return localStorage.getItem(VIEW_KEY) === "lyrics" ? "lyrics" : "player";
  } catch {
    return "player";
  }
}

/**
 * Music is two stacked views now — player and lyrics — toggled by the lyrics
 * button next to the transport. Lyrics moved in from its old tab; the tab
 * list no longer carries it. The switch is a 200ms cross-fade, nothing more.
 */
export function MusicPage() {
  const { snapshot, togglePlay, seek } = useModel();
  const media = snapshot.media;
  const [view, setView] = useState<MusicView>(readView);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Private mode: the choice just does not survive a restart.
    }
  }, [view]);

  if (!media) {
    return (
      <EmptyState
        title="Nothing playing"
        hint="Start a track and it lands here."
      />
    );
  }

  const live = media.durationMs <= 0;
  const showLyrics = view === "lyrics";

  return (
    <div
      className="page music-page"
      data-playing={media.playing ? "true" : "false"}
      data-view={view}
    >
      <div className="music-views">
        <div className="music-view" data-view="player">
          <div className="music-top">
            <Artwork
              title={media.title}
              artist={media.artist}
              url={media.artworkUrl}
              playing={media.playing}
            />

            <div className="music-meta">
              <MarqueeTitle text={media.title} />
              <p className="t-body music-artist">{media.artist}</p>
            </div>

            <div className="music-controls">
              <IconButton
                label={showLyrics ? "Show player only" : "Split lyrics"}
                aria-pressed={showLyrics}
                onClick={() => setView(showLyrics ? "player" : "lyrics")}
              >
                <LyricsIcon />
              </IconButton>
              <IconButton
                label={media.playing ? "Pause" : "Play"}
                primary
                onClick={togglePlay}
              >
                <span
                  className="play-glyphs"
                  data-playing={media.playing ? "true" : "false"}
                  aria-hidden="true"
                >
                  <PlayIcon className="play-glyph play-glyph-play" />
                  <PauseIcon className="play-glyph play-glyph-pause" />
                </span>
              </IconButton>
            </div>
          </div>

          {live ? (
            <div className="music-live" role="status" aria-label="Live stream">
              <span className="live-pill t-label">
                <span className="live-dot" aria-hidden="true" />
                Live
              </span>
            </div>
          ) : (
            <Scrubber
              positionMs={media.positionMs}
              durationMs={media.durationMs}
              onSeek={seek}
            />
          )}
        </div>

        <div className="music-view" data-view="lyrics">
          <LyricsPage />
        </div>
      </div>
    </div>
  );
}
