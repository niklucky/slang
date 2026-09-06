import { X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';

import { cx } from '../../lib/cx.js';
import { Badge } from './badge.js';

export interface TagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Tags the project already has, offered as completions. */
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}

/** Mirrors the server's normalization so a chip looks like what gets saved. */
function normalize(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Chip editor for a key's tags: type a name and press Enter or comma to add
 * it, Backspace on an empty field removes the last one. Existing project
 * tags come up as browser completions via a datalist.
 */
export function TagsInput({ value, onChange, suggestions = [], placeholder, className }: TagsInputProps) {
  const [draft, setDraft] = useState('');
  const listId = useId();

  function add(raw: string) {
    const name = normalize(raw);
    if (!name || value.includes(name)) {
      setDraft('');
      return;
    }
    onChange([...value, name]);
    setDraft('');
  }

  function remove(name: string) {
    onChange(value.filter((entry) => entry !== name));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter must add the chip, not submit the surrounding form.
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      event.preventDefault();
      remove(value[value.length - 1]!);
    }
  }

  const unused = suggestions.filter((name) => !value.includes(name));

  return (
    <div
      className={cx(
        'flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm focus-within:border-accent',
        className,
      )}
    >
      {value.map((name) => (
        <Badge key={name} tone="accent" className="gap-1 pr-1">
          {name}
          <button
            type="button"
            aria-label={`Remove tag ${name}`}
            onClick={() => remove(name)}
            className="rounded p-0.5 transition-colors hover:bg-accent/20"
          >
            <X size={12} />
          </button>
        </Badge>
      ))}
      <input
        list={listId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft && add(draft)}
        placeholder={value.length === 0 ? (placeholder ?? 'Add a tag…') : ''}
        className="min-w-24 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
      />
      <datalist id={listId}>
        {unused.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
