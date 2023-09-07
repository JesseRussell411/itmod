import Itmod from "../Itmod";
import CircularBuffer from "../collections/CircularBuffer";
import Collection from "../collections/Collection";
import SortedMap from "../collections/SortedMap";
import SortedSequence from "../collections/SortedSequence";
import { Order, autoComparator } from "../sorting";

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

export function min<T>(
    values: Iterable<T>,
    count: number | bigint,
    order: Order<T> = autoComparator
): Iterable<T> {
    if (count === 0 || count === 0n) return [];

    const result = new SortedSequence<T>(order, {
        maxSize: Number(count),
        keep: "least",
    });

    result.pushMany(values);

    return result;
}

export function max<T>(
    values: Iterable<T>,
    count: number | bigint,
    order: Order<T> = autoComparator
): Iterable<T> {
    if (count === 0 || count === 0n) return [];

    const result = new SortedSequence<T>(order, {
        maxSize: Number(count),
        keep: "greatest",
    });

    result.pushMany(values);

    return result;
}
