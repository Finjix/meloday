export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-spark">✦</span><h2>{title}</h2><p>{text}</p>{action}</div>;
}
