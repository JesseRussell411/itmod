import Collection from "./Collection";

// TODO insert, delete, resize

/** Buffer of limited size that can shift, unshift, push, and pop elements equally efficiently. Elements can be added until the maximum size is reached; whereupon, elements on the opposite side of the buffer are removed to make room.*/
export default class CircularBuffer<T> implements Collection<T> {
    private readonly data: (T | undefined)[];
    private offset: number;
    private _size: number;
    /**
     * @param maxSize The maximum number of elements that can be stored in the buffer before elements are overwritten.
     */
    public constructor(maxSize: number) {
        this.data = new Array(maxSize);
        this.offset = 0;
        this._size = 0;
    }

    public *[Symbol.iterator]() {
        for (let i = 0; i < this.size; i++) {
            yield this.at(i) as T;
        }
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

    /**
     * @param index The index of the element to get. Negative indexes refer to the end of the buffer and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     * @returns The element at the given index or undefined if the index is out of bounds.
     */
    public at(index: number): T | undefined {
        if (!signedIndexInBounds(this.size, index)) return undefined;
        return this.data[loopSignedIndex(this.maxSize, index + this.offset)];
    }

    /**
     * Sets the element at the given index to the given value as long the index is in bounds with the buffer's {@link size}.
     * @param index The index of the element to set. Negative indexes refer to the end of the buffer and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     */
    public set(index: number, value: T): void {
        if (!signedIndexInBounds(this.size, index)) return;
        this.data[loopSignedIndex(this.maxSize, index + this.offset)] = value;
    }

    /**
     * Appends the value to the end of the buffer, removing the first element if the buffer is full.
     */
    public push(value: T): void {
        if (this.size >= this.maxSize) {
            this.shift();
        }
        const index = loopSignedIndex(this.maxSize, this.offset + this.size);
        this.data[index] = value;
        this.size++;
    }

    /**
     * Appends the value to the start of the buffer, removing the final element if the buffer is full.
     */
    public unshift(value: T): void {
        if (this.size >= this.maxSize) {
            this.pop();
        }

        const index = loopSignedIndex(this.maxSize, this.offset - 1);
        this.data[index] = value;
        this.size++;
        this.offset = index;
    }

    /**
     * Removes the final element (result of {@link push}).
     */
    public pop(): T | undefined {
        if (this.size <= 0) return undefined;
        const index = loopSignedIndex(
            this.maxSize,
            this.size + this.offset - 1
        );
        this.size--;
        const result = this.data[index];
        this.data[index] = undefined; // clear for garbage collection
        return result;
    }
    /**
     * Removes the first element (result of {@link unshift}).
     */
    public shift(): T | undefined {
        if (this.size <= 0) return undefined;
        const index = loopSignedIndex(this.maxSize, this.offset);
        this.size--;
        this.offset = loopSignedIndex(this.maxSize, this.offset + 1);
        const result = this.data[index];
        this.data[index] = undefined; // clear for garbage collection
        return result;
    }
}

function loopSignedIndex(bounds: number, index: number): number {
    const modded = index % bounds;
    if (modded < 0) {
        return modded + bounds;
    } else {
        return modded;
    }
}

function signedIndexInBounds(bounds: number, index: number): boolean {
    if (index < 0) {
        return -index <= bounds;
    } else {
        return index < bounds;
    }
}
