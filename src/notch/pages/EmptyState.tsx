export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="empty">
      <p className="t-body empty-title">{title}</p>
      <p className="t-meta empty-hint">{hint}</p>
    </div>
  );
}
