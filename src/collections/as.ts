import { isIterable } from "./is";
import { emptyIterator } from "./iterables";
import { toArray, toSet } from "./to";

/**
 * @returns The given collection in the form of a {@link ReadonlyArray}.
 * If the collection is already an instance of an {@link Array}, the collection itself is returned;
 * otherwise, the collection is copied into a new {@link Array} and that is returned.
 */
export function asArray<T>(collection: Iterable<T> | undefined): readonly T[] {
    if (Array.isArray(collection)) {
        return collection;
    } else {
        return toArray(collection);
    }
}

/**
 * @returns The given collection in the form of a {@link ReadonlySet}.
 * If the collection is already an instance of a {@link Set}, the collection itself is returned;
 * otherwise, the collection is copied into a new {@link Set} and that is returned.
 */
export function asSet<T>(collection: Iterable<T> | undefined): ReadonlySet<T> {
    if (collection instanceof Set) {
        return collection;
    } else {
        return toSet(collection);
    }
}

/**
 * @returns The given {@link Iterable} or {@link Iterator} in the form of an {@link Iterable}. If the given value is an {@link Iterator}, the returned {@link Iterable} can only be iterated once and all subsequent iterations will be empty.
 */
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

/**
 * @returns The given {@link Iterable} or {@link Iterator} in the form of an {@link Iterator}.
 */
export function asIterator<T>(value: Iterator<T> | Iterable<T>): Iterator<T> {
    if (isIterable(value)) {
        return value[Symbol.iterator]();
    } else {
        return value;
    }
}
