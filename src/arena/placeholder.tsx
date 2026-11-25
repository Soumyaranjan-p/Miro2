import type { CandidateProps } from "./contract";

export default function PlaceholderCandidate({
  phase,
  page,
  snapshot,
  onPage,
}: CandidateProps) {
  const media = snapshot.media;

  if (phase === "collapsed" || phase === "hover") {
    const hover = phase === "hover";
    return (
      <div
        className="flex items-end justify-center bg-[#0b0c0e] text-[#f4f2ec] shadow-[0_10px_30px_rgba(0,0,0,.45)]"
        style={{
          width: hover ? 248 : 152,
          height: hover ? 42 : 30,
          borderRadius: "0 0 16px 16px",
        }}
      >
        <div className="flex w-full items-center justify-between px-4 pb-2 text-[12px]">
          <span className="font-semibold tracking-[0.14em] uppercase">
            {hover ? media?.title ?? "Miro" : "Miro"}
          </span>
          <span className="tabular-nums text-[#8f9098]">
            {snapshot.todo.filter((item) => !item.done).length} open
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2 bg-[#0b0c0e] p-4 text-[#f4f2ec] shadow-[0_18px_50px_rgba(0,0,0,.5)]"
      style={{
        width: 420,
        height: 150,
        borderRadius: "0 0 22px 22px",
      }}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[#8f9098]">
        <span>Candidate placeholder</span>
        <span>{page}</span>
      </div>
      <p className="text-[13px] text-[#c8c6bf]">
        {media ? `${media.title} / ${media.artist}` : "No track playing"}
      </p>
      <div className="mt-auto flex gap-2">
        {snapshot.notch.pagesOrder.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPage(id)}
            className={`rounded-full px-3 py-1 text-[11px] capitalize ${
              page === id
                ? "bg-[#f4f2ec] text-[#0b0c0e]"
                : "border border-white/10 text-[#8f9098]"
            }`}
          >
            {id}
          </button>
        ))}
      </div>
    </div>
  );
}
