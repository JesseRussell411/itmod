import { Order } from "../sorting";
import Collection from "./Collection";
import LinkedList from "./LinkedList";
import SortedMap from "./SortedMap";

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

    public constructor(
        order: Order<T>,
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

        const entry = this.data.get(value);

        if (entry === undefined) {
            const newEntry = new LinkedList<T>();
            newEntry.push(value);
            this.data.set(value, newEntry);
        } else {
            entry.push(value);
        }
        this.size++;

        if (oversize) {
            if (this.sizeLimit!.keep === "greatest") {
                this.deleteLeast();
            } else {
                this.deleteGreatest();
            }
        }
    }

    /**
     * Deletes the greatest value from the sequence.
     */
    public deleteGreatest(): boolean {
        if (this.isEmpty) return false;

        const entry = this.data.getGreatestEntry()!;
        entry[1].pop();
        if (entry[1].isEmpty) {
            this.data.deleteGreatest();
        }
        this.size--;
        return true;

        // The key doesn't need to be replaced in this case because
    }

    /**
     * Deletes the least value from the sequence.
     */
    public deleteLeast(): boolean {
        if (this.isEmpty) return false;

        const entry = this.data.getLeastEntry()!;
        entry[1].shift();
        if (entry[1].isEmpty) {
            this.data.deleteLeast();
        } else {
            // Replace key with one that is definitely in the linked list so that the current key can be garbage collected.
            // Because, if the current key is not in the linked list, the sorted map might be the only thing holding it.

            // TODO add some way to quickly change the entry's key without doing this
            // this is 0(log(n)) time but it could be 0(1)
            this.data.set(entry[1].head!.value, entry[1]);
        }
        this.size--;
        return true;
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

// type Entry<T> = { value: T; index: bigint };

// /**
//  * A sequence of items, optionally with a max size, that maintains sorted order with insertion order as a fallback for duplicate values.
//  */
// export default class SortedSequence<T> extends Collection<T> {
//     private readonly data: SortedMap<Entry<T>, undefined>;
//     public readonly sizeLimit?: Readonly<{
//         maxSize: number;
//         keep: "greatest" | "least";
//     }>;
//     private index: bigint = -9_223_372_036_854_775_808n; // smallest signed 64 bit integer

//     /**
//      * @param order How to compare the values. Defaults to {@link autoComparator}.
//      * @param sizeLimit Properties of the optional size limit.
//      */
//     public constructor(
//         order: Order<T> = autoComparator,
//         sizeLimit?: {
//             /** The maximum number of values to allow in the {@link SortedSequence}. */
//             maxSize: number;
//             /** Which values to keep when the maximum size is reached. */
//             keep: "greatest" | "least";
//         }
//     ) {
//         super();
//         const comparator = asComparator(order);
//         this.data = new SortedMap<Entry<T>, undefined>((a, b) => {
//             const cmp = comparator(a.value, b.value);
//             if (cmp !== 0) return cmp;
//             return Number(a.index - b.index);
//         });
//         if (sizeLimit !== undefined) this.sizeLimit = sizeLimit;
//     }

//     /** How many values are in the sequence. */
//     public get size() {
//         return this.data.size;
//     }

//     /** Add a value to the sequence. */
//     public push(value: T) {
//         this.data.set({ value, index: this.index++ }, undefined);
//         if (
//             this.sizeLimit !== undefined &&
//             this.size > this.sizeLimit.maxSize
//         ) {
//             if (this.sizeLimit.keep === "greatest") {
//                 this.data.deleteLeast();
//             } else {
//                 this.data.deleteGreatest();
//             }
//         }
//     }

//     /**
//      * Deletes the greatest value from the sequence.
//      */
//     public deleteGreatest() {
//         return this.data.deleteGreatest() !== undefined;
//     }

//     /**
//      * Deletes the least value from the sequence.
//      */
//     public deleteLeast() {
//         return this.data.deleteLeast() !== undefined;
//     }

//     /**
//      * Add many values to the sequence.
//      */
//     public pushMany(values: Iterable<T>) {
//         for (const value of values) {
//             this.push(value);
//         }
//     }

//     public *[Symbol.iterator]() {
//         for (const entry of this.data) {
//             yield entry[0].value;
//         }
//     }
// }
