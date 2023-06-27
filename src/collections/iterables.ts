import { asiterator } from "./as";
import { isIterable } from "./is";

/** A clone of python's range function */
export function range(
    start: bigint,
    end: bigint,
    step: bigint
): Iterable<bigint>;
/** A clone of python's range function */
export function range(start: bigint, end: bigint): Iterable<bigint>;
/** A clone of python's range function */
export function range(end: bigint): Iterable<bigint>;
/** A clone of python's range function */
export function range(
    start: number | bigint,
    end: number | bigint,
    step: number | bigint
): Iterable<number>;
/** A clone of python's range function */
export function range(
    start: number | bigint,
    end: number | bigint
): Iterable<number>;
/** A clone of python's range function */
export function range(end: number | bigint): Iterable<number>;

/** A clone of python's range function */
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

export function emptyIterator<T>(): Iterator<T> {
    return {
        next() {
            return {
                done: true,
                value: undefined,
            };
        },
    };
}

export function cachingIterable<T>(iterable: Iterable<T> | Iterator<T>) {
    const cache: T[] = [];
    const iterator = asiterator(iterable);

    return {
        *[Symbol.iterator]() {
            let i = 0;
            while (true) {
                if (i < cache.length) {
                    yield cache[i];
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
