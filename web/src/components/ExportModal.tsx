import { useEffect, useState } from "react";

import { trpc } from "../trpc.js";
import type { CatalogLocale } from "./ProjectFormModal.js";
import { Button } from "./ui/button.js";
import { Field, Select } from "./ui/input.js";
import { LocaleFlag } from "./ui/locale-flag.js";
import { Modal } from "./ui/modal.js";

export interface ExportModalProps {
  projectId: number;
  projectName: string;
  locales: CatalogLocale[];
  open: boolean;
  onClose: () => void;
}

export function ExportModal({
  projectId,
  projectName,
  locales,
  open,
  onClose,
}: ExportModalProps) {
  const utils = trpc.useUtils();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [missingOnly, setMissingOnly] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(locales.map((locale) => locale.id));
    setMissingOnly(false);
    setPending(false);
    setError(null);
  }, [open, locales]);

  function toggle(localeId: number) {
    setSelectedIds((previous) =>
      previous.includes(localeId)
        ? previous.filter((id) => id !== localeId)
        : [...previous, localeId],
    );
  }

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      const { csv } = await utils.words.exportCsv.fetch({
        projectId,
        localeIds: selectedIds,
        missingOnly,
      });
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectName}-translations.csv`;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export translations"
      description="Downloads a CSV with one row per key and one column per selected locale."
      size="md"
    >
      <div className="space-y-4">
        <Field label="Locales">
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
            {locales.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border-b border-line px-2 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-fill">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={selectedIds.length === locales.length}
                  onChange={() =>
                    setSelectedIds(
                      selectedIds.length === locales.length
                        ? []
                        : locales.map((locale) => locale.id),
                    )
                  }
                />
                Select all
              </label>
            )}
            {locales.map((locale) => (
              <label
                key={locale.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink transition-colors hover:bg-fill"
              >
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={selectedIds.includes(locale.id)}
                  onChange={() => toggle(locale.id)}
                />
                <LocaleFlag
                  code={locale.code}
                  name={locale.name}
                  countryCode={locale.countryCode}
                />
                {locale.name}
              </label>
            ))}
            {locales.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-ink-3">
                No locales yet. Add one in Settings first.
              </p>
            )}
          </div>
        </Field>
        <Field label="Content">
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="export-content"
                className="accent-accent"
                checked={!missingOnly}
                onChange={() => setMissingOnly(false)}
              />
              All keys
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="export-content"
                className="accent-accent"
                checked={missingOnly}
                onChange={() => setMissingOnly(true)}
              />
              Only missing translations
            </label>
          </div>
        </Field>
        <Field label="Format">
          <Select value="csv" disabled>
            <option value="csv">CSV</option>
          </Select>
        </Field>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 rounded-b-xl border-t border-line px-5 py-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleExport()}
          disabled={pending || selectedIds.length === 0}
        >
          {pending ? "Exporting…" : "Export"}
        </Button>
      </div>
    </Modal>
  );
}
