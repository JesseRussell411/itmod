/**
 * A collections of elements that has a known size and can be iterated.
 */
export default abstract class Collection<T> implements Iterable<T> {
    /** How many elements are in the {@link Collection}. Assumed to have constant or near constant time complexity and low latency. */
    public abstract get size(): number;
    // personal opinion on design:
    // the creators of java made a mistake with their Collection
    // interface by not specifying that size() had to have
    // constant time complexity, unfortunately, when comparing
    // the equality of two different types of lists, they don't
    // check size. One could be 1000 items long and the other
    // 1001 items, which would mean that they're not equal, but
    // java will still iterate through 1000 items of both of them
    // anyway because it can't assume that size() is efficient.

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
     * @returns The {@link Collection}'s contents copied into an {@link Array}.
     */
    public toArray(): T[] {
        return [...this];
    }

    /**
     * @returns An {@link Iterable} over the {@link Collection}'s elements in reverse order.
     */
    public reversed(): Iterable<T> {
        const self = this;
        return {
            *[Symbol.iterator]() {
                const array = self.toArray();
                for (let i = array.length - 1; i >= 0; i--) {
                    yield array[i] as T;
                }
            },
        };
    }

    /**
     * @returns The first element in the collection given by its iterator.
     */
    public first(): T | undefined {
        for (const item of this) return item;
    }

    /**
     * @returns The final element in the collection given by its iterator.
     */
    public final(): T | undefined {
        let final: T | undefined = undefined;
        for (const item of this) final = item;
        return final;
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
