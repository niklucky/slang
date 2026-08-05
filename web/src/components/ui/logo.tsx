import { cx } from '../../lib/cx.js';

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-xl bg-primary font-bold text-primary-ink',
        size === 'sm' ? 'h-8 w-8 text-base' : 'h-9 w-9 text-lg',
        className,
      )}
    >
      S
    </span>
  );
}
