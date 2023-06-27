export default interface Collection<T> extends Iterable<T> {
    /** How many items are in the collection. Assumed to have constant or near constant time complexity. */
    get size(): number;
    // * the creators of java really screwed up with their Collection interface by not specifying that count() had to have constant time complexity, really made a mess of things when comparing the equality of two different types of lists, they don't check size. One could be 1000 items long and the other 1001 items, which would mean that they're not equal, but java will still iterate through 1000 items of both of them any way
}
