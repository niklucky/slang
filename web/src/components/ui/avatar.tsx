import { cx } from '../../lib/cx.js';

const palettes = [
  'bg-accent-soft text-accent',
  'bg-success-soft text-success',
  'bg-info-soft text-info',
  'bg-warning-soft text-warning',
];

const sizes = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function hash(value: string): number {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        palettes[hash(name) % palettes.length] ?? 'bg-fill text-ink-2',
        sizes[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
