export default abstract class Collection<T> implements Iterable<T> {
    /** How many elements are in the {@link Collection}. Required to have constant or near constant time complexity and low latency. */
    public abstract get size(): number;
    // personal opinion on design: the creators of java made a mistake with their Collection interface by not specifying that count() had to have constant time complexity, unfortunately, when comparing the equality of two different types of lists, they don't check size. One could be 1000 items long and the other 1001 items, which would mean that they're not equal, but java will still iterate through 1000 items of both of them anyway because it can't assume that Count() is efficient.

    /** Returns an {@link Iterator} over the {@link Collection}'s elements. */
    public abstract [Symbol.iterator](): Iterator<T>;

    /** Whether the {@link Collection} contains no elements. */
    public get isEmpty(): boolean {
        return this.size <= 0;
    }

    /** Whether the {@link Collection} contains any elements. */
    public get notEmpty(): boolean {
        return !this.isEmpty;
    }

    /**
     * Convert the signed index to an unsigned index.
     */
    protected static loopSignedIndex(bounds: number, index: number): number {
        const modded = index % bounds;
        if (modded < 0) {
            return modded + bounds;
        } else {
            return modded;
        }
    }

    /**
     * Whether the signed index is in bounds.
     */
    protected static signedIndexInBounds(
        bounds: number,
        index: number
    ): boolean {
        if (index < 0) {
            return -index <= bounds;
        } else {
            return index < bounds;
        }
    }
}
