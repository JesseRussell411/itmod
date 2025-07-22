import { requireNonNegative, requireSafeInteger } from "../checks";
import Collection from "./Collection";
import { isArray } from "./is";
import { toArray } from "./to";

/**
 * Buffer of limited size that can shift, unshift, push, and pop elements equally efficiently. Elements can be added until the maximum size is reached; whereupon, elements on the opposite side of the buffer are removed to make room.
 */
export default class CircularBuffer<T> extends Collection<T> {
    /** Where to store the buffer's contents. */
    private data: (T | undefined)[];
    /** Location of index 0 in data. */
    private offset: number;
    /** How many items are stored in the buffer. */
    private _size: number;

    public resize(maxSize: number) {
        requireNonNegative(requireSafeInteger(maxSize));

        const newData = this.toArray(maxSize);

        this.data = newData;
        this.offset = 0;
        this.size = Math.min(this.size, maxSize);
    }

    /** How many items are stored in the buffer. */
    public get size() {
        return this._size;
    }
    /** How many items are stored in the buffer. */
    private set size(value: number) {
        this._size = value;
    }

    /** The maximum number of elements that can be stored in the buffer before elements are overwritten. */
    public get maxSize() {
        return this.data.length;
    }

    /**
     * Creates a new {@link CircularBuffer} with the given max size
     *
     * @param maxSize The maximum number of items that can be stored in the buffer before items are deleted to make room.
     */
    public constructor(maxSize: number);
    public constructor(
        maxSize: number,
        data?: (T | undefined)[],
        offset?: number,
        size?: number
    ) {
        requireSafeInteger(requireNonNegative(maxSize));
        super();
        this.data = data ?? new Array(maxSize);
        this.offset = offset ?? 0;
        this._size = size ?? 0;
    }

    /** Method of creating a buffer with the fields set manually. */
    private static privateConstructor<T>(
        maxSize: number,
        data?: (T | undefined)[],
        offset?: number,
        size?: number
    ): CircularBuffer<T> {
        return new (CircularBuffer as {
            new (
                maxSize: number,
                data?: (T | undefined)[],
                offset?: number,
                size?: number
            ): CircularBuffer<T>;
        })(maxSize, data, offset, size);
    }

    /** Whether the {@link maxSize} has been reached. */
    public get isFull(): boolean {
        return this.size === this.maxSize;
    }

    /** Whether the {@link maxSize} has not been reached. */
    public get notFull(): boolean {
        return !this.isFull;
    }

    public *[Symbol.iterator](): Iterator<T> {
        // TODO see if hand-written iteration is faster than a generator function
        // I hope it isn't
        if (this.isSplit()) {
            // data: [567-----01234]
            //               |-----| <-- iterate this section first
            for (let i = this.firstIndex; i < this.maxSize; i++) {
                yield this.data[i] as T;
            }

            // data: [567-----01234]
            //       |---| <--------- iterate this section second
            const endLength = this.endLength;
            for (let i = 0; i < endLength; i++) {
                yield this.data[i] as T;
            }
        } else {
            // data [---1234567---]
            //         |-------| <----- iterate this section
            const end = this.offset + this.size;
            for (let i = this.offset; i < end; i++) {
                yield this.data[i] as T;
            }
        }
    }

    /**
     * @returns An {@link Iterable} over the buffer's elements in reverse order.
     */
    public reversed(): Iterable<T> {
        const self = this;
        return {
            *[Symbol.iterator]() {
                if (self.isSplit()) {
                    // data: [567-----01234]
                    //       |---| <--------- iterate this section first (backwards)
                    const endLength = self.endLength;
                    for (let i = endLength - 1; i >= 0; i--) {
                        yield self.data[i] as T;
                    }

                    // data: [567-----01234]
                    //               |-----| <-- iterate this section second (backwards)
                    for (let i = self.maxSize - 1; i >= self.offset; i--) {
                        yield self.data[i] as T;
                    }
                } else {
                    // data [---1234567---]
                    //         |-------| <----- iterate this section (backwards)
                    for (
                        let i = self.offset + self.size - 1;
                        i >= self.offset;
                        i--
                    ) {
                        yield self.data[i] as T;
                    }
                }
            },
        };
    }

    public final() {
        return this.at(-1);
    }

    /** In-place reverses the buffer's elements. */
    public reverse() {
        let end = Math.trunc(this.size / 2);

        for (let i = 0; i < end; i++) {
            /** index of item to swap with */
            const swapItemIndex = this.size - 1 - i;

            const temp = this.at(i) as T;
            this.set(i, this.at(swapItemIndex) as T);
            this.set(swapItemIndex, temp);
        }
    }

