import { formatLiters } from "../../app/format";
import { useModel } from "../../app/model";
import { EmptyState } from "./EmptyState";

export function WaterPage() {
  const { snapshot, drink } = useModel();
  const water = snapshot.water;

  if (water.goalMl <= 0) {
    return (
      <EmptyState
        title="No goal set"
        hint="Choose a daily goal in settings."
      />
    );
  }

  const ratio = Math.min(1, water.todayMl / water.goalMl);
  const reached = ratio >= 1;

  return (
    <div className="page water-page">
      <div className="water-stats">
        <p className="water-amount t-display tnum">
          {formatLiters(water.todayMl)}
          <span className="water-unit"> / {formatLiters(water.goalMl)} L</span>
        </p>
        <p className="t-meta water-caption">
          {reached ? "Goal reached" : `${Math.round(ratio * 100)}% of today`}
          <span aria-hidden="true"> · </span>
          {water.bottleMl} ml bottle
        </p>
      </div>

      <div className="bottle" aria-hidden="true">
        <div className="bottle-fill" style={{ height: `${ratio * 100}%` }} />
      </div>

      <button
        type="button"
        className="drink-button t-label"
        onClick={drink}
        disabled={reached}
      >
        {reached ? "Done" : `Drink ${water.bottleMl} ml`}
      </button>
    </div>
  );
}
