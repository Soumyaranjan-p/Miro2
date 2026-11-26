import { formatClock } from "../app/format";
import { useModel } from "../app/model";
import { PageStage } from "./PageStage";
import { PageTabs } from "./PageTabs";

/**
 * §16 Simplicity — the old header repeated the selected tab's label and the
 * clock from the collapsed pill. Both are removed: the tab answers "where am
 * I?" and the clock keeps only a quiet meta presence, giving the actual
 * content back the vertical space it was spending on chrome.
 */
export function ExpandedPanel() {
  const { clock } = useModel();

  return (
    <div className="notch-expanded">
      <div className="notch-content">
        <PageStage />
      </div>
      <time className="notch-clock t-meta tnum" dateTime={clock.toISOString()}>
        {formatClock(clock)}
      </time>
      <PageTabs />
    </div>
  );
}
