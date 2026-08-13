import {
  Download,
  MoreHorizontal,
  Plus,
  Settings,
  Upload,
  Users,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { AddKeyModal } from "../components/AddKeyModal.js";
import { ExportModal } from "../components/ExportModal.js";
import { ImportModal } from "../components/ImportModal.js";
import {
  KeyDetailModal,
  type KeyDetailWord,
} from "../components/KeyDetailModal.js";
import { MembersModal } from "../components/MembersModal.js";
import { ProjectFormModal } from "../components/ProjectFormModal.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { IconButton } from "../components/ui/icon-button.js";
import { Input, Textarea } from "../components/ui/input.js";
import { LocaleFlag } from "../components/ui/locale-flag.js";
import { MemberStack } from "../components/ui/member-stack.js";
import { Modal } from "../components/ui/modal.js";
import { MultiSelect } from "../components/ui/multi-select.js";
import { trpc } from "../trpc.js";

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

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [showDeleted, setShowDeleted] = useState(false);
  // Locales removed from this set are hidden from the table; new locales default to visible.
  const [excludedLocaleIds, setExcludedLocaleIds] = useState<number[]>([]);
  const [missingOnly, setMissingOnly] = useState(false);

  const visibleLocales = (details.data?.locales ?? []).filter(
    (locale) => !excludedLocaleIds.includes(locale.id),
  );

  const words = trpc.words.list.useInfiniteQuery(
    {
      projectId: id,
      limit: 100,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(showDeleted ? { deleted: true } : {}),
      ...(missingOnly
        ? { missingLocaleIds: visibleLocales.map((locale) => locale.id) }
        : {}),
    },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  // Load the next page when the bottom of the table scrolls into view.
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = words;
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const invalidateWords = () => {
    void utils.words.list.invalidate({ projectId: id });
    void utils.words.history.invalidate();
  };
  const upsert = trpc.words.upsert.useMutation({ onSuccess: invalidateWords });
  const removeWord = trpc.words.remove.useMutation({
    onSuccess: invalidateWords,
  });
  const removePermanently = trpc.words.removePermanently.useMutation({
    onSuccess: invalidateWords,
  });
  const restore = trpc.words.restore.useMutation({
    onSuccess: invalidateWords,
  });
  const updateKey = trpc.words.updateKey.useMutation({
    onSuccess: invalidateWords,
  });
  const removeMany = trpc.words.removeMany.useMutation({
    onSuccess: () => {
      invalidateWords();
      setSelectedIds(new Set());
    },
  });
  const restoreMany = trpc.words.restoreMany.useMutation({
    onSuccess: () => {
      invalidateWords();
      setSelectedIds(new Set());
    },
  });
  const removePermanentlyMany = trpc.words.removePermanentlyMany.useMutation({
    onSuccess: () => {
      invalidateWords();
      setSelectedIds(new Set());
    },
  });

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "restore" | "deletePermanently" | null
  >(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Selection is tied to the current listing; reset it when it changes.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [id, search, showDeleted, missingOnly]);

  const [editing, setEditing] = useState<CellRef | null>(null);
  const [draft, setDraft] = useState("");
  const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailWord, setDetailWord] = useState<KeyDetailWord | null>(null);

  if (details.isPending) return <p className="text-sm text-ink-3">Loading…</p>;
  if (!details.data)
    return <p className="text-sm text-danger">Project not found.</p>;

  const { project, locales, channels, members } = details.data;

  // Only owners ever see a deleted project here; they restore or purge it
  // through the settings modal.
  if (project.deletedAt !== null) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">
                {project.name}
              </h1>
              <Badge tone="danger">Deleted</Badge>
            </div>
            {project.description && (
              <p className="mt-1 text-sm text-ink-2">{project.description}</p>
            )}
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={14} />
            Settings
          </Button>
        </div>
        <div className="rounded-xl border border-danger/30 bg-danger-soft/50 p-4 text-sm text-ink-2">
          This project is deleted: its API key no longer works and members can
          no longer see it. Open Settings to restore it or delete it
          permanently.
        </div>
        <ProjectFormModal
          mode="edit"
          projectId={id}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    );
  }
  const defaultChannel = channels[0];
  const loadedWords = words.data?.pages.flatMap((page) => page.items) ?? [];
  const totalKeys = words.data?.pages[0]?.total ?? 0;
  const visibleWords = loadedWords;

  const selectedCount = selectedIds.size;
  const allSelected =
    visibleWords.length > 0 &&
    visibleWords.every((word) => selectedIds.has(word.id));
  const someSelected = visibleWords.some((word) => selectedIds.has(word.id));
  if (selectAllRef.current) {
    selectAllRef.current.indeterminate = someSelected && !allSelected;
  }

  function toggleAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(visibleWords.map((word) => word.id)),
    );
  }

  function toggleOne(wordId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }

  function confirmGroupAction() {
    const wordIds = [...selectedIds];
    if (confirmAction === "delete")
      removeMany.mutate({ projectId: id, wordIds });
    if (confirmAction === "restore")
      restoreMany.mutate({ projectId: id, wordIds });
    if (confirmAction === "deletePermanently")
      removePermanentlyMany.mutate({ projectId: id, wordIds });
    setConfirmAction(null);
  }

  const confirmConfig = {
    delete: {
      title: `Delete ${selectedCount} ${selectedCount === 1 ? "key" : "keys"}?`,
      description:
        "Selected keys and their translations will be marked as deleted.",
      confirmLabel: "Delete",
    },
    restore: {
      title: `Restore ${selectedCount} ${selectedCount === 1 ? "key" : "keys"}?`,
      description: "Selected keys and their translations will be restored.",
      confirmLabel: "Restore",
    },
    deletePermanently: {
      title: `Permanently delete ${selectedCount} ${selectedCount === 1 ? "key" : "keys"}?`,
      description:
        "Keys, translations and history will be removed for good. This cannot be undone.",
      confirmLabel: "Delete permanently",
    },
  } as const;

  function commitCell(
    wordId: number,
    key: string,
    localeId: number,
    value: string,
  ) {
    const word = words.data?.pages
      .flatMap((page) => page.items)
      .find((entry) => entry.id === wordId);
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
      translations: [
        ...untouched,
        { localeId, channelId: defaultChannel?.id ?? null, value },
      ],
    });
  }

  function commitKeyEdit(wordId: number, currentKey: string) {
    const nextKey = keyDraft.trim();
    if (nextKey && nextKey !== currentKey) {
      updateKey.mutate({ projectId: id, wordId, key: nextKey });
    }
    setEditingKeyId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-1 text-sm text-ink-2">{project.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MemberStack names={members.map((member) => member.name)} />
          <Button
            variant="secondary"
            size="md"
            onClick={() => setMembersOpen(true)}
          >
            <Users size={14} />
            Members
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={14} />
            Settings
          </Button>
          <Button
            size="md"
            onClick={() => setAddKeyOpen(true)}
            disabled={locales.length === 0}
          >
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
          <span className="text-sm text-ink-3">Total: {totalKeys} keys</span>
          <MultiSelect
            size="sm"
            className="w-48"
            allLabel="All locales"
            options={locales.map((locale) => ({
              value: String(locale.id),
              label: (
                <LocaleFlag
                  code={locale.code}
                  name={locale.name}
                  countryCode={locale.countryCode}
                />
              ),
              triggerLabel: locale.code,
              hint: `${locale.code} — ${locale.name}`,
            }))}
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
          <label
            className="flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-surface px-2.5 text-sm text-ink transition-colors hover:bg-fill"
            title="Show only keys missing a translation in the selected locales"
          >
            <input
              type="checkbox"
              className="accent-accent"
              checked={missingOnly}
              onChange={() => setMissingOnly((prev) => !prev)}
            />
            Missing only
          </label>
          <label
            className="flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-surface px-2.5 text-sm text-ink transition-colors hover:bg-fill"
            title="Show deleted keys instead of live ones"
          >
            <input
              type="checkbox"
              className="accent-accent"
              checked={showDeleted}
              onChange={() => setShowDeleted((prev) => !prev)}
            />
            Show deleted
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={14} />
              Import
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExportOpen(true)}
              disabled={locales.length === 0}
            >
              <Download size={14} />
              Export
            </Button>
            {showDeleted ? (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={selectedCount === 0}
                  onClick={() => setConfirmAction("restore")}
                >
                  Restore{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={selectedCount === 0}
                  onClick={() => setConfirmAction("deletePermanently")}
                >
                  Delete permanently
                  {selectedCount > 0 ? ` (${selectedCount})` : ""}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  disabled
                  title="Coming soon"
                >
                  <Wand2 size={14} />
                  Auto translate
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={selectedCount === 0}
                  onClick={() => setConfirmAction("delete")}
                >
                  Delete{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="sticky left-0 z-20 w-12 min-w-12 border-b border-r border-line bg-surface px-3 py-2 text-right font-medium">
                  #
                </th>
                <th className="sticky left-12 z-20 min-w-48 border-b border-r border-line bg-surface px-3 py-2 font-medium">
                  <label className="flex items-center gap-2">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-accent"
                      checked={allSelected}
                      onChange={toggleAll}
                      title="Select all keys on this page"
                    />
                    Key
                  </label>
                </th>
                {visibleLocales.map((locale) => (
                  <th
                    key={locale.id}
                    className="min-w-40 border-b border-line bg-surface px-3 py-2 font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <LocaleFlag
                        code={locale.code}
                        name={locale.name}
                        countryCode={locale.countryCode}
                        placement="bottom"
                      />
                      <span className="normal-case">{locale.name}</span>
                    </span>
                  </th>
                ))}
                <th className="sticky right-0 z-20 border-b border-l border-line bg-surface px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleWords.map((word, index) => {
                const isDeleted = word.deletedAt !== null;
                return (
                  <tr
                    key={word.id}
                    className={`group align-top [&:last-child_td]:border-b-0 ${
                      isDeleted
                        ? "bg-danger-soft/60 text-danger"
                        : "hover:bg-fill/60"
                    }`}
                  >
                    <td
                      className={`sticky left-0 z-10 w-12 min-w-12 border-b border-r border-line px-3 py-2 text-right text-xs ${
                        isDeleted
                          ? "bg-danger-soft text-danger"
                          : "bg-surface text-ink-3 group-hover:bg-fill"
                      }`}
                    >
                      {index + 1}
                    </td>
                    <td
                      className={`sticky left-12 z-10 border-b border-r border-line px-3 py-2 font-mono text-xs ${
                        isDeleted
                          ? "bg-danger-soft text-danger"
                          : "bg-surface text-ink-2 group-hover:bg-fill"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 shrink-0 accent-accent"
                          checked={selectedIds.has(word.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleOne(word.id)}
                          title={`Select ${word.key}`}
                        />
                        {editingKeyId === word.id ? (
                          <Input
                            size="sm"
                            autoFocus
                            className="min-w-0 flex-1 font-mono text-xs"
                            value={keyDraft}
                            onChange={(event) =>
                              setKeyDraft(event.target.value)
                            }
                            onBlur={() => commitKeyEdit(word.id, word.key)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitKeyEdit(word.id, word.key);
                              }
                              if (event.key === "Escape") setEditingKeyId(null);
                            }}
                          />
                        ) : isDeleted ? (
                          <span className="min-w-0 flex-1 break-all px-1 py-0.5 line-through">
                            {word.key}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingKeyId(word.id);
                              setKeyDraft(word.key);
                            }}
                            className="min-w-0 flex-1 cursor-text break-all rounded-md px-1 py-0.5 text-left transition-colors hover:bg-fill"
                            title="Click to rename"
                          >
                            {word.key}
                          </button>
                        )}
                        <IconButton
                          label={`Details for ${word.key}`}
                          size="sm"
                          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          onClick={() => setDetailWord(word)}
                        >
                          <MoreHorizontal size={14} />
                        </IconButton>
                      </div>
                    </td>
                    {visibleLocales.map((locale) => {
                      const translation = word.translations.find(
                        (t) => t.localeId === locale.id,
                      );
                      const isEditing =
                        editing?.wordId === word.id &&
                        editing.localeId === locale.id;
                      return (
                        <td
                          key={locale.id}
                          className="border-b border-line px-3 py-2"
                        >
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
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  commitCell(
                                    word.id,
                                    word.key,
                                    locale.id,
                                    draft,
                                  );
                                  setEditing(null);
                                }
                                if (event.key === "Escape") setEditing(null);
                              }}
                            />
                          ) : isDeleted ? (
                            <span className="block w-full px-2 py-1 text-left text-sm">
                              {translation?.value || (
                                <span className="text-ink-3">—</span>
                              )}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditing({
                                  wordId: word.id,
                                  localeId: locale.id,
                                });
                                setDraft(translation?.value ?? "");
                              }}
                              className="block w-full cursor-text rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-fill"
                            >
                              {translation?.value || (
                                <span className="text-ink-3">—</span>
                              )}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className={`sticky right-0 z-10 border-b border-l border-line px-3 py-2 text-right ${
                        isDeleted
                          ? "bg-danger-soft"
                          : "bg-surface group-hover:bg-fill"
                      }`}
                    >
                      {isDeleted ? (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              restore.mutate({ projectId: id, wordId: word.id })
                            }
                            className="text-xs font-medium text-success transition-colors hover:underline"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Permanently delete key "${word.key}"? This cannot be undone.`,
                                )
                              ) {
                                removePermanently.mutate({
                                  projectId: id,
                                  wordId: word.id,
                                });
                              }
                            }}
                            className="text-xs font-medium text-danger transition-colors hover:underline"
                          >
                            Delete permanently
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete key "${word.key}"?`)) {
                              removeWord.mutate({
                                projectId: id,
                                wordId: word.id,
                              });
                            }
                          }}
                          className="text-xs text-ink-3 transition-colors hover:text-danger"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div ref={loadMoreRef} />
          {words.isFetchingNextPage && (
            <p className="p-4 text-sm text-ink-3">Loading more keys…</p>
          )}
          {visibleWords.length === 0 && !words.isPending && (
            <p className="p-4 text-sm text-ink-3">
              {missingOnly
                ? "No missing translations for the selected locales."
                : "No keys yet."}
            </p>
          )}
        </div>
        {(upsert.error ||
          removeWord.error ||
          removePermanently.error ||
          restore.error ||
          updateKey.error ||
          removeMany.error ||
          restoreMany.error ||
          removePermanentlyMany.error) && (
          <p className="border-t border-line p-3 text-sm text-danger">
            {
              (
                upsert.error ??
                removeWord.error ??
                removePermanently.error ??
                restore.error ??
                updateKey.error ??
                removeMany.error ??
                restoreMany.error ??
                removePermanentlyMany.error
              )?.message
            }
          </p>
        )}
      </section>

      {confirmAction && (
        <Modal
          open={confirmAction !== null}
          onClose={() => setConfirmAction(null)}
          title={confirmConfig[confirmAction].title}
          description={confirmConfig[confirmAction].description}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
              <Button
                variant={confirmAction === "restore" ? "primary" : "danger"}
                disabled={
                  removeMany.isPending ||
                  restoreMany.isPending ||
                  removePermanentlyMany.isPending
                }
                onClick={confirmGroupAction}
              >
                {confirmConfig[confirmAction].confirmLabel}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">
            This will apply to {selectedCount} selected{" "}
            {selectedCount === 1 ? "key" : "keys"}.
          </p>
        </Modal>
      )}

      <AddKeyModal
        projectId={id}
        locales={locales}
        channelId={defaultChannel?.id}
        open={addKeyOpen}
        onClose={() => setAddKeyOpen(false)}
      />

      <ExportModal
        projectId={id}
        projectName={project.name}
        locales={locales}
        selectedKeyIds={[...selectedIds]}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      <ImportModal
        projectId={id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <ProjectFormModal
        mode="edit"
        projectId={id}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <MembersModal
        projectId={id}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
      />

      {detailWord && (
        <KeyDetailModal
          projectId={id}
          word={detailWord}
          locales={locales}
          channelId={defaultChannel?.id}
          open={detailWord !== null}
          onClose={() => setDetailWord(null)}
        />
      )}
    </div>
  );
}
