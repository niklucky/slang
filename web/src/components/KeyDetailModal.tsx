import { History } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { trpc } from '../trpc.js';
import { HistoryModal } from './HistoryModal.js';
import type { CatalogLocale } from './ProjectFormModal.js';
import { Button } from './ui/button.js';
import { IconButton } from './ui/icon-button.js';
import { Textarea } from './ui/input.js';
import { Modal } from './ui/modal.js';

export interface KeyDetailWord {
  id: number;
  key: string;
  translations: Array<{ localeId: number; value: string }>;
}

export interface KeyDetailModalProps {
  projectId: number;
  word: KeyDetailWord;
  locales: CatalogLocale[];
  channelId: number | undefined;
  open: boolean;
  onClose: () => void;
}

interface HistoryState {
  localeId?: number;
  localeLabel?: string;
}

export function KeyDetailModal({
  projectId,
  word,
  locales,
  channelId,
  open,
  onClose,
}: KeyDetailModalProps) {
  const utils = trpc.useUtils();

  const [values, setValues] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<HistoryState | null>(null);
  const upsert = trpc.words.upsert.useMutation();

  useEffect(() => {
    if (!open) return;
    const next: Record<number, string> = {};
    for (const translation of word.translations) {
      next[translation.localeId] = translation.value;
    }
    setValues(next);
  }, [open, word]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    upsert.mutate(
      {
        projectId,
        key: word.key,
        translations: locales.map((locale) => ({
          localeId: locale.id,
          channelId: channelId ?? null,
          value: values[locale.id] ?? '',
        })),
      },
      {
        onSuccess: () => {
          void utils.words.list.invalidate({ projectId });
          void utils.words.history.invalidate({ projectId, wordId: word.id });
          onClose();
        },
      },
    );
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={word.key}
        description="Edit the translation for each locale, then save."
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-2">Translations</span>
              <IconButton label="Key history" size="sm" onClick={() => setHistory({})}>
                <History size={14} />
              </IconButton>
            </div>
            {locales.map((locale) => (
              <div key={locale.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-2">
                    {locale.code} — {locale.name}
                  </span>
                  <IconButton
                    label={`History for ${locale.code}`}
                    size="sm"
                    onClick={() =>
                      setHistory({ localeId: locale.id, localeLabel: `${locale.code} — ${locale.name}` })
                    }
                  >
                    <History size={14} />
                  </IconButton>
                </div>
                <Textarea
                  value={values[locale.id] ?? ''}
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [locale.id]: event.target.value }))
                  }
                  placeholder={locale.code}
                />
              </div>
            ))}
          </div>

          {upsert.error && <p className="mt-3 text-sm text-danger">{upsert.error.message}</p>}

          <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 rounded-b-xl border-t border-line px-5 py-4">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>

      <HistoryModal
        projectId={projectId}
        wordId={word.id}
        wordKey={word.key}
        localeId={history?.localeId}
        localeLabel={history?.localeLabel}
        open={history !== null}
        onClose={() => setHistory(null)}
        onUse={(localeId, value) => setValues((previous) => ({ ...previous, [localeId]: value }))}
      />
    </>
  );
}
