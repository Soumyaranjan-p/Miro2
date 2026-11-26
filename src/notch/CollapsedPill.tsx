import { formatClock } from "../app/format";
import { useModel } from "../app/model";

export function CollapsedPill() {
  const { snapshot, clock } = useModel();
  const media = snapshot.media;
  const playing = media?.playing ?? false;

  return (
    <div className="notch-collapsed">
      <span className="collapsed-mark" data-playing={playing} aria-hidden="true">
        <span className="collapsed-dot" />
      </span>
      <span className="collapsed-brand">Miro</span>
      <time className="collapsed-clock tnum" dateTime={clock.toISOString()}>
        {formatClock(clock)}
      </time>
    </div>
  );
}
