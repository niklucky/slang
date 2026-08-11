import { cx } from '../../lib/cx.js';

export function Logo({ size = 'md', className }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Slang"
      className={cx(
        'inline-block shrink-0 select-none rounded-xl',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        className,
      )}
    />
  );
}
