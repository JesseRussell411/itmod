import { requireNonNegative, requireSafeInteger } from "../require";
import Collection from "./Collection";

export default class CircularBuffer<T> extends Collection<T> {
    private data: (T | undefined)[];
    private offset: number;
    private _size: number;

    public get size() {
        return this._size;
    }
    private set size(value: number) {
        this._size = value;
    }

    /** The maximum number of elements that can be stored in the buffer before elements are overwritten. */
    public get maxSize() {
        return this.data.length;
    }

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
        return this.size >= this.maxSize;
    }

    /** Whether the {@link maxSize} has not been reached. */
    public get notFull(): boolean {
        return !this.isFull;
    }

    public *[Symbol.iterator](): Iterator<T> {
        for (let i = 0; i < this.size; i++) {
            return this.at(i);
        }
    }

    public toArray(maxLength: number = Infinity): T[] {
        if (this.isSplit()) {
            const beginningLength = this.maxSize - this.offset;

            const endLength = this.offset - (this.maxSize - this.size);

            return [
                // beginning is at the end of the array
                ...this.data.slice(
                    this.offset,
                    this.offset + Math.min(maxLength, beginningLength)
                ),
                // end is at the beginning of the array
                ...this.data.slice(
                    0,
                    Math.min(
                        Math.max(0, maxLength - beginningLength),
                        endLength
                    )
                ),
            ] as T[];
        } else {
            return this.data.slice(
                this.offset,
                this.offset + Math.min(maxLength, this.size)
            ) as T[];
        }
    }

    /**
     * copies the contents of the circular buffer into a new circular buffer.
     */
    public clone(maxSize?: number) {
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
     * Appends the value to the end of the buffer, removing the first element if the buffer is full.
     */
    public push(item: T): void {
        this.incrementFinalIndex();
        this.data[this.finalIndex()] = item;
    }

    /**
     * Appends the value to the start of the buffer, removing the final element if the buffer is full.
     */
    public unshift(item: T): void {
        this.decrementFirstIndex();
        this.data[this.firstIndex()] = item;
    }

    /**
     * Removes the final element (result of {@link push}).
     * @returns The final element or undefined if the buffer is empty.
     */
    public pop(): T | undefined {
        if (this.size === 0) return undefined;
        const finalIndex = this.finalIndex();
        const result = this.data[finalIndex];
        this.data[finalIndex] = undefined;
        this.decrementFinalIndex();
        return result;
    }

    /**
     * Removes the first element.
     * @returns The first element or undefined if the buffer is empty.
     */
    public shift(): T | undefined {
        if (this.size === 0) return undefined;
        const firstIndex = this.firstIndex();
        const result = this.data[firstIndex];
        this.data[firstIndex] = undefined;
        this.incrementedFirstIndex();
        return result;
    }

    /**
     * @param index The index of the element to get. Negative indexes refer to the end of the buffer and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     * @returns The element at the given index or undefined if the index is out of bounds.
     */
    public at(index: number): T | undefined {
        const dataIndex = this.dataIndexAt(index);
        if (dataIndex === undefined) return undefined;
        return this.data[dataIndex];
    }

    /**
     * Sets the element at the given index to the given value as long the index is in bounds with the buffer's {@link size}.
     * @param index The index of the element to set. Negative indexes refer to the end of the buffer and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     */
    public set(index: number, item: T): void {
        const dataIndex = this.dataIndexAt(index);
        if (dataIndex === undefined) return;
        this.data[dataIndex] = item;
    }

    private dataIndexAt(index: number): number | undefined {
        if (index < 0) {
            if (-index > this.size) return undefined;
            return this.dataIndexAt(this.size + index);
        }

        if (index >= this.size) return undefined;

        if (index >= this.maxSize - this.offset) {
            return index - (this.maxSize - this.offset);
        } else {
            return this.offset + index;
        }
    }

    private isSplit(): boolean {
        return this.size > this.maxSize - this.offset;
    }

    private firstIndex(): number {
        return this.offset;
    }

    private finalIndex(): number {
        if (this.isSplit()) {
            return this.size - (this.maxSize - this.offset) - 1;
        } else {
            return this.offset + this.size - 1;
        }
    }

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

    private decrementFinalIndex(): void {
        this.size--;
    }

    private incrementedFirstIndex(): void {
        if (this.size > 0) this.size--;
        if (this.offset === this.maxSize - 1) {
            this.offset = 0;
        } else {
            this.offset++;
        }
    }

    private decrementFirstIndex(): void {
        if (this.size < this.maxSize) this.size++;
        if (this.offset === 0) {
            this.offset = this.maxSize - 1;
        } else {
            this.offset--;
        }
    }
}
