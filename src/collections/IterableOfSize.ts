import Collection from "./Collection";

/**
 * An {@link Iterable} of a known size.
 */
export default class IterableOfSize<
    T,
    Size extends number
> extends Collection<T> {
    private readonly iterable: Iterable<T>;
    public readonly size: Size;
    /**
     * Instantiates a sized iterable.
     *
     * @param iterable The iterable. *NOTE:* if this iterable turns out not to be of the given size, an error will be thrown, either when the iterable goes past the given size during iteration or when the iterable runs out before reaching the given size during iteration.
     * @param size How many elements are in the iterable.
     */
    public constructor(iterable: Iterable<T>, size: Size) {
        super();
        this.iterable = iterable;
        this.size = size;
    }
    public *[Symbol.iterator]() {
        let count = 0;
        for (const item of this.iterable) {
            count++;
            if (count > this.size) {
                throw new IterableOfIncorrectSizeError(this.size, count);
            }
            yield item;
        }
        if (count < this.size) {
            throw new IterableOfIncorrectSizeError(this.size, count);
        }
    }
}

export class IterableOfIncorrectSizeError<
    ExpectedSize extends number
> extends Error {
    public readonly expectedSize: ExpectedSize;
    public readonly receivedSize: number;

    public constructor(expectedSize: ExpectedSize, receivedSize: number) {
        super(
            `expected size of iterable: ${expectedSize}. received iterable of size: ${receivedSize}`
        );
        this.expectedSize = expectedSize;
        this.receivedSize = receivedSize;
    }
}
