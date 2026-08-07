import { ListFilter, Plus, Settings, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { AddKeyModal } from '../components/AddKeyModal.js';
import { MembersModal } from '../components/MembersModal.js';
import { ProjectFormModal } from '../components/ProjectFormModal.js';
import { Button } from '../components/ui/button.js';
import { Input, Textarea } from '../components/ui/input.js';
import { MultiSelect } from '../components/ui/multi-select.js';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  // Locales removed from this set are hidden from the table; new locales default to visible.
  const [excludedLocaleIds, setExcludedLocaleIds] = useState<number[]>([]);
  const [missingOnly, setMissingOnly] = useState(false);

  if (details.isPending) return <p className="text-sm text-ink-3">Loading…</p>;
  if (!details.data) return <p className="text-sm text-danger">Project not found.</p>;

  const { project, locales, channels } = details.data;
  const defaultChannel = channels[0];
  const visibleLocales = locales.filter((locale) => !excludedLocaleIds.includes(locale.id));
  const visibleWords = missingOnly
    ? (words.data ?? []).filter((word) =>
        visibleLocales.some(
          (locale) => !word.translations.some((t) => t.localeId === locale.id && t.value),
        ),
      )
    : (words.data ?? []);

  function commitCell(wordId: number, key: string, localeId: number, value: string) {
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
      translations: [...untouched, { localeId, channelId: defaultChannel?.id ?? null, value }],
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{project.name}</h1>
          {project.description && <p className="mt-1 text-sm text-ink-2">{project.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setMembersOpen(true)}>
            <Users size={14} />
            Members
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} />
            Settings
          </Button>
          <Button size="sm" onClick={() => setAddKeyOpen(true)} disabled={locales.length === 0}>
            <Plus size={14} />
            Add key
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <Input
            size="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search keys and values…"
            className="max-w-sm"
          />
          <MultiSelect
            size="sm"
            className="w-48"
            allLabel="All locales"
            options={locales.map((locale) => ({ value: String(locale.id), label: locale.code }))}
            selected={visibleLocales.map((locale) => String(locale.id))}
            onChange={(next) => {
              const selectedIds = new Set(next.map(Number));
              setExcludedLocaleIds(
                locales
                  .filter((locale) => !selectedIds.has(locale.id))
                  .map((locale) => locale.id),
              );
            }}
          />
          <Button
            variant={missingOnly ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMissingOnly((prev) => !prev)}
            title="Show only keys missing a translation in the selected locales"
          >
            <ListFilter size={14} />
            Missing only
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="sticky left-0 z-20 min-w-48 border-b border-r border-line bg-surface px-3 py-2 font-medium">
                  Key
                </th>
                {visibleLocales.map((locale) => (
                  <th
                    key={locale.id}
                    className="min-w-40 border-b border-line bg-surface px-3 py-2 font-medium"
                  >
                    {locale.code}
                  </th>
                ))}
                <th className="sticky right-0 z-20 border-b border-l border-line bg-surface px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleWords.map((word) => (
                <tr
                  key={word.id}
                  className="group align-top hover:bg-fill/60 [&:last-child_td]:border-b-0"
                >
                  <td className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-2 font-mono text-xs text-ink-2 group-hover:bg-fill">
                    {word.key}
                  </td>
                  {visibleLocales.map((locale) => {
                    const translation = word.translations.find((t) => t.localeId === locale.id);
                    const isEditing =
                      editing?.wordId === word.id && editing.localeId === locale.id;
                    return (
                      <td key={locale.id} className="border-b border-line px-3 py-2">
                        {isEditing ? (
                          <Textarea
                            size="sm"
                            autoFocus
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => {
                              commitCell(word.id, word.key, locale.id, draft);
                              setEditing(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
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
                  <td className="sticky right-0 z-10 border-b border-l border-line bg-surface px-3 py-2 text-right group-hover:bg-fill">
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
          {visibleWords.length === 0 && !words.isPending && (
            <p className="p-4 text-sm text-ink-3">
              {missingOnly ? 'No missing translations for the selected locales.' : 'No keys yet.'}
            </p>
          )}
        </div>
        {(upsert.error || removeWord.error) && (
          <p className="border-t border-line p-3 text-sm text-danger">
            {(upsert.error ?? removeWord.error)?.message}
          </p>
        )}
      </section>

      <AddKeyModal
        projectId={id}
        locales={locales}
        channelId={defaultChannel?.id}
        open={addKeyOpen}
        onClose={() => setAddKeyOpen(false)}
      />

      <ProjectFormModal
        mode="edit"
        projectId={id}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <MembersModal projectId={id} open={membersOpen} onClose={() => setMembersOpen(false)} />
    </div>
  );
}
