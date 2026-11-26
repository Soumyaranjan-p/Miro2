import type { ReactNode } from "react";

interface IconButtonProps {
  label: string;
  primary?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

/**
 * §1 — feedback is CSS :active, so it lands on pointer-down with no JS delay.
 */
export function IconButton({ label, primary, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className="icon-button"
      data-primary={primary ? "true" : undefined}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
