import { formatClock } from "../app/format";
import { useModel } from "../app/model";
import { NotchEyes } from "./controls/NotchEyes";

/**
 * The face replaces the mark + brand wordmark: on the Windows desktop the
 * collapsed pill *is* the character now. The clock keeps its place on the
 * right, and the playing tell survives as a small accent dot (DESIGN.md —
 * accent only for state that changes).
 */
export function CollapsedPill() {
  const { snapshot, clock } = useModel();
  const playing = snapshot.media?.playing ?? false;

  return (
    <div className="notch-collapsed">
      <NotchEyes />
      <span
        className="collapsed-live-dot"
        data-playing={playing ? "true" : "false"}
        aria-hidden="true"
      />
      <time className="collapsed-clock tnum" dateTime={clock.toISOString()}>
        {formatClock(clock)}
      </time>
    </div>
  );
}