    /**
     * Copies the contents of the buffer into an {@link Array}.
     * @param length Length of the new Array (defaults to the buffer's size). Values that don't fit into the new array are truncated from the end of the buffer.
     * @returns The {@link Array}.
     */
    public toArray(length: number = this.size): T[] {
        requireSafeInteger(requireNonNegative(length));

        if (this.isSplit()) {
            // The elements are split across the end of the data array

            // data: [567----01234]
            //       |---|  |-----| <-- beginning section
            //         ^
            //          \__end section


            const result = new Array(length);

            /** The number of items to take from the beginning section. */
            const maxBeginningLength = Math.min(this.beginningLength, length);

            /** The number of items to take from the end section. */
            const maxEndLength = Math.min(
                this.endLength,
                length - maxBeginningLength
            );

            // beginning is at the end of the array
            // 01234]
            arrayCopy(
                this.data,
                result,
                this.firstIndex,
                0,
                maxBeginningLength
            );
            // [567
            arrayCopy(this.data, result, 0, maxBeginningLength, maxEndLength);

            return result;

            // can't use splice because it requires a rest parameter instead of an array.
            // in testing, this function IS faster if re-written to use splice but the issue
            // is that to use splice, the entire array being spliced in must be copied onto the
            // call stack as though each item was a local variable, even if the array is 500,000 items long
            // this leads to overflowing the call stack when splicing large arrays. If splice took an array
            // instead of using a rest parameter, it would be the superior solution.
        } else {
            // Much simpler scenario. Elements are somewhere within the data array, not split in the middle.
            // data: [---01234567---]

            // arrayCopy(this.data, result, this.offset, 0, length);
            const result = this.data.slice(
                this.offset,
                this.offset + Math.min(this.size, length)
            ) as T[];
            result.length = length;
            return result;
        }
    }

    public toArrayReversed(): T[] {
        const result = this.toArray();
        result.reverse();
        return result;
    }

    /**
     * copies the contents of the circular buffer into a new circular buffer.
     * @param maxSize The maximum size of the new Circular buffer.
     */
    public clone(maxSize?: number): CircularBuffer<T> {
        if (maxSize === undefined || maxSize === this.maxSize) {
            return CircularBuffer.privateConstructor(
                this.maxSize,
                [...this.data],
                this.offset,
                this.size
            );
        } else {
            const data: (T | undefined)[] = this.toArray(maxSize);

            return CircularBuffer.privateConstructor(
                maxSize,
                data,
                0,
                Math.min(maxSize, this.size)
            );
        }
    }

    /**
     * Deletes all elements from the buffer.
     */
    public clear() {
        this.size = 0;
        this.offset = 0;

        const maxSize = this.data.length;
        this.data.length = 0;
        this.data.length = maxSize;

        // why actually clear data?
        // so that old references aren't left over
        // if an object is pointed to by data only, that object won't be garbage collected even though it isn't actually needed.
    }

    /**
     * Appends the item to the end of the buffer (which would be removed by {@link pop}).
     * Removes an item from the start if the buffer is full.
     */
    public push(item: T): void {
        if (this.maxSize === 0) return;
        this.incrementFinalIndex();
        this.data[this.finalIndex] = item;
    }

    /**
     * Appends the elements from the Iterable to the end of the buffer (white would be removed by {@link pop}).
     * Removing elements from the start if the buffer is full.
     */
    public pushMany(items: Iterable<T>): void {
        if (isArray(items)) {
            if (items.length >= this.maxSize) {
                const srcStart = items.length - this.maxSize

                const dstStart = boundAdd(this.maxSize, this.finalIndex + 1, items.length)

                const startSrcLength = this.maxSize - dstStart
                
                arrayCopy(items, this.data, srcStart, dstStart, startSrcLength)
                arrayCopy(items, this.data, srcStart + startSrcLength, 0, this.maxSize - startSrcLength)
                this.size = this.maxSize;
                this.offset = dstStart;
            } else {
                const remainingSpace = this.maxSize - 1 - this.finalIndex;
                const remainingSize = this.maxSize - this.size

                if (items.length <= remainingSpace) {
                    arrayCopy(items, this.data, 0, this.finalIndex + 1, items.length);
                } else if (remainingSpace === 0) {
                    arrayCopy(items, this.data, 0, 0, items.length)
                    this.offset = 0;
                } else {
                    arrayCopy(items, this.data, 0, this.finalIndex + 1, remainingSpace);
                    arrayCopy(items, this.data, remainingSpace, 0, items.length - remainingSpace)
                }

                if (items.length > remainingSize) {
                    this._size = this.maxSize;

                    this.offset = boundAdd(this.maxSize, this.offset, items.length - remainingSize);
                } else {
                    this._size += items.length;
                }
            }
        } else {
            for (const item of items) {
                this.push(item);
            }
        }
    }

