import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

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
  const catalog = trpc.locales.catalog.useQuery();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const words = trpc.words.list.useQuery({
    projectId: id,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const invalidateWords = () => utils.words.list.invalidate({ projectId: id });
  const upsert = trpc.words.upsert.useMutation({ onSuccess: invalidateWords });
  const removeWord = trpc.words.remove.useMutation({ onSuccess: invalidateWords });
  const addLocale = trpc.locales.add.useMutation({
    onSuccess: () => utils.projects.get.invalidate({ projectId: id }),
  });
  const removeLocale = trpc.locales.remove.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate({ projectId: id });
      void invalidateWords();
    },
  });

  const [editing, setEditing] = useState<CellRef | null>(null);
  const [draft, setDraft] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [addLocaleId, setAddLocaleId] = useState<number | ''>('');

  if (details.isPending) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (!details.data) return <p className="text-sm text-red-600">Project not found.</p>;

  const { project, locales, channels } = details.data;
  const defaultChannel = channels[0];
  const availableLocales = (catalog.data ?? []).filter(
    (locale) => !locales.some((attached) => attached.id === locale.id),
  );

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
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">{project.name}</h1>
        {project.description && <p className="mt-1 text-sm text-zinc-500">{project.description}</p>}
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-zinc-500">API key</span>
          <code className="rounded bg-zinc-100 px-2 py-0.5 text-xs">{project.apiKey}</code>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(project.apiKey)}
            className="text-xs text-zinc-600 underline hover:text-zinc-900"
          >
            Copy
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700">Locales</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {locales.map((locale) => (
            <span
              key={locale.id}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
            >
              {locale.code}
              <button
                type="button"
                aria-label={`Remove ${locale.code}`}
                onClick={() => {
                  if (window.confirm(`Remove locale ${locale.code}? Its translations get deleted.`)) {
                    removeLocale.mutate({ projectId: id, localeId: locale.id });
                  }
                }}
                className="text-zinc-400 hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
          <select
            value={addLocaleId}
            onChange={(event) => setAddLocaleId(event.target.value === '' ? '' : Number(event.target.value))}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="">Add locale…</option>
            {availableLocales.map((locale) => (
              <option key={locale.id} value={locale.id}>
                {locale.code} — {locale.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={addLocaleId === ''}
            onClick={() => {
              if (addLocaleId !== '') {
                addLocale.mutate({ projectId: id, localeId: addLocaleId });
                setAddLocaleId('');
              }
            }}
            className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </section>

      <form onSubmit={submitNewKey} className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700">Add key</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="key.name"
            required
            className="w-56 rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
          />
          {locales.map((locale) => (
            <input
              key={locale.id}
              value={newValues[locale.code] ?? ''}
              onChange={(event) =>
                setNewValues((previous) => ({ ...previous, [locale.code]: event.target.value }))
              }
              placeholder={locale.code}
              className="w-40 rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
            />
          ))}
          <button
            type="submit"
            disabled={upsert.isPending || locales.length === 0}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Add key
          </button>
        </div>
        {locales.length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">Attach a locale above before adding keys.</p>
        )}
      </form>

      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search keys and values…"
            className="w-full max-w-sm rounded border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
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
                <tr key={word.id} className="border-b border-zinc-100 align-top hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-700">{word.key}</td>
                  {locales.map((locale) => {
                    const translation = word.translations.find((t) => t.localeId === locale.id);
                    const isEditing =
                      editing?.wordId === word.id && editing.localeId === locale.id;
                    return (
                      <td key={locale.id} className="px-3 py-2">
                        {isEditing ? (
                          <input
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
                            className="w-full rounded border border-zinc-400 px-2 py-1 text-sm focus:outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing({ wordId: word.id, localeId: locale.id });
                              setDraft(translation?.value ?? '');
                            }}
                            className="block w-full cursor-text rounded px-2 py-1 text-left text-sm hover:bg-zinc-100"
                          >
                            {translation?.value || <span className="text-zinc-300">—</span>}
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
                      className="text-xs text-zinc-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {words.data?.length === 0 && (
            <p className="p-4 text-sm text-zinc-500">No keys yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
