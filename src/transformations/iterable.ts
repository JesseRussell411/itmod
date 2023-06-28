import Itmod from "../Itmod";
import SortedSequence from "../collections/SortedList";
import SortedMap from "../collections/SortedMap";
import { Comparator, autoComparator } from "../sorting";

/**
 * Attemps to determine the number of values in the {@link Iterable} without iterating it.
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
        iterable instanceof SortedMap
    ) {
        return iterable.size;
    }

    if (iterable instanceof Itmod) {
        return iterable.nonIteratedCountOrUndefined();
    }
}

export function min<T>(
    values: Iterable<T>,
    count: number | bigint,
    comparator: Comparator<T> = autoComparator
): Iterable<T> {
    if (count === 0 || count === 0n) return [];

    const result = new SortedSequence<T>(comparator, {
        maxSize: Number(count),
        keep: "least",
    });

    result.pushMany(values);

    return result;
}

export function max<T>(
    values: Iterable<T>,
    count: number | bigint,
    comparator: Comparator<T> = autoComparator
): Iterable<T> {
    if (count === 0 || count === 0n) return [];

    const result = new SortedSequence<T>(comparator, {
        maxSize: Number(count),
        keep: "greatest",
    });

    result.pushMany(values);

    return result;
}
