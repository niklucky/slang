import type { ButtonHTMLAttributes, Ref } from 'react';

import { cx } from '../../lib/cx.js';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ label, size = 'md', className, type = 'button', ref, ...rest }: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors',
        'hover:bg-fill hover:text-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        className,
      )}
      {...rest}
    />
  );
}
