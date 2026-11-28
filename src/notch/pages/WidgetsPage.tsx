import { formatDuration } from "../../app/format";
import { useModel } from "../../app/model";
import { TodoIcon, WaterIcon } from "../../ui/icons";

const KIND_LABEL: Record<string, string> = {
  focus: "Deep work",
  short: "Short break",
  long: "Long break",
};

/**
 * Widgets is the glance view, and the three facts it holds are not equals:
 * the session clock is live and time-pressing, water is a fraction, the
 * next task is a line of text. So the layout is asymmetric — one hero zone
 * for the clock with its round dots, one digest column beside it — grouped
 * by hairlines instead of card boxes. Each zone is a button that opens its
 * page; a widget summarizes, the page does the work.
 */
export function WidgetsPage() {
  const { snapshot, setPage } = useModel();
  const focus = snapshot.focus;
  const water = snapshot.water;
  const open = snapshot.todo.filter((item) => !item.done);
  const nextTask = open[0];
  const inSession = focus.running || focus.remainingMs > 0 || focus.round > 1;

  return (
    <div className="page widgets-page">
      <button
        type="button"
        className="widget-hero"
        onClick={() => setPage("focus")}
        aria-label="Open Focus"
      >
        <span className="t-display widget-time tnum">
          {inSession ? formatDuration(focus.remainingMs) : formatDuration(focus.totalMs)}
        </span>
        <span className="t-body widget-hero-sub">
          {!inSession
            ? "Start a round"
            : focus.running
              ? KIND_LABEL[focus.kind] ?? "Deep work"
              : "Paused"}
        </span>
        {inSession && (
          <span className="widget-rounds" aria-hidden="true">
            {Array.from({ length: focus.roundsTotal }, (_, i) => (
              <i
                key={i}
                className="widget-round"
                data-done={i < focus.round ? "true" : undefined}
                data-current={
                  i === focus.round - 1 && focus.running ? "true" : undefined
                }
              />
            ))}
          </span>
        )}
      </button>

      <div className="widget-side">
        <button
          type="button"
          className="widget-row"
          onClick={() => setPage("water")}
          aria-label="Open Water"
        >
          <span className="widget-row-icon" aria-hidden="true">
            <WaterIcon />
          </span>
          <span className="t-title widget-row-value tnum">
            {(water.todayMl / 1000).toFixed(1)}
            <span className="widget-row-unit">
              {" "}
              of {(water.goalMl / 1000).toFixed(1)} L
            </span>
          </span>
        </button>

        <button
          type="button"
          className="widget-row"
          onClick={() => setPage("todo")}
          aria-label="Open To-do"
          title={nextTask?.title}
        >
          <span className="widget-row-icon" aria-hidden="true">
            <TodoIcon />
          </span>
          <span className="widget-row-task">
            <span className="t-body widget-task-text">
              {nextTask ? nextTask.title : "All clear"}
            </span>
            {open.length > 0 && (
              <span className="t-label widget-row-meta tnum">
                {open.length} open
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
