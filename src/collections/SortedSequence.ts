import { Order, asComparator, autoComparator } from "../sorting";
import Collection from "./Collection";
import LinkedList from "./LinkedList";
import SortedMap from "./SortedMap";

/**
 * A sequence of items, optionally with a max size, that maintains sorted order with insertion order as a fallback for duplicate values.
 */
export default class SortedSequence<T> extends Collection<T> {
    private readonly data: SortedMap<LinkedList<T>, undefined>;
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

    public final() {
        return this.data.getLargestEntry()?.key.final();
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
        const comparator = asComparator(order);
        this.data = new SortedMap((a, b) => comparator(a.first()!, b.first()!));
    }

    /** Add a value to the sequence. */
    public push(value: T): void {
        if (this.sizeLimit !== undefined && this.sizeLimit.maxSize === 0)
            return;

        const oversize =
            this.sizeLimit !== undefined && this.size >= this.sizeLimit.maxSize;

        const key = LinkedList.of(value);
        const list = this.data.getEntryOrCompute(key, () => undefined).key;
        if (list !== key) {
            list.push(value);
        }

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
            entry.key.pop();
            return entry.key.isEmpty;
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
            entry.key.shift();
            return entry.key.isEmpty;
        });

        this.size--;
        return true;
    }

    /** @returns The largest value in the sequence. */
    public getLargest(): T | undefined {
        if (this.isEmpty) return undefined;
        return this.data.getLargestEntry()?.key.tail?.value;
    }

    /** @returns The smallest value in the sequence. */
    public getSmallest(): T | undefined {
        if (this.isEmpty) return undefined;
        return this.data.getSmallestEntry()?.key.head?.value;
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
            yield* entry.key;
        }
    }

    public reversed(): Iterable<T> {
        const self = this;
        return {
            *[Symbol.iterator]() {
                for (const [list] of self.data.reversed()) {
                    yield* list.reversed();
                }
            },
        };
    }
}
