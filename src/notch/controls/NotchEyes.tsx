/**
 * The notch's face on the desktop: two eyes that glance around and blink.
 * Ported from prototypes/notch-eyes.html and rescaled to the 152×30 pill via
 * the shared 204×44 viewBox. §16 delight — the resting notch gets a living
 * personality for two paths and two keyframe loops. §14 — both loops stop
 * under reduced motion and the face simply rests open.
 */
export function NotchEyes() {
  return (
    <svg
      className="notch-eyes"
      viewBox="0 0 204 44"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <filter id="notch-eye-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="notch-eyes-look" filter="url(#notch-eye-glow)">
        <path className="notch-eyes-lid" d="M83 19 L95 22.5 L94 27 L84 24.5 Z" />
        <path className="notch-eyes-lid" d="M121 19 L109 22.5 L110 27 L120 24.5 Z" />
      </g>
    </svg>
  );
}
