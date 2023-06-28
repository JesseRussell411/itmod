export function isIterable<T>(
    value: Iterable<T> | Iterator<T>
): value is Iterable<T>;
export function isIterable<T>(value: unknown): value is Iterable<unknown>;
export function isIterable(value: any): boolean {
    return value?.[Symbol.iterator] instanceof Function;
}

export function isArray<T>(value: Iterable<T>): value is readonly T[];
export function isArray<T>(value: unknown): value is readonly unknown[];
export function isArray(value: any): boolean {
    return Array.isArray(value);
}

export function isSet<T>(value: Iterable<T>): value is ReadonlySet<T>;
export function isSet<T>(value: unknown): value is ReadonlySet<unknown>;
export function isSet(value: any): boolean {
    return value instanceof Set;
}

export function isArrayAsWritable<T>(value: Iterable<T>): value is T[];
export function isArrayAsWritable<T>(value: unknown): value is unknown[];
export function isArrayAsWritable(value: any): boolean {
    return Array.isArray(value);
}

export function isSetAsWritable<T>(value: Iterable<T>): value is Set<T>;
export function isSetAsWritable<T>(value: unknown): value is Set<unknown>;
export function isSetAsWritable(value: any): boolean {
    return value instanceof Set;
}
