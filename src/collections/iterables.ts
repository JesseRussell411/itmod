import Itmod from "../Itmod";
import Collection from "./Collection";
import { asIterator } from "./as";

/**
 * @returns An iterable with no items.
 */
export function emptyIterable<T = never>(): Iterable<T> {
    return _emptyIterable;
}

const _emptyIterable: Iterable<any> = {
    get [Symbol.iterator]() {
        return emptyIterator;
    },
};

/**
 * @returns An iterator with no items.
 */
export function emptyIterator<T = never>(): Iterator<T> {
    return _emptyIterator;
}

const _emptyIterator: Iterator<any> = {
    // this is so that no one can replace the next method
    get next() {
        return doneIteratorResultResult;
    },
};

/**
 * @returns The result of a complete iterator.
 */
export function doneIteratorResultResult<T>(): IteratorResult<T> & {
    done: true;
} {
    return _doneIteratorResult;
}

const _doneIteratorResult = {
    get done(): true {
        return true;
    },
    get value(): undefined {
        return undefined;
    },
};

/**
 * Caches the given {@link Iterable} so that multiple iterations of the returned {@link Iterable} only iterate the original once.
 */
export function cachingIterable<T>(
    iterable: Iterable<T> | Iterator<T>
): Iterable<T> {
    const cache: T[] = [];
    const iterator = asIterator(iterable);

    return {
        *[Symbol.iterator]() {
            let i = 0;
            while (true) {
                if (i < cache.length) {
                    yield cache[i] as T;
                } else {
                    const next = iterator.next();
                    if (next.done) return;
                    const value = next.value;
                    cache.push(value);
                    yield value;
                }
                i++;
            }
        },
    };
}

/**
 * Attempts to determine the number of values in the {@link Iterable} without iterating it.
 * @param iterable
 * @returns The size of the {@link Iterable} or undefined if the size couldn't be determined without iterating it.
 */
export function nonIteratedCountOrUndefined(
    iterable: Iterable<any>
): number | undefined {
    if (Array.isArray(iterable)) return iterable.length;

    if (
        iterable instanceof Set ||
        iterable instanceof Map ||
        iterable instanceof Collection
    ) {
        return iterable.size;
    }

    if (iterable instanceof Itmod) {
        return iterable.nonIteratedCountOrUndefined();
    }

    return undefined;
}

export function wrapIterator<T>(iterator: Iterator<T>): Iterable<T> {
    return {
        [Symbol.iterator]() {
            const result = iterator;
            iterator = emptyIterator();
            return result;
        },
    };
}
