import { useEffect, useState, type FormEvent } from "react";

import { trpc } from "../trpc.js";
import type { CatalogLocale } from "./ProjectFormModal.js";
import { Button } from "./ui/button.js";
import { Field, Input, Textarea } from "./ui/input.js";
import { LocaleFlag } from "./ui/locale-flag.js";
import { Modal } from "./ui/modal.js";

export interface AddKeyModalProps {
  projectId: number;
  locales: CatalogLocale[];
  channelId: number | undefined;
  open: boolean;
  onClose: () => void;
}

export function AddKeyModal({
  projectId,
  locales,
  channelId,
  open,
  onClose,
}: AddKeyModalProps) {
  const utils = trpc.useUtils();

  const [key, setKey] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const upsert = trpc.words.upsert.useMutation();

  useEffect(() => {
    if (!open) return;
    setKey("");
    setValues({});
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    upsert.mutate(
      {
        projectId,
        key,
        translations: locales.map((locale) => ({
          localeId: locale.id,
          channelId: channelId ?? null,
          value: values[locale.code] ?? "",
        })),
      },
      {
        onSuccess: () => {
          void utils.words.list.invalidate({ projectId });
          void utils.words.history.invalidate();
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add key"
      description="Creates the key with an (empty) translation for every locale."
      size="2xl"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Field label="Key">
            <Input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="key.name"
              required
              autoFocus
            />
          </Field>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {locales.map((locale) => (
              <Field
                key={locale.id}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <LocaleFlag
                      code={locale.code}
                      name={locale.name}
                      countryCode={locale.countryCode}
                    />
                    {locale.name}
                  </span>
                }
              >
                <Textarea
                  value={values[locale.code] ?? ""}
                  onChange={(event) =>
                    setValues((previous) => ({
                      ...previous,
                      [locale.code]: event.target.value,
                    }))
                  }
                  placeholder={locale.code}
                />
              </Field>
            ))}
          </div>
          {locales.length === 0 && (
            <p className="text-sm text-ink-3">
              Add a locale in Settings before adding keys.
            </p>
          )}
        </div>

        {upsert.error && (
          <p className="mt-3 text-sm text-danger">{upsert.error.message}</p>
        )}

        <div className="-mx-5 -mb-4 mt-5 flex justify-end gap-2 rounded-b-xl border-t border-line px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={upsert.isPending || locales.length === 0}
          >
            {upsert.isPending ? "Adding…" : "Add key"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
