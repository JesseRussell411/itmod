import { Order, autoComparator } from "../sorting";
import Collection from "./Collection";
import LinkedList from "./LinkedList";
import SortedMap from "./SortedMap";

/**
 * A sequence of items, optionally with a max size, that maintains sorted order with insertion order as a fallback for duplicate values.
 */
export default class SortedSequence<T> extends Collection<T> {
    private readonly data: SortedMap<T, LinkedList<T>>;
    public readonly sizeLimit?: Readonly<{
        maxSize: number;
        keep: "greatest" | "least";
    }>;
    private _size: number = 0;

    public get size(): number {
        return this._size;
    }

    private set size(value: number) {
        this._size = value;
    }

    /**
     * @param order How to sort the values. Defaults to {@link autoComparator}.
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
        if (sizeLimit !== undefined) this.sizeLimit = { ...sizeLimit };
        this.data = new SortedMap(order);
    }

    /** Add a value to the sequence. */
    public push(value: T): void {
        if (this.sizeLimit !== undefined && this.sizeLimit.maxSize === 0)
            return;

        const oversize =
            this.sizeLimit !== undefined && this.size >= this.sizeLimit.maxSize;

        const list = this.data.getOrCompute(value, () => new LinkedList<T>());
        list.push(value);

        this.size++;

        if (oversize) {
            if (this.sizeLimit!.keep === "greatest") {
                this.deleteSmallest();
            } else {
                this.deleteLargest();
            }
        }
    }

    /**
     * Deletes the greatest value from the sequence.
     */
    public deleteLargest(): boolean {
        if (this.isEmpty) return false;

        this.data.deleteLargest((entry) => {
            entry.value.pop();
            if (entry.value.isEmpty) {
                return true;
            } else {
                // Replace key with one that is definitely in the linked list so that the current key can be garbage collected.
                // Because, if the current key is not in the linked list, the sorted map might be the only thing holding it.
                this.data.reKey(entry, entry.value.head!.value);
                return false;
            }
        });

        this.size--;
        return true;
    }

    /**
     * Deletes the least value from the sequence.
     */
    public deleteSmallest(): boolean {
        if (this.isEmpty) return false;

        this.data.deleteSmallest((entry) => {
            entry.value.shift();
            if (entry.value.isEmpty) {
                return true;
            } else {
                // Replace key with one that is definitely in the linked list so that the current key can be garbage collected.
                // Because, if the current key is not in the linked list, the sorted map might be the only thing holding it.
                this.data.reKey(entry, entry.value.head!.value);
                return false;
            }
        });

        this.size--;
        return true;
    }

    /** @returns The largest value in the sequence. */
    public getLargest(): T | undefined {
        if (this.isEmpty) return undefined;
        return this.data.getLargestEntry()?.value.tail?.value;
    }

    /** @returns The smallest value in the sequence. */
    public getSmallest(): T | undefined {
        if (this.isEmpty) return undefined;
        return this.data.getSmallestEntry()?.value.head?.value;
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
            yield* entry[1];
        }
    }
}
