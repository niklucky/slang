import type { SvelteComponent } from "svelte";

export type Field<T> = {
  key: string | number;
  title?: string;
  component?: typeof SvelteComponent;
  data?: T,
  render?: (value: unknown) => string | null
};