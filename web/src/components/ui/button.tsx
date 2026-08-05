import type { ButtonHTMLAttributes } from 'react';

import { cx } from '../../lib/cx.js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary-hover',
  secondary: 'bg-fill text-ink hover:bg-selected',
  ghost: 'text-ink-2 hover:bg-fill hover:text-ink',
  danger: 'bg-danger text-primary-ink hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 rounded-md px-2.5 text-xs',
  md: 'h-9 rounded-lg px-3.5 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
