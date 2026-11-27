import { formatDuration } from "../../app/format";
import { useModel } from "../../app/model";
import type { FocusState } from "../../ipc/types";
import { IconButton } from "../controls/IconButton";
import { CheckIcon, PauseIcon, PlayIcon } from "../../ui/icons";

const KIND_LABEL: Record<FocusState["kind"], string> = {
  focus: "Deep work",
  short: "Short break",
  long: "Long break",
};

/**
 * The focus notch, ported from prototypes/focus-notch.html and wired to the
 * real model: caption from the session kind, round counter as the title, the
 * model clock as the big time, pause = toggleFocus, done = endFocus, and the
 * linear bar driven by remaining/total. Pause stays a quiet dark key so the
 * accent done button remains the only bright element on the surface.
 */
export function FocusPage() {
  const { snapshot, toggleFocus, endFocus } = useModel();
  const focus = snapshot.focus;

  const progress = Math.min(
    1,
    Math.max(0, 1 - focus.remainingMs / Math.max(1, focus.totalMs)),
  );

  const next =
    focus.running || focus.remainingMs > 0
      ? focus.kind === "focus"
        ? "Next · Break after this round"
        : "Next · Back to work after this break"
      : "Paused — resume when ready";

  return (
    <div className="page focus-page">
      <div className="focus-row">
        <div className="focus-info">
          <p className="t-label focus-caption">{KIND_LABEL[focus.kind]}</p>
          <p className="t-body focus-title">
            Round {focus.round} of {focus.roundsTotal}
          </p>
        </div>

        <span className="focus-big-time t-display tnum">
          {formatDuration(focus.remainingMs)}
        </span>

        <IconButton
          tone="quiet"
          label={focus.running ? "Pause focus timer" : "Resume focus timer"}
          onClick={toggleFocus}
        >
          <span
            className="play-glyphs"
            data-playing={focus.running ? "true" : "false"}
            aria-hidden="true"
          >
            <PlayIcon className="play-glyph play-glyph-play" />
            <PauseIcon className="play-glyph play-glyph-pause" />
          </span>
        </IconButton>

        <IconButton tone="accent" label="Finish this session" onClick={endFocus}>
          <CheckIcon />
        </IconButton>
      </div>

      <div
        className="focus-track"
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="focus-bar"
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
        />
      </div>

      <p className="t-label focus-next">{next}</p>
    </div>
  );
}
