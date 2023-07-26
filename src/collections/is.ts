/** Whether the given value is an {@link Iterable}. */
export function isIterable<T>(
    value: Iterable<T> | Iterator<T>
): value is Iterable<T>;
/** Whether the given value is an {@link Iterable}. */
export function isIterable<T>(value: unknown): value is Iterable<unknown>;
export function isIterable(value: any): boolean {
    return value?.[Symbol.iterator] instanceof Function;
}

/** Whether the given value is an {@link Array}. */
export function isArray<T>(value: Iterable<T>): value is readonly T[];
/** Whether the given value is an {@link Array}. */
export function isArray<T>(value: unknown): value is readonly unknown[];
export function isArray(value: any): boolean {
    return Array.isArray(value);
}

/** Whether the given value is a {@link Set}. */
export function isSet<T>(value: Iterable<T>): value is ReadonlySet<T>;
/** Whether the given value is a {@link Set}. */
export function isSet<T>(value: unknown): value is ReadonlySet<unknown>;
export function isSet(value: any): boolean {
    return value instanceof Set;
}

/** Whether the given value is an {@link Array}. The resulting type identity of the value will be a writable {@link Array} instead of a {@link ReadonlyArray} like with {@link isArray}. */
export function isArrayAsWritable<T>(value: Iterable<T>): value is T[];
/** Whether the given value is an {@link Array}. The resulting type identity of the value will be a writable {@link Array} instead of a {@link ReadonlyArray} like with {@link isArray}. */
export function isArrayAsWritable<T>(value: unknown): value is unknown[];
export function isArrayAsWritable(value: any): boolean {
    return Array.isArray(value);
}

/** Whether the given value is a {@link Set}. The resulting type identity of the value will be a writable {@link Set} instead of a {@link ReadonlySet} like with {@link isArray}. */
export function isSetAsWritable<T>(value: Iterable<T>): value is Set<T>;
/** Whether the given value is a {@link Set}. The resulting type identity of the value will be a writable {@link Set} instead of a {@link ReadonlySet} like with {@link isArray}. */
export function isSetAsWritable<T>(value: unknown): value is Set<unknown>;
export function isSetAsWritable(value: any): boolean {
    return value instanceof Set;
}
