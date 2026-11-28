import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useModel } from "../app/model";
import { PAGE_LABELS } from "../app/pages";
import { springPresets } from "../motion/spring";
import { useVarSpring } from "../motion/useSpring";
import type { PageId } from "../ipc/types";
import {
  FocusIcon,
  MusicIcon,
  SettingsIcon,
  ShelfIcon,
  SystemIcon,
  TodoIcon,
  UsageIcon,
  WaterIcon,
  WidgetsIcon,
} from "../ui/icons";

function PageIcon({ page }: { page: PageId }) {
  switch (page) {
    case "music":
      return <MusicIcon />;
    case "widgets":
      return <WidgetsIcon />;
    case "usage":
      return <UsageIcon />;
    case "focus":
      return <FocusIcon />;
    case "water":
      return <WaterIcon />;
    case "shelf":
      return <ShelfIcon />;
    case "todo":
      return <TodoIcon />;
    case "system":
      return <SystemIcon />;
    case "settings":
      return <SettingsIcon />;
    default:
      return null;
  }
}

export function PageTabs() {
  const { page, setPage, snapshot } = useModel();
  const listRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ x: 0, width: 0 });

  const pages = snapshot.notch.pagesOrder.filter(
    (id) => id !== "clock" && !snapshot.notch.pagesHidden.includes(id),
  );

  useLayoutEffect(() => {
    const measure = () => {
      const active =
        listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      setGeometry({ x: active.offsetLeft, width: active.offsetWidth });
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    void document.fonts?.ready.then(measure).catch(() => undefined);

    return () => observer.disconnect();
  }, [page, pages.length]);

  // §3 — the indicator is two independent springs (position and width), so a
  // retarget mid-flight never jumps and rapid tab clicks feel continuous.
  const bindX = useVarSpring(
    geometry.x,
    springPresets.tab,
    "--ind-x",
    (value) => `${value.toFixed(2)}px`,
    geometry.x,
  );
  const bindWidth = useVarSpring(
    geometry.width,
    springPresets.tab,
    "--ind-w",
    (value) => `${value.toFixed(2)}px`,
    geometry.width,
  );
  const bindIndicator = useMemo(
    () => (node: HTMLElement | null) => {
      bindX(node);
      bindWidth(node);
    },
    [bindX, bindWidth],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = pages.indexOf(page);
    const step = event.key === "ArrowRight" ? 1 : pages.length - 1;
    const next = pages[(index + step) % pages.length];
    setPage(next);
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-page="${next}"]`)
        ?.focus();
    });
  };

  return (
    <div
      ref={listRef}
      className="notch-tabs"
      role="tablist"
      aria-label="Notch pages"
      onKeyDown={onKeyDown}
    >
      {geometry.width > 0 ? (
        <span className="tab-indicator" ref={bindIndicator} aria-hidden="true" />
      ) : null}

      {pages.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          data-page={id}
          data-tip={PAGE_LABELS[id]}
          className="tab"
          aria-selected={page === id}
          aria-label={PAGE_LABELS[id]}
          tabIndex={page === id ? 0 : -1}
          // §1 — commit on pointer-down: the page is already there before the
          // pointer comes back up.
          onPointerDown={() => setPage(id)}
          onClick={() => setPage(id)}
        >
          <PageIcon page={id} />
        </button>
      ))}
    </div>
  );
}
