import { useEffect, useState } from "react";

import { useSnapshot } from "../app/useSnapshot";

function useClock(): string {
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatTime()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return time;
}

function formatTime(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function LiveNotch() {
  const snapshot = useSnapshot();
  const time = useClock();

  if (!snapshot || snapshot.notch.phase === "hidden") return null;

  const { phase, page, pagesOrder } = snapshot.notch;
  const media = snapshot.media;

  if (phase !== "expanded") {
    return (
      <div className="flex h-full w-full justify-center">
        <div className="flex h-[30px] w-[152px] items-center justify-between rounded-b-[16px] bg-[#0b0c0e] px-3.5 text-[#f4f2ec] shadow-[0_8px_24px_rgba(0,0,0,.35)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            Miro
          </span>
          <span className="text-[12px] tabular-nums text-[#9a9ba1]">
            {time}
          </span>
        </div>
      </div>
    );
  }

  const progress = media
    ? Math.min(1, media.positionMs / Math.max(1, media.durationMs))
    : 0;

  return (
    <div className="flex h-full w-full justify-center">
      <section
        aria-label="Miro"
        className="flex h-[150px] w-[420px] flex-col gap-3 rounded-b-[22px] bg-[#0b0c0e] px-5 pb-4 pt-4 text-[#f4f2ec] shadow-[0_18px_50px_rgba(0,0,0,.45)]"
      >
        <header className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            Miro
          </span>
          <span className="text-[12px] tabular-nums text-[#9a9ba1]">
            {time}
          </span>
        </header>

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-[12px] bg-[#1a1d21] text-[15px] font-semibold text-[#c9f76f]">
            {media ? media.title.slice(0, 1) : "M"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">
              {media?.title ?? "Nothing playing"}
            </p>
            <p className="truncate text-[11px] text-[#9a9ba1]">
              {media ? media.artist : "Start a track to fill this space"}
            </p>
          </div>
          <span className="ml-auto text-[11px] tabular-nums text-[#6f7178]">
            {media
              ? `${formatDuration(media.positionMs)} / ${formatDuration(media.durationMs)}`
              : ""}
          </span>
        </div>

        <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-[#c9f76f]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <nav className="mt-auto flex gap-1.5" aria-label="Pages">
          {pagesOrder.map((id) => (
            <span
              key={id}
              className={`rounded-full px-2.5 py-1 text-[10px] capitalize ${
                page === id
                  ? "bg-[#f4f2ec] text-[#0b0c0e]"
                  : "border border-white/10 text-[#8f9098]"
              }`}
            >
              {id}
            </span>
          ))}
        </nav>
      </section>
    </div>
  );
}
