import { Order, asComparator, autoComparator } from "../sorting";
import Collection from "./Collection";
import SortedMap from "./SortedMap";

type Entry<T> = { value: T; index: bigint };

/**
 * A sequence of items, optionally with a max size, that maintains sorted order with insertion order as a fallback for duplicate values.
 */
export default class SortedSequence<T> extends Collection<T> {
    private readonly data: SortedMap<Entry<T>, undefined>;
    public readonly sizeLimit?: Readonly<{
        maxSize: number;
        keep: "greatest" | "least";
    }>;
    private index: bigint = -9_223_372_036_854_775_808n; // smallest signed 64 bit integer

    /**
     * @param order How to compare the values. Defaults to {@link autoComparator}.
     * @param sizeLimit Properties of the optional size limit.
     */
    public constructor(
        order: Order<T> = autoComparator,
        sizeLimit?: {
            /** The maximum number of values to allow in the {@link SortedSequence}. */
            maxSize: number;
            /** Which values to keep when the maximum size is reached. */
            keep: "greatest" | "least";
        }
    ) {
        super();
        const comparator = asComparator(order);
        this.data = new SortedMap<Entry<T>, undefined>((a, b) => {
            const cmp = comparator(a.value, b.value);
            if (cmp !== 0) return cmp;
            return Number(a.index - b.index);
        });
        if (sizeLimit !== undefined) this.sizeLimit = sizeLimit;
    }

    /** How many values are in the sequence. */
    public get size() {
        return this.data.size;
    }

    /** Add a value to the sequence. */
    public push(value: T) {
        this.data.set({ value, index: this.index++ }, undefined);
        if (
            this.sizeLimit !== undefined &&
            this.size > this.sizeLimit.maxSize
        ) {
            if (this.sizeLimit.keep === "greatest") {
                this.data.deleteLeast();
            } else {
                this.data.deleteGreatest();
            }
        }
    }

    /**
     * Deletes the greatest value from the sequence.
     */
    public deleteGreatest() {
        return this.data.deleteGreatest() !== undefined;
    }

    /**
     * Deletes the least value from the sequence.
     */
    public deleteLeast() {
        return this.data.deleteLeast() !== undefined;
    }

    /**
     * Add many values to the sequence.
     */
    public pushMany(values: Iterable<T>) {
        for (const value of values) {
            this.push(value);
        }
    }

    public *[Symbol.iterator]() {
        for (const entry of this.data) {
            yield entry[0].value;
        }
    }
}
