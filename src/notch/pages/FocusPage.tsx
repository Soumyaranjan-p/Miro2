import { formatDuration } from "../../app/format";
import { useModel } from "../../app/model";
import { IconButton } from "../controls/IconButton";
import { PauseIcon, PlayIcon } from "../../ui/icons";

const SIZE = 60;
const STROKE = 4.5;
const RADIUS = (SIZE - STROKE) / 2 - 1.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function FocusPage() {
  const { snapshot, toggleFocus } = useModel();
  const focus = snapshot.focus;

  const progress = Math.min(
    1,
    Math.max(0, 1 - focus.remainingMs / Math.max(1, focus.totalMs)),
  );

  return (
    <div className="page focus-page">
      <div className="focus-ring">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle
            className="focus-track"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
          />
          <circle
            className="focus-progress"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <span className="focus-time tnum">{formatDuration(focus.remainingMs)}</span>
      </div>

      <div className="focus-copy">
        <p className="t-label focus-kicker">
          Focus · round {focus.round} of {focus.roundsTotal}
        </p>
        <p className="t-body focus-state">
          {focus.running ? "Stay with it" : "Paused"}
        </p>
        <div className="round-dots" aria-hidden="true">
          {Array.from({ length: focus.roundsTotal }, (_, index) => (
            <span
              key={index}
              className="round-dot"
              data-state={
                index < focus.round - 1
                  ? "done"
                  : index === focus.round - 1
                    ? "current"
                    : undefined
              }
            />
          ))}
        </div>
      </div>

      <IconButton
        label={focus.running ? "Pause focus timer" : "Resume focus timer"}
        primary
        onClick={toggleFocus}
      >
        {focus.running ? <PauseIcon /> : <PlayIcon />}
      </IconButton>
    </div>
  );
}
