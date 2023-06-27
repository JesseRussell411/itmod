export default interface Collection<T> extends Iterable<T> {
    /** How many items are in the collection. Assumed to have constant or near constant time complexity. */
    get size(): number;
}
