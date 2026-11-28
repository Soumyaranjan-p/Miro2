/** "Resets in 51 min" / "Resets in 2h" / "Resets Thu 12:00 AM". */
export function formatResets(iso: string): string {
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return "";
  const diffMinutes = (target - Date.now()) / 60_000;
  if (diffMinutes <= 0) return "Resetting…";
  if (diffMinutes < 60) {
    return `Resets in ${Math.max(1, Math.round(diffMinutes))} min`;
  }
  if (diffMinutes < 10 * 60) {
    const hours = Math.floor(diffMinutes / 60);
    const minutes = Math.round(diffMinutes % 60);
    return minutes > 0 ? `Resets in ${hours}h ${minutes} min` : `Resets in ${hours}h`;
  }
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(target));
  return `Resets ${formatted}`;
}

/** 89285631 → "89.3M"; 12400 → "12.4K". */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
