export type IterableType<I extends Iterable<any>> = I extends Iterable<infer T>
    ? T
    : never;
