/**
 *
 * @param object
 * @returns The object's own string and symbol keys.
 */
export function getOwnPropertyKeys<K extends keyof any>(
    object: Record<K, any>
): (K & (string | symbol))[] {
    return [
        ...Object.getOwnPropertyNames(object),
        ...Object.getOwnPropertySymbols(object),
    ] as any;
}

/**
 * @returns The object's own entries.
 */
export function getOwnEntries<K extends keyof any, V>(
    object: Record<K, any>
): [K & (string | symbol), V][] {
    return [
        ...Object.getOwnPropertyNames(object).map((n) => [
            n,
            (object as any)[n],
        ]),
        ...Object.getOwnPropertySymbols(object).map((s) => [
            s,
            (object as any)[s],
        ]),
    ] as any;
}

/**
 * Runtime equivalent to {@link Pick}.
 * @param fields The fields to include.
 * @return A shallow copy of the object with only the fields specified.
 */
export function pick<T, K extends keyof T>(
    object: T,
    fields: Iterable<K>
): Pick<T, K> {
    const result: any = {};
    const ownKeys = new Set(Reflect.ownKeys(object ?? {}));

    function sanitizeField(field: any): string | symbol {
        if (typeof field !== "string" && typeof field !== "symbol") {
            return `${field}`;
        } else {
            return field;
        }
    }

    for (const field of fields) {
        if (ownKeys.has(sanitizeField(field))) {
            result[field] = object[field];
        }
    }

    return result;
}