    public unshiftMany(items: Iterable<T>): void {
        // items kinda' has to be an array for this to work
        if (!isArray(items)) return this.unshiftMany(toArray(items));

        if (items.length > this.maxSize) {
            const dstStart = boundSubtract(this.maxSize, this.firstIndex, items.length);

            const startSrcLength = this.maxSize - dstStart
            
            arrayCopy(items, this.data, 0, dstStart, startSrcLength)
            arrayCopy(items, this.data, startSrcLength, 0, this.maxSize - startSrcLength)
            this.size = this.maxSize;
            this.offset = dstStart;
        } else {
            const remainingSpace = this.offset
            const remainingSize = this.maxSize - this.size

            if (items.length <= remainingSpace) {
                arrayCopy(items, this.data, 0, this.offset - items.length, items.length);
            } else if (remainingSpace === 0) {
                arrayCopy(items, this.data, 0, this.maxSize - items.length, items.length)
            } else {
                arrayCopy(items, this.data, items.length - remainingSpace, 0, remainingSpace);
                arrayCopy(items, this.data, items.length - remainingSpace - 1, this.maxSize -(items.length - remainingSpace), items.length - remainingSpace)
            }

            if (items.length > remainingSize) {
                // TODO
                this._size = this.maxSize;

                this.offset = boundSubtract(this.maxSize, this.offset, items.length - remainingSize);
            } else {
                // TODO
                this._size += items.length;

                this.offset = boundSubtract(this.maxSize, this.offset, items.length);
            }
        }
    }

    private addToIndex(index: number, plus: number): number {
        if (plus < 0) return this.subtractFromIndex(index, -plus);
        if (index < 0) index = this.subtractFromIndex(0, -index)
        plus %= this.maxSize;
        index %= this.maxSize;

        if (plus >= (this.maxSize - index)) {
            return plus - (this.maxSize - index);
        }

        return index + plus
    }

    private subtractFromIndex(index: number, minus: number): number {
        if (minus < 0) return this.addToIndex(index, -minus);
        if (index < 0) index - this.subtractFromIndex(0, -index);
        minus %= this.maxSize
        index %= this.maxSize

        if (minus > index) {
            return this.maxSize - (minus - index);
        }

        return index - minus;
    }
    

    /**
     * Appends the item to the start of the buffer (which would be removed by {@link shift}).
     * Removes an item from the end if buffer is full.
     */
    public unshift(item: T): void {
        if (this.maxSize === 0) return;
        this.decrementFirstIndex();
        this.data[this.firstIndex] = item;
    }

    /**
     * Removes the final element (the element added by {@link push}).
     * @returns The final element or undefined if the buffer was empty.
     */
    public pop(): T | undefined {
        if (this.size === 0) return undefined;

        const finalIndex = this.finalIndex;
        const result = this.data[finalIndex];

        // delete to allow garbage collection.
        delete this.data[finalIndex];

        // shrink items
        this.decrementFinalIndex();

        return result;
    }

    /**
     * Removes the first element (the element added by {@link unshift}).
     * @returns The first element or undefined if the buffer is empty.
     */
    public shift(): T | undefined {
        if (this.size === 0) return undefined;

        const firstIndex = this.firstIndex;
        const result = this.data[firstIndex];

        // delete to allow garbage collection
        delete this.data[firstIndex];

        // shrink items
        this.incrementedFirstIndex();

        return result;
    }

    /**
     * @param index The index of the element to get. Negative indexes refer to the end of the buffer and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     * @returns The element at the given index or undefined if the index is out of bounds.
     */
    public at(index: number): T | undefined {
        const dataIndex = this.dataIndexAt(index);
        if (dataIndex === -1) return undefined;
        return this.data[dataIndex];
    }

    /**
     * Sets the element at the given index to the given value as long the index is in bounds with the buffer's {@link size}.
     * @param index The index of the element to set. Negative indexes refer to the end of the buffer and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     */
    public set(index: number, item: T): void {
        const dataIndex = this.dataIndexAt(index);
        if (dataIndex === -1) return;
        this.data[dataIndex] = item;
    }

