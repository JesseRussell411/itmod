import { isArray, isIterable, isSet } from "./is";
import { emptyIterator } from "./iterables";

export function asArray<T>(collection: Iterable<T> | undefined): readonly T[] {
    if (Array.isArray(collection)) {
        return collection;
    } else {
        return [...(collection ?? [])];
    }
}

export function asSet<T>(collection: Iterable<T> | undefined): ReadonlySet<T> {
    if (collection instanceof Set) {
        return collection;
    } else {
        return new Set(collection);
    }
}

export function asIterable<T>(value: Iterator<T> | Iterable<T>): Iterable<T> {
    if (isIterable(value)) {
        return value;
    } else {
        let iterator = value;
        return {
            [Symbol.iterator]() {
                const result = iterator;
                iterator = emptyIterator();
                return result;
            },
        };
    }
}

export function asiterator<T>(value: Iterator<T> | Iterable<T>): Iterator<T> {
    if (isIterable(value)) {
        return value[Symbol.iterator]();
    } else {
        return value;
    }
}
