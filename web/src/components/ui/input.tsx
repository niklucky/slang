import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

import { cx } from '../../lib/cx.js';

const control = cx(
  'w-full rounded-lg border border-line-strong bg-surface text-sm text-ink transition-colors',
  'placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
  'disabled:pointer-events-none disabled:opacity-50',
);

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
}

export function Input({ size = 'md', className, ...rest }: InputProps) {
  return (
    <input
      className={cx(control, size === 'sm' ? 'h-8 px-2.5' : 'h-9 px-3', className)}
      {...rest}
    />
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md';
}

export function Select({ size = 'md', className, ...rest }: SelectProps) {
  return (
    <select
      className={cx(control, size === 'sm' ? 'h-8 px-2' : 'h-9 px-2.5', className)}
      {...rest}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}
