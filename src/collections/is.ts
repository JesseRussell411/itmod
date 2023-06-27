export function isIterable<T>(
    value: Iterable<T> | Iterator<T>
): value is Iterable<T>;
export function isIterable<T>(value: unknown): value is Iterable<unknown>;
export function isIterable<T>(value: any): boolean {
    return value?.[Symbol.iterator] instanceof Function;
}

export function isArray<T>(value: Iterable<T>): value is readonly T[];
export function isArray<T>(value: unknown): value is readonly unknown[];
export function isArray<T>(value: any): boolean {
    return Array.isArray(value);
}

export function isSet<T>(value: Iterable<T>): value is ReadonlySet<T>;
export function isSet<T>(value: unknown): value is ReadonlySet<unknown>;
export function isSet(value: any): boolean {
    return value instanceof Set;
}
