import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

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

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  size?: 'sm' | 'md';
}

export function Textarea({ size = 'md', className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cx(control, size === 'sm' ? 'min-h-16 px-2 py-1.5' : 'min-h-20 px-3 py-2', className)}
      {...rest}
    />
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}
