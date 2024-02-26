/**
 * Runtime equivalent to {@link Pick}.
 * @param fields The fields to include.
 * @return A shallow copy of the object with only the fields specified.
 */
export function pick<T, K extends keyof T>(
    object: T,
    fields: Iterable<K>
): Pick<T, K> {
    const fieldSet = new Set<string | symbol>();
    for (const field of fields) {
        fieldSet.add(sanitizeField(field));
    }

    const result: any = {};

    for (const field in object) {
        if (fieldSet.has(field)) {
            result[field] = object[field];
        }
    }

    return result;
}

/**
 * Runtime equivalent to {@link Omit}.
 * @param fields The fields to include.
 * @return A shallow copy of the object with only the fields not specified.
 */
export function omit<T, K extends keyof T>(
    object: T,
    fields: Iterable<K>
): Omit<T, K> {
    const fieldSet = new Set<string | symbol>();
    for (const field of fields) {
        fieldSet.add(sanitizeField(field));
    }

    const result: any = {};
    for (const field in object) {
        if (!fieldSet.has(field)) {
            result[field] = object[field];
        }
    }

    return result;
}

/** used by {@link pick} and {@link omit}. */
function sanitizeField(field: any): string | symbol {
    if (typeof field !== "string" && typeof field !== "symbol") {
        return `${field}`;
    } else {
        return field;
    }
}
