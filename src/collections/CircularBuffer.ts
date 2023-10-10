import { requireNonNegative, requireSafeInteger } from "../require";
import Collection from "./Collection";

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
     * @param maxLength Maximum length of the returned array. Truncates values that don't fit from the end of the buffer.
     * @returns The {@link Array}.
     */
    public toArray(maxLength: number = Infinity): T[] {
        if (this.isSplit()) {
            // The elements are split across the end of the data array

            // data: [567----01234]
            //       |---|  |-----| <-- beginning section
            //         ^
            //          \__end section

            /** The number of items to take from the beginning section. */
            const maxBeginningLength = Math.min(
                this.beginningLength,
                maxLength
            );

            /** The number of items to take from the end section. */
            const maxEndLength = Math.min(
                this.endLength,
                maxLength - maxBeginningLength
            );

            // beginning is at the end of the array
            return [
                // 01234]
                ...this.data.slice(
                    this.firstIndex,
                    this.firstIndex + maxBeginningLength
                ),
                // [567
                ...this.data.slice(0, maxEndLength),
            ] as T[];
            // design note: much faster than iteration ([...buffer]) but I wish javascript had a memcopy-like function for copying items from a section of one array to a section of another.
            // This requires the slice function to create a "middleman" array that isn't really necessary.
        } else {
            // data: [---01234567---]
            // Much simpler scenario. Elements are somewhere within the data array, not split in the middle.

            return this.data.slice(
                this.offset,
                this.offset + Math.min(maxLength, this.size)
            ) as T[];
        }
    }

    /**
     * copies the contents of the circular buffer into a new circular buffer.
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

            if (maxSize > this.maxSize) {
                data[maxSize - 1] = undefined;
            }

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
        this.data = new Array(this.maxSize);
        this.offset = 0;
        this.size = 0;
    }

    /**
     * Appends the element to the end of the buffer (which would be removed by {@link pop}).
     * Removing the first element if the buffer is full.
     */
    public push(item: T): void {
        if (this.maxSize === 0) return;
        this.incrementFinalIndex();
        this.data[this.finalIndex] = item;
    }

    /**
     * Appends the element to the start of the buffer (which would be removed by {@link shift}).
     * Removes the final element if the buffer was full.
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

        // set value to undefined to allow garbage collection.
        this.data[finalIndex] = undefined;

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

        // set value to undefined to allow garbage collection
        this.data[firstIndex] = undefined;

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
