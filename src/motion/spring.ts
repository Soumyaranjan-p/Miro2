/**
 * A very small spring engine.
 *
 * §4 of apple-design asks for springs, not durations: damping ratio + response.
 * §3 asks every animation to be interruptible, so `setTarget` never restarts
 * from zero — it keeps the live position and velocity and re-targets in place.
 * That also gives us velocity blending on reversal for free.
 */

export interface SpringConfig {
  /** Damping ratio. 1 = critically damped, < 1 overshoots. */
  damping: number;
  /** Seconds to reach the target. Not a duration. */
  response: number;
}

export const springPresets = {
  /** Default UI: no overshoot (§4 defaults). */
  ui: { response: 0.34, damping: 1 },
  /** Drawer / sheet: reserved for momentum-driven motion (§4 table). */
  momentum: { response: 0.32, damping: 0.8 },
  /** The tab indicator repositions often; keep it a touch quicker. */
  tab: { response: 0.3, damping: 1 },
} satisfies Record<string, SpringConfig>;

const SUBSTEP = 1 / 480;
const REST_DISTANCE = 0.0015;
const REST_VELOCITY = 0.03;
const MAX_FRAME = 0.064;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export class Spring {
  private current: number;
  private target: number;
  private velocity = 0;
  private frame = 0;
  private lastTime = 0;
  private running = false;
  private readonly stiffness: number;
  private readonly damping: number;

  constructor(
    value: number,
    config: SpringConfig,
    private readonly onChange: (value: number) => void,
  ) {
    const omega = (2 * Math.PI) / Math.max(0.05, config.response);
    this.stiffness = omega * omega;
    this.damping = 2 * config.damping * omega;
    this.current = value;
    this.target = value;
    onChange(value);
  }

  get value(): number {
    return this.current;
  }

  /** Re-target from the live presentation value (§3). */
  setTarget(target: number, velocity?: number): void {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
    this.start();
  }

  /**
   * §3 — hand the value to a gesture mid-flight. The live position and
   * velocity are kept, so a later `setTarget` resumes from exactly here
   * instead of jumping to a logical value the user never saw.
   */
  pause(): void {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  dispose(): void {
    this.running = false;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    const elapsed = Math.min(MAX_FRAME, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    let remaining = elapsed;
    while (remaining > 0) {
      const step = Math.min(SUBSTEP, remaining);
      // Semi-implicit Euler; stable at this substep for our response range.
      this.velocity +=
        (-this.stiffness * (this.current - this.target) -
          this.damping * this.velocity) *
        step;
      this.current += this.velocity * step;
      remaining -= step;
    }

    if (
      Math.abs(this.velocity) < REST_VELOCITY &&
      Math.abs(this.current - this.target) < REST_DISTANCE
    ) {
      this.current = this.target;
      this.velocity = 0;
      this.running = false;
      this.onChange(this.current);
      return;
    }

    this.onChange(this.current);
    this.frame = requestAnimationFrame(this.tick);
  };
}

/** §6 — Apple's momentum projection, in px. */
export function project(velocity: number, deceleration = 0.998): number {
  return (velocity / 1000) * (deceleration / (1 - deceleration));
}

/** §9 — progressive resistance at an edge. */
export function rubberband(overshoot: number, dimension = 1, constant = 0.55): number {
  const magnitude = Math.abs(overshoot);
  if (magnitude === 0) return 0;
  return (magnitude * dimension * constant) / (dimension + constant * magnitude);
}
