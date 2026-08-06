import { Settings } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

import { ProjectFormModal } from '../components/ProjectFormModal.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { trpc } from '../trpc.js';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

interface CellRef {
  wordId: number;
  localeId: number;
}

export function ProjectPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const utils = trpc.useUtils();

  const details = trpc.projects.get.useQuery({ projectId: id });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const words = trpc.words.list.useQuery({
    projectId: id,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const invalidateWords = () => utils.words.list.invalidate({ projectId: id });
  const upsert = trpc.words.upsert.useMutation({ onSuccess: invalidateWords });
  const removeWord = trpc.words.remove.useMutation({ onSuccess: invalidateWords });

  const [editing, setEditing] = useState<CellRef | null>(null);
  const [draft, setDraft] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (details.isPending) return <p className="text-sm text-ink-3">Loading…</p>;
  if (!details.data) return <p className="text-sm text-danger">Project not found.</p>;

  const { project, locales, channels } = details.data;
  const defaultChannel = channels[0];

  function commitCell(wordId: number, key: string, localeId: number, value: string) {
    if (!defaultChannel) return;
    const word = words.data?.find((entry) => entry.id === wordId);
    const untouched = (word?.translations ?? [])
      .filter((translation) => translation.localeId !== localeId)
      .map((translation) => ({
        localeId: translation.localeId,
        channelId: translation.channelId,
        value: translation.value,
      }));
    upsert.mutate({
      projectId: id,
      key,
      translations: [...untouched, { localeId, channelId: defaultChannel.id, value }],
    });
  }

  function submitNewKey(event: FormEvent) {
    event.preventDefault();
    if (!defaultChannel) return;
    upsert.mutate(
      {
        projectId: id,
        key: newKey,
        translations: locales.map((locale) => ({
          localeId: locale.id,
          channelId: defaultChannel.id,
          value: newValues[locale.code] ?? '',
        })),
      },
      {
        onSuccess: () => {
          setNewKey('');
          setNewValues({});
        },
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
          {project.description && <p className="mt-1 text-sm text-ink-2">{project.description}</p>}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings size={14} />
          Settings
        </Button>
      </div>

      <form onSubmit={submitNewKey} className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-2">Add key</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            size="sm"
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="key.name"
            required
            className="w-56"
          />
          {locales.map((locale) => (
            <Input
              key={locale.id}
              size="sm"
              value={newValues[locale.code] ?? ''}
              onChange={(event) =>
                setNewValues((previous) => ({ ...previous, [locale.code]: event.target.value }))
              }
              placeholder={locale.code}
              className="w-40"
            />
          ))}
          <Button size="sm" type="submit" disabled={upsert.isPending || locales.length === 0}>
            Add key
          </Button>
        </div>
        {locales.length === 0 && (
          <p className="mt-2 text-sm text-ink-3">Add a locale in Settings before adding keys.</p>
        )}
      </form>

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line p-3">
          <Input
            size="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search keys and values…"
            className="max-w-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="px-3 py-2 font-medium">Key</th>
                {locales.map((locale) => (
                  <th key={locale.id} className="px-3 py-2 font-medium">
                    {locale.code}
                  </th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {words.data?.map((word) => (
                <tr key={word.id} className="border-b border-line align-top last:border-0 hover:bg-fill/60">
                  <td className="px-3 py-2 font-mono text-xs text-ink-2">{word.key}</td>
                  {locales.map((locale) => {
                    const translation = word.translations.find((t) => t.localeId === locale.id);
                    const isEditing =
                      editing?.wordId === word.id && editing.localeId === locale.id;
                    return (
                      <td key={locale.id} className="px-3 py-2">
                        {isEditing ? (
                          <Input
                            size="sm"
                            autoFocus
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => {
                              commitCell(word.id, word.key, locale.id, draft);
                              setEditing(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                commitCell(word.id, word.key, locale.id, draft);
                                setEditing(null);
                              }
                              if (event.key === 'Escape') setEditing(null);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing({ wordId: word.id, localeId: locale.id });
                              setDraft(translation?.value ?? '');
                            }}
                            className="block w-full cursor-text rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-fill"
                          >
                            {translation?.value || <span className="text-ink-3">—</span>}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete key "${word.key}"?`)) {
                          removeWord.mutate({ projectId: id, wordId: word.id });
                        }
                      }}
                      className="text-xs text-ink-3 transition-colors hover:text-danger"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {words.data?.length === 0 && <p className="p-4 text-sm text-ink-3">No keys yet.</p>}
        </div>
      </section>

      <ProjectFormModal
        mode="edit"
        projectId={id}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
