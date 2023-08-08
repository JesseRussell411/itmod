import { requireNonNegative, requireSafeInteger } from "../require";
import Collection from "./Collection";

// TODO insert, delete, resize

/** Buffer of limited size that can shift, unshift, push, and pop elements equally efficiently. Elements can be added until the maximum size is reached; whereupon, elements on the opposite side of the buffer are removed to make room.*/
export default class CircularBuffer<T> extends Collection<T> {
    private readonly data: (T | undefined)[];
    private offset: number;
    private _size: number;

    /**
     * @param maxSize The maximum number of elements that can be stored in the buffer before elements are overwritten.
     */
    public constructor(maxSize: number) {
        requireSafeInteger(requireNonNegative(maxSize));
        super();
        this.data = new Array(maxSize);
        this.offset = 0;
        this._size = 0;
    }

    public [Symbol.iterator](): Iterator<T> {
        const self = this;
        return (function* () {
            for (let i = 0; i < self.size; i++) {
                yield self.at(i)!;
            }
        })();
    }

    /** The maximum number of elements that can be stored in the buffer before elements are overwritten. */
    public get maxSize(): number {
        return this.data.length;
    }

    /** How many elements are in the buffer. */
    public get size(): number {
        return this._size;
    }
    private set size(value: number) {
        this._size = value;
    }

    /** Whether the {@link maxSize} has been reached. */
    public get isFull(): boolean {
        return this.size >= this.maxSize;
    }

    /** Whether the {@link maxSize} has not been reached. */
    public get notFull(): boolean {
        return !this.isFull;
    }

    /**
     * @param index The index of the element to get. Negative indexes refer to the end of the buffer and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     * @returns The element at the given index or undefined if the index is out of bounds.
     */
    public at(index: number): T | undefined {
        requireSafeInteger(index);
        if (!Collection.signedIndexInBounds(this.size, index)) return undefined;
        return this.data[
            Collection.loopSignedIndex(this.maxSize, index + this.offset)
        ];
    }

    /**
     * Sets the element at the given index to the given value as long the index is in bounds with the buffer's {@link size}.
     * @param index The index of the element to set. Negative indexes refer to the end of the buffer and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     */
    public set(index: number, value: T): void {
        requireSafeInteger(index);
        if (!Collection.signedIndexInBounds(this.size, index)) return;
        this.data[
            Collection.loopSignedIndex(this.maxSize, index + this.offset)
        ] = value;
    }

    /**
     * Appends the value to the end of the buffer, removing the first element if the buffer is full.
     */
    public push(value: T): void {
        if (this.maxSize === 0) return;
        if (this.size >= this.maxSize) {
            this.shift();
        }
        const index = this.nextFinalIndex();
        this.data[index] = value;
        this.size++;
    }

    /**
     * Appends the value to the start of the buffer, removing the final element if the buffer is full.
     */
    public unshift(value: T): void {
        if (this.maxSize === 0) return;
        if (this.size >= this.maxSize) {
            this.pop();
        }

        const index = this.previousFirstIndex();
        this.data[index] = value;
        this.size++;
        this.offset = index;
    }

    /**
     * Removes the final element (result of {@link push}).
     * @returns The final element or undefined if the buffer is empty.
     */
    public pop(): T | undefined {
        if (this.size <= 0) return undefined;
        const index = this.finalIndex();
        this.size--;
        const result = this.data[index];
        this.data[index] = undefined; // clear for garbage collection
        return result;
    }
    /**
     * Removes the first element (result of {@link unshift}).
     * @returns The first element or undefined if the buffer is empty.
     */
    public shift(): T | undefined {
        if (this.size <= 0) return undefined;
        const index = this.offset;
        this.size--;
        this.offset = this.nextFirstIndex();
        const result = this.data[index];
        this.data[index] = undefined; // clear for garbage collection
        return result;
    }

    /** @returns The index in {@link data} of the final element. */
    private finalIndex() {
        if (this.offset > this.maxSize - this.size) {
            return this.offset - (this.maxSize - this.size) - 1;
        } else {
            return this.size + this.offset - 1;
        }
    }

    /** @returns The index in {@link data} one place following the final element. */
    private nextFinalIndex() {
        if (this.offset >= this.maxSize - this.size) {
            return this.offset - (this.maxSize - this.size);
        } else {
            return this.size + this.offset;
        }
    }

    /** @returns The index in {@link data} one place preceding the first element. */
    private previousFirstIndex() {
        if (this.offset === 0) {
            return this.maxSize - 1;
        } else {
            return this.offset - 1;
        }
    }

    /** @returns The index in {@link data} one place following the first element. */
    private nextFirstIndex() {
        if (this.offset === this.data.length - 1) {
            return 0;
        } else {
            return this.offset + 1;
        }
    }
}
