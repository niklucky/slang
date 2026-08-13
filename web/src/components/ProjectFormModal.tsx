import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { trpc } from '../trpc.js';
import { Badge } from './ui/badge.js';
import { Button } from './ui/button.js';
import { Field, Input, Select, Textarea } from './ui/input.js';
import { Modal } from './ui/modal.js';
import { LocaleFlag } from './ui/locale-flag.js';

export interface CatalogLocale {
  id: number;
  code: string;
  name: string;
  title: string;
  countryCode: string;
}

interface ProjectSnapshot {
  name: string;
  url: string | null;
  description: string | null;
  apiKey: string;
  /** Dates travel as ISO strings over the plain-JSON tRPC link. */
  deletedAt: string | null;
}

export interface ProjectFormModalProps {
  mode: 'create' | 'edit';
  projectId?: number;
  open: boolean;
  onClose: () => void;
}

export function ProjectFormModal({ mode, projectId, open, onClose }: ProjectFormModalProps) {
  const isEdit = mode === 'edit';

  const details = trpc.projects.get.useQuery(
    { projectId: projectId ?? 0 },
    { enabled: isEdit && open && projectId != null },
  );
  const catalog = trpc.locales.catalog.useQuery(undefined, { enabled: isEdit && open });

  let body: ReactNode;
  if (!isEdit) {
    body = <ProjectForm key="create" mode="create" attached={[]} catalog={[]} onClose={onClose} />;
  } else if (details.isPending || catalog.isPending) {
    body = <p className="text-sm text-ink-3">Loading…</p>;
  } else if (!details.data) {
    body = <p className="text-sm text-danger">Project not found.</p>;
  } else if (details.data.project.deletedAt !== null && projectId != null) {
    body = (
      <DeletedProjectPanel
        key={`deleted-${projectId}`}
        projectId={projectId}
        project={details.data.project}
        onClose={onClose}
      />
    );
  } else {
    body = (
      <ProjectForm
        key={`edit-${projectId}`}
        mode="edit"
        projectId={projectId}
        isOwner={details.data.isOwner}
        initialProject={details.data.project}
        attached={details.data.locales}
        catalog={catalog.data ?? []}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Project settings' : 'New project'} size="lg">
      {body}
    </Modal>
  );
}

interface ProjectFormProps {
  mode: 'create' | 'edit';
  projectId?: number;
  isOwner?: boolean;
  initialProject?: ProjectSnapshot;
  attached: CatalogLocale[];
  catalog: CatalogLocale[];
  onClose: () => void;
}

function ProjectForm({ mode, projectId, isOwner = false, initialProject, attached, catalog, onClose }: ProjectFormProps) {
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';

  const [name, setName] = useState(initialProject?.name ?? '');
  const [url, setUrl] = useState(initialProject?.url ?? '');
  const [description, setDescription] = useState(initialProject?.description ?? '');
  const [originalLocaleIds] = useState<number[]>(() => attached.map((locale) => locale.id));
  const [stagedLocaleIds, setStagedLocaleIds] = useState<number[]>(() =>
    attached.map((locale) => locale.id),
  );
  const [addLocaleId, setAddLocaleId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const create = trpc.projects.create.useMutation();
  const update = trpc.projects.update.useMutation();
  const addLocale = trpc.locales.add.useMutation();
  const regenerate = trpc.projects.regenerateApiKey.useMutation();
  const remove = trpc.projects.delete.useMutation();

  const catalogById = new Map(catalog.map((locale) => [locale.id, locale]));
  const stagedLocales = stagedLocaleIds
    .map((id) => catalogById.get(id))
    .filter((locale): locale is CatalogLocale => locale != null);
  const availableLocales = catalog.filter((locale) => !stagedLocaleIds.includes(locale.id));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const trimmedUrl = url.trim();
    const trimmedDescription = description.trim();
    try {
      if (!isEdit) {
        await create.mutateAsync({
          name,
          url: trimmedUrl === '' ? null : trimmedUrl,
          description: trimmedDescription === '' ? null : trimmedDescription,
        });
        await utils.projects.list.invalidate();
      } else if (projectId != null) {
        await update.mutateAsync({
          projectId,
          name,
          url: trimmedUrl === '' ? null : trimmedUrl,
          description: trimmedDescription === '' ? null : trimmedDescription,
        });
        const added = stagedLocaleIds.filter((id) => !originalLocaleIds.includes(id));
        for (const localeId of added) {
          await addLocale.mutateAsync({ projectId, localeId });
        }
        await utils.projects.get.invalidate({ projectId });
        await utils.projects.list.invalidate();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!initialProject) return;
    try {
      await navigator.clipboard.writeText(initialProject.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy to clipboard');
    }
  }

  async function handleRegenerate() {
    if (projectId == null) return;
    if (!window.confirm('Regenerate the API key? The current key stops working immediately.')) {
      return;
    }
    setError(null);
    try {
      await regenerate.mutateAsync({ projectId });
      await utils.projects.get.invalidate({ projectId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate the API key');
    }
  }

  async function handleDelete() {
    if (projectId == null) return;
    setError(null);
    try {
      await remove.mutateAsync({ projectId });
      await utils.projects.list.invalidate();
      onClose();
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the project');
      setConfirmingDelete(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <Field label="Name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My project"
            required
          />
        </Field>
        <Field label="URL">
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://… (optional)"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this project about?"
          />
        </Field>

        {isEdit && (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-2">Locales</span>
            <div className="flex flex-wrap items-center gap-2">
              {stagedLocales.map((locale) => (
                <Badge key={locale.id} className="py-1">
                  <LocaleFlag
                    code={locale.code}
                    name={locale.name}
                    countryCode={locale.countryCode}
                  />
                </Badge>
              ))}
              {stagedLocales.length === 0 && (
                <span className="text-sm text-ink-3">No locales attached yet.</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Select
                size="sm"
                value={addLocaleId}
                onChange={(event) =>
                  setAddLocaleId(event.target.value === '' ? '' : Number(event.target.value))
                }
                className="w-auto"
              >
                <option value="">Add locale…</option>
                {availableLocales.map((locale) => (
                  <option key={locale.id} value={locale.id}>
                    {locale.code} — {locale.name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={addLocaleId === ''}
                onClick={() => {
                  if (addLocaleId !== '') {
                    setStagedLocaleIds((previous) => [...previous, addLocaleId]);
                    setAddLocaleId('');
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>
        )}

        {isEdit && initialProject && (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-2">API key</span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-fill px-3 py-2 font-mono text-xs text-ink-2">
                {initialProject.apiKey}
              </code>
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleRegenerate()}
                disabled={regenerate.isPending}
              >
                {regenerate.isPending ? 'Regenerating…' : 'Regenerate'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="-mx-5 -mb-4 mt-5 flex items-center gap-2 rounded-b-xl border-t border-line px-5 py-4">
        {isEdit && isOwner && (
          <Button
            variant="danger"
            onClick={() => setConfirmingDelete(true)}
            disabled={saving || remove.isPending}
          >
            Delete project
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save changes'
                : 'Create project'}
          </Button>
        </div>
      </div>

      {isEdit && isOwner && (
        <Modal
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title={`Delete "${initialProject?.name ?? 'project'}"?`}
          description="The project disappears from the dashboard and its API key stops working."
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={remove.isPending}
                onClick={() => void handleDelete()}
              >
                {remove.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">
            You can bring it back later from the “Show deleted” list on the dashboard.
          </p>
        </Modal>
      )}
    </form>
  );
}

/** Shown instead of the form when the project is soft-deleted; owner only. */
function DeletedProjectPanel({
  projectId,
  project,
  onClose,
}: {
  projectId: number;
  project: ProjectSnapshot;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restore = trpc.projects.restore.useMutation();
  const destroy = trpc.projects.deletePermanently.useMutation();
  const busy = restore.isPending || destroy.isPending;

  async function handleRestore() {
    setError(null);
    try {
      await restore.mutateAsync({ projectId });
      await utils.projects.get.invalidate({ projectId });
      await utils.projects.list.invalidate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore the project');
    }
  }

  async function handleDeletePermanently() {
    setError(null);
    try {
      await destroy.mutateAsync({ projectId });
      await utils.projects.list.invalidate();
      onClose();
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the project');
      setConfirming(false);
    }
  }

  return (
    <div>
      <div className="rounded-lg border border-danger/30 bg-danger-soft/50 px-4 py-3 text-sm text-ink-2">
        This project was deleted
        {project.deletedAt ? ` on ${new Date(project.deletedAt).toLocaleDateString()}` : ''}. Its
        API key no longer works and members can no longer see it. Restore it to bring it back, or
        delete it permanently to erase all of its data.
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="-mx-5 -mb-4 mt-5 flex items-center gap-2 rounded-b-xl border-t border-line px-5 py-4">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
            Delete permanently
          </Button>
          <Button disabled={busy} onClick={() => void handleRestore()}>
            {restore.isPending ? 'Restoring…' : 'Restore'}
          </Button>
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Permanently delete "${project.name}"?`}
        description="Keys, translations, members and history will be removed for good."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={destroy.isPending}
              onClick={() => void handleDeletePermanently()}
            >
              {destroy.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">This cannot be undone.</p>
      </Modal>
    </div>
  );
}
