import type { ReactNode } from "react";

interface IconButtonProps {
  label: string;
  primary?: boolean;
  /** quiet = dark-gray well (prototype pause); accent = the one bright key. */
  tone?: "quiet" | "accent";
  onClick?: () => void;
  children: ReactNode;
}

/**
 * §1 — feedback is CSS :active, so it lands on pointer-down with no JS delay.
 */
export function IconButton({ label, primary, tone, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className="icon-button"
      data-primary={primary ? "true" : undefined}
      data-tone={tone}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
