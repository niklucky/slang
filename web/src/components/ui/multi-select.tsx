import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cx } from '../../lib/cx.js';

export interface MultiSelectOption {
  value: string;
  label: ReactNode;
  /** Extra text shown next to the label in the dropdown only (e.g. when the label is an icon). */
  hint?: ReactNode;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Label shown on the button when every option is selected. */
  allLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  allLabel = 'All',
  size = 'md',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectedSet = new Set(selected);
  const allSelected = options.length > 0 && selected.length === options.length;
  const selectedLabels = options.filter((option) => selectedSet.has(option.value));

  function toggle(value: string) {
    onChange(
      selectedSet.has(value) ? selected.filter((entry) => entry !== value) : [...selected, value],
    );
  }

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cx(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface text-sm text-ink transition-colors',
          'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
          size === 'sm' ? 'h-8 px-2.5' : 'h-9 px-3',
        )}
      >
        <span className="truncate">
          {allSelected
            ? allLabel
            : selectedLabels.length > 0
              ? selectedLabels.map((option, index) => (
                  <span key={option.value}>
                    {index > 0 && ', '}
                    {option.label}
                  </span>
                ))
              : 'None'}
        </span>
        <ChevronDown size={14} className="shrink-0 text-ink-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-full rounded-lg border border-line bg-surface p-1 shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-fill"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.value)}
                  onChange={() => toggle(option.value)}
                  className="size-3.5 accent-accent"
                />
                <span className="truncate">{option.label}</span>
                {option.hint != null && (
                  <span className="truncate text-xs text-ink-3">{option.hint}</span>
                )}
              </label>
            ))}
            {options.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-ink-3">No options.</p>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 border-t border-line pt-1">
            <button
              type="button"
              onClick={() => onChange(options.map((option) => option.value))}
              className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-fill hover:text-ink"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-fill hover:text-ink"
            >
              None
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