    /**
     * @returns The index in {@link data} of the item with the given index. -1 if index out of bounds.
     */
    private dataIndexAt(index: number): number {
        if (index < 0) {
            if (-index > this.size) return -1;
            return this.dataIndexAt(this.size + index);
        }

        if (index >= this.size) return -1;

        if (index >= this.maxSize - this.offset) {
            return index - (this.maxSize - this.offset);
        } else {
            return this.offset + index;
        }
    }

    /**
     * Whether the data is split across the end of the data array.
     *   - If true: `data: [567----01234]`
     *   - If false: `data: [---01234567--]`
     */
    private isSplit(): boolean {
        return this.size > this.maxSize - this.offset;
    }

    /**
     * The length of the beginning section of the data if the data {@link isSplit}. Nonsense otherwise.
     * ```
     * data: [567----01234]
     *              |-----| <--- length of this section
     * ```
     */
    private get beginningLength(): number {
        return this.maxSize - this.offset;
    }

    /**
     * The length of the end section of the data if the data {@link isSplit}. Nonsense otherwise.
     * ```
     * data: [567----01234]
     *       |---| <--- length of this section
     * ```
     */
    private get endLength(): number {
        return this.size - this.beginningLength;
    }

    /** The index in {@link data} of the first item. */
    private get firstIndex(): number {
        return this.offset;
    }

    /** The index in {@link data} of the final item. */
    private get finalIndex(): number {
        if (this.isSplit()) {
            return this.size - (this.maxSize - this.offset) - 1;
        } else {
            return this.offset + this.size - 1;
        }
    }

    /** Expand items by moving the final index forwards. Moves first index forwards too if the buffer is full. */
    private incrementFinalIndex(): void {
        if (this.size < this.maxSize) {
            this.size++;
        } else {
            if (this.offset === this.maxSize - 1) {
                this.offset = 0;
            } else {
                this.offset++;
            }
        }
    }

    /** Shrink items by moving the final index backwards. */
    private decrementFinalIndex(): void {
        this.size--;
    }

    /** Shrink items by moving first index forwards. */
    private incrementedFirstIndex(): void {
        if (this.size > 0) this.size--;
        if (this.offset === this.maxSize - 1) {
            this.offset = 0;
        } else {
            this.offset++;
        }
    }

    /** Expand items by moving first index backwards. Moves final index backwards too if the buffer is full. */
    private decrementFirstIndex(): void {
        if (this.size < this.maxSize) this.size++;
        if (this.offset === 0) {
            this.offset = this.maxSize - 1;
        } else {
            this.offset--;
        }
    }
}

/**
 * Copies data from one array to another.
 *
 * *Note* that there are no constraints on the inputs as this function is expected to be used where it will only receive sensical arguments.
 */
function arrayCopy<T>(
    src: readonly T[],
    dst: T[],
    srcStart: number,
    dstStart: number,
    length: number
) {
    // SOMEHOW this is faster than using any build in library functions
    for (let i = 0; i < length; i++) {
        dst[dstStart + i] = src[srcStart + i]!;
    }

    // I think the interpreter knows what I'm trying to do
    // and just uses memcpy instead.
    // I hope.
    //
    // In the end, this makes the toArray function about as fast
    // as copying an actual array, as in: [...array].
    //
    // a little slower -- 1100ms vs 1400ms
}




export let c = new CircularBuffer(3)
export let c2 = new CircularBuffer(3)
c.push(1)
c.push(2)

c2.pushMany([1,2])

console.log("----")
console.log(c)
console.log(c2)
console.log("----")

let a = []
for (let i = 3; i < 11; i++) a.push(i);
console.log(a)
console.log("----")

for(let n of a) c.push(n);

c2.pushMany(a)
console.log(c)
console.log(c2)
console.log("---")


function boundAdd(bound: number, a: number, b: number) : number {
    if (a < 0) a = boundSubtract(bound, 0, -a);
    if (b < 0) b = boundSubtract(bound, 0, -b);
    a %= bound;
    b %= bound;
    if (b >= (bound - a)){
        return b - (bound - a);
    }
    return a + b
}

function boundSubtract(bound: number, a: number, b: number): number {
    if (a < 0) a = boundSubtract(bound, 0, -a);
    if (b < 0) b = boundSubtract(bound, 0, -b);
    a %= bound;
    b %= bound;
    if (b > a) {
        return bound - (b - a);
    }
    return a - b
}

c = new CircularBuffer(5)
c.pushMany([0,1,2,3,4,5])
c2 = c.clone()
a = []
for(let i = 0; i >= -27; i--) a.push(i);

for (let n of a) c.unshift(n);
c2.unshiftMany([...a].reverse());
console.log(c);
console.log(c2);