import type { CSSProperties } from "react";

function hueFor(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
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
      <span>{title ? title.slice(0, 1).toUpperCase() : "M"}</span>
    </div>
  );
}
