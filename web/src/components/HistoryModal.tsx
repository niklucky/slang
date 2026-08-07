import { Button } from './ui/button.js';
import { Modal } from './ui/modal.js';
import { trpc } from '../trpc.js';

export interface HistoryModalProps {
  projectId: number;
  wordId: number;
  wordKey: string;
  /** Filter to one locale; omitted shows the whole key's history. */
  localeId?: number;
  localeLabel?: string;
  open: boolean;
  onClose: () => void;
  /** Called with the locale and value of the version the user picks. */
  onUse: (localeId: number, value: string) => void;
}

function formatValue(value: string | null): string {
  if (value === null) return '∅ (empty)';
  return value || '(empty)';
}

export function HistoryModal({
  projectId,
  wordId,
  wordKey,
  localeId,
  localeLabel,
  open,
  onClose,
  onUse,
}: HistoryModalProps) {
  const history = trpc.words.history.useQuery(
    { projectId, wordId, ...(localeId !== undefined ? { localeId } : {}) },
    { enabled: open },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`History — ${wordKey}`}
      description={localeLabel ? `Changes for ${localeLabel}, newest first.` : 'All locales, newest first.'}
      size="lg"
    >
      {history.isPending && <p className="text-sm text-ink-3">Loading…</p>}
      {history.error && <p className="text-sm text-danger">{history.error.message}</p>}
      {history.data && history.data.length === 0 && (
        <p className="text-sm text-ink-3">No changes recorded yet.</p>
      )}
      {history.data && history.data.length > 0 && (
        <ul className="divide-y divide-line">
          {history.data.map((version) => (
            <li key={version.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-xs text-ink-3">
                  {new Date(version.createdAt).toLocaleString()} ·{' '}
                  {version.changedBy
                    ? `${version.changedBy.name} (${version.changedBy.email})`
                    : 'API'}
                  {' · '}
                  {version.localeCode}
                </p>
                <p className="mt-1 break-words text-sm text-ink">
                  <span className={version.oldValue === null ? 'text-ink-3' : ''}>
                    {formatValue(version.oldValue)}
                  </span>
                  <span className="mx-1.5 text-ink-3">→</span>
                  <span className={version.newValue === null ? 'text-ink-3' : ''}>
                    {formatValue(version.newValue)}
                  </span>
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  onUse(version.localeId, version.newValue ?? '');
                  onClose();
                }}
              >
                Use this version
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
