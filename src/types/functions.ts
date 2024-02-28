/** Maps the tuple of functions to a tuple of their respective return types. */
export type ReturnTypes<
    Functions extends readonly ((...args: any[]) => any)[]
> = _ReturnTypes<Functions>;

type _ReturnTypes<Functions> = Functions extends readonly [
    (...args: any[]) => infer R,
    ...infer Rest
]
    ? [R, ..._ReturnTypes<Rest>]
    : [];
