export type IterableType<I extends AwaitableIterable<any>> =
    I extends AwaitableIterable<infer T> ? T : never;

export type AwaitableIterable<T> = Iterable<T> | AsyncIterable<T>;
