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

/**
 * §15/§12 — a deterministic tint keeps album art calm and on-brand; the letter
 * keeps it legible without loading a bitmap the app does not have yet.
 */
export function Artwork({ title, artist }: { title?: string; artist?: string }) {
  const seed = `${artist ?? ""}${title ?? ""}` || "miro";
  const style = { "--art-hue": hueFor(seed) } as CSSProperties;

  return (
    <div className="artwork" style={style} aria-hidden="true">
      <span>{glyphFor(title, artist)}</span>
    </div>
  );
}
