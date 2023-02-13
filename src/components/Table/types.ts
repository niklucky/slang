
export type Field<T> = {
  key: string | number;
  title?: string;
  component?: ConstructorOfATypedSvelteComponent;
  data?: T
};