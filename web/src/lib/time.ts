/** Compact relative timestamp for dense lists, e.g. "5m ago" or "3d ago". */
export function formatRelativeTime(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
