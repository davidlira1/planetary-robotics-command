export class InjectionToken<T> {
  constructor(public readonly description: string) {}
}

export function Injectable(): ClassDecorator {
  return (target) => target;
}

export function Inject(): ParameterDecorator {
  return () => undefined;
}

export function signal<T>(initial: T): {
  (): T;
  set(value: T): void;
  asReadonly(): () => T;
} {
  let value = initial;
  const fn = (() => value) as { (): T; set(value: T): void; asReadonly(): () => T };
  fn.set = (next: T) => {
    value = next;
  };
  fn.asReadonly = () => () => value;
  return fn;
}

export function computed<T>(compute: () => T): () => T {
  return () => compute();
}
