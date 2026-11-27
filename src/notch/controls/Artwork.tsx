import type { CSSProperties } from "react";

function hueFor(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}

/**
 * The first real character, not the first character: a YouTube title often
 * opens with "[Live]" or "(4K)", and a bracket is not a monogram.
 */
function glyphFor(title?: string, artist?: string): string {
  const fromTitle = title?.match(/[A-Za-z0-9]/)?.[0];
  const fromArtist = artist?.match(/[A-Za-z0-9]/)?.[0];
  return (fromTitle ?? fromArtist ?? "M").toUpperCase();
}

interface ArtworkProps {
  title?: string;
  artist?: string;
  playing?: boolean;
  /** SMTC artwork from the backend (data URL); the monogram stays underneath
      as the fallback, so a missing or broken image still reads as a tile. */
  url?: string | null;
}

/**
 * §15/§12 — a deterministic tint keeps album art calm and on-brand; the letter
 * keeps it legible without loading a bitmap the app does not have yet.
 * §16 — `playing` shows the now-playing badge and lets the tile dim when
 * paused, so the artwork itself carries the state (CSS owns the motion).
 */
export function Artwork({ title, artist, playing = false, url }: ArtworkProps) {
  const seed = `${artist ?? ""}${title ?? ""}` || "miro";
  const style = { "--art-hue": hueFor(seed) } as CSSProperties;

  return (
    <div
      className="artwork"
      style={style}
      data-playing={playing ? "true" : "false"}
      aria-hidden="true"
    >
      <span>{glyphFor(title, artist)}</span>
      {url && (
        <img
          className="artwork-image"
          src={url}
          alt=""
          decoding="async"
          // A bad data URL must fall back to the tinted monogram, not to the
          // browser's broken-image glyph.
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
      <span className="artwork-eq">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
