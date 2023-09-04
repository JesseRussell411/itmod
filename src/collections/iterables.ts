import { asIterator } from "./as";

/**
 * @returns An {@link Iterable} over a range of integers from start to end, incremented by step.
 * @param start The first number in the sequence.
 * @param end Where the range ends (exclusive).
 * @param step How much larger each number in the sequence is from the previous number.
 */
export function range(
    start: bigint,
    end: bigint,
    step: bigint
): Iterable<bigint>;

/**
 * @returns An {@link Iterable} over a range of integers from start to end, incremented by 1 or -1 if end is less than start.
 * @param start The first number in the sequence.
 * @param end Where the range ends (exclusive).
 */
export function range(start: bigint, end: bigint): Iterable<bigint>;

/**
 * @returns An {@link Iterable} over a range of integers from 0 to end, incremented by 1.
 * @param end Where the range ends (exclusive).
 */
export function range(end: bigint): Iterable<bigint>;

/**
 * @returns An {@link Iterable} over a range of numbers from start to end, incremented by step.
 * @param start The first number in the sequence.
 * @param end Where the range ends (exclusive).
 * @param step How much larger each number in the sequence is from the previous number.
 */
export function range(
    start: number | bigint,
    end: number | bigint,
    step: number | bigint
): Iterable<number>;

/**
 * @returns An {@link Iterable} over a range of numbers from start to end, incremented by 1 or -1 if end isless than start.
 * @param start The first number in the sequence.
 * @param end Where the range ends (exclusive).
 */
export function range(
    start: number | bigint,
    end: number | bigint
): Iterable<number>;

/**
 * @returns An {@link Iterable} over a range of numbers from 0 to end, incremented by 1.
 * @param end Where the range ends (exclusive).
 */
export function range(end: number | bigint): Iterable<number>;

export function range(
    _startOrEnd: number | bigint,
    _end?: number | bigint,
    _step?: number | bigint
): any {
    const useNumber =
        typeof _startOrEnd === "number" ||
        typeof _end === "number" ||
        typeof _step === "number";

    const ZERO = useNumber ? 0 : (0n as any);
    const ONE = useNumber ? 1 : (1n as any);

    let start: any;
    let end: any;
    let step: any;
    if (_step !== undefined) {
        start = _startOrEnd;
        end = _end;
        step = _step;
    } else if (_end !== undefined) {
        start = _startOrEnd;
        end = _end;
        step = ONE;
    } else {
        start = ZERO;
        end = _startOrEnd;
        step = ONE;
    }

    if (useNumber) {
        start = Number(start);
        end = Number(end);
        step = Number(step);
    }

    if (step === ZERO) throw new Error("arg3 must not be zero");

    if (step < ZERO && start < end) return [];
    if (step > ZERO && start > end) return [];

    const test = step > ZERO ? (i: any) => i < end : (i: any) => i > end;

    return {
        *[Symbol.iterator]() {
            for (let i = start; test(i); i += step) yield i;
        },
    };
}

/**
 * @returns An iterable with no items.
 */
export function emptyIterable<T>(): Iterable<T> {
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
export function emptyIterator<T>(): Iterator<T> {
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
                    cache.push(next.value);
                    yield next.value;
                }
                i++;
            }
        },
    };
}
