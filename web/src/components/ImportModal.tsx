import { useEffect, useState } from "react";

import { trpc } from "../trpc.js";
import { Button } from "./ui/button.js";
import { Field, Input, Select } from "./ui/input.js";
import { Modal } from "./ui/modal.js";

export interface ImportModalProps {
  projectId: number;
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ projectId, open, onClose }: ImportModalProps) {
  const utils = trpc.useUtils();

  const [file, setFile] = useState<File | null>(null);
  const [separator, setSeparator] = useState<"," | ";">(",");
  const [result, setResult] = useState<string | null>(null);
  const importCsv = trpc.words.importCsv.useMutation();

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setSeparator(",");
    setResult(null);
    importCsv.reset();
  }, [open]);

  async function handleImport() {
    if (!file) return;
    const csv = await file.text();
    importCsv.mutate(
      { projectId, csv, separator },
      {
        onSuccess: async ({ keys }) => {
          await utils.words.list.invalidate({ projectId });
          void utils.words.history.invalidate();
          // New locale columns may have been attached to the project.
          await utils.projects.get.invalidate({ projectId });
          setResult(`Imported ${keys} ${keys === 1 ? "key" : "keys"}.`);
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import translations"
      description="CSV with a `key` column followed by one column per locale code (e.g. en, fr). Import only creates or updates keys — nothing is deleted."
      size="md"
    >
      <div className="space-y-4">
        <Field label="CSV file">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
        <Field label="Separator">
          <Select
            value={separator}
            onChange={(event) => setSeparator(event.target.value as "," | ";")}
          >
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
          </Select>
        </Field>
      </div>

      {importCsv.error && (
        <p className="mt-3 text-sm text-danger">{importCsv.error.message}</p>
      )}
      {result && <p className="mt-3 text-sm text-success">{result}</p>}

      <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 rounded-b-xl border-t border-line px-5 py-4">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button
          onClick={() => void handleImport()}
          disabled={importCsv.isPending || !file}
        >
          {importCsv.isPending ? "Importing…" : "Import"}
        </Button>
      </div>
    </Modal>
  );
}
