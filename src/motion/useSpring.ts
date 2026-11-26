import { useCallback, useEffect, useRef, useState } from "react";

import { Spring, prefersReducedMotion, type SpringConfig } from "./spring";

/**
 * Binds a spring to an element.
 *
 * The callback ref stores the node in state so the effect below re-runs when
 * the node mounts, and `setTarget` always continues from the value that is
 * currently on screen (§3 interruptibility).
 */
export function useSpringDriver(
  target: number,
  config: SpringConfig,
  apply: (element: HTMLElement, value: number) => void,
  initial = 0,
): (node: HTMLElement | null) => void {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const springRef = useRef<Spring | null>(null);
  const applyRef = useRef(apply);
  const targetRef = useRef(target);
  applyRef.current = apply;
  targetRef.current = target;

  const bind = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    if (prefersReducedMotion()) {
      springRef.current?.dispose();
      springRef.current = null;
      applyRef.current(element, target);
      return;
    }

    if (!springRef.current) {
      springRef.current = new Spring(initial, config, (value) => {
        if (element) applyRef.current(element, value);
      });
    }

    springRef.current.setTarget(target);
  }, [element, target, config, initial]);

  // §14 — react when the OS setting flips while the app is running.
  useEffect(() => {
    if (!element) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onChange = () => {
      if (query.matches) {
        springRef.current?.dispose();
        springRef.current = null;
        applyRef.current(element, targetRef.current);
      } else if (!springRef.current) {
        springRef.current = new Spring(targetRef.current, config, (value) => {
          applyRef.current(element, value);
        });
      }
    };

    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [element, config]);

  useEffect(
    () => () => {
      springRef.current?.dispose();
      springRef.current = null;
    },
    [element],
  );

  return bind;
}

/** Convenience: drive a single CSS custom property with a spring. */
export function useVarSpring(
  target: number,
  config: SpringConfig,
  property: string,
  format: (value: number) => string = (value) => value.toFixed(4),
  initial?: number,
): (node: HTMLElement | null) => void {
  const apply = useCallback(
    (element: HTMLElement, value: number) => {
      element.style.setProperty(property, format(value));
    },
    [property, format],
  );

  return useSpringDriver(target, config, apply, initial ?? target);
}
