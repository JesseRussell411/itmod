// avl tree implementation with *no dependencies*

import { doNothing, resultOf } from "../functional";
import { requireSafeInteger } from "../require";
import { Comparator, Order, asComparator, autoComparator } from "../sorting";
import Collection from "./Collection";
import { MapEntry } from "./MapEntry";

// TODO? red-black tree, this is an avl tree because avl trees are easy

// design note: If they ever add a sorted map or set to the ecmascript standard,
// I will be very happy to make this a deprecated wrapper around that,
// or even a child class of it.

// I'm sure whatever the V8 team can put together in C would be much more efficient than my undergrad level, intro to data structures avl tree.

/**
 * A map that stores key-value pairs in the order specified.
 */
export default class SortedMap<K, V> implements Collection<MapEntry<K, V>> {
    private root: Node<K, V> | undefined;
    private comparator: Comparator<K>;
    private _size: number = 0;

    /**
     * How many entries are in the {@link SortedMap}.
     */
    public get size() {
        return this._size;
    }

    /**
     * Whether the {@link SortedMap} contains no entries.
     */
    public get isEmpty() {
        return this.size <= 0;
    }

    /**
     * Whether the {@link SortedMap} contains any entries.
     */
    public get notEmpty() {
        return !this.isEmpty;
    }

    /**
     * @param order How to compare the keys. Defaults to {@link autoComparator}.
     */
    public constructor(order: Order<K> = autoComparator) {
        this.comparator = asComparator(order);
    }

    public *[Symbol.iterator]() {
        if (undefined === this.root) return;
        for (const node of this.root) {
            yield node.entry;
        }
    }

    // TODO keys() and values() and entries() that return iterables of keys and values and entries like in Map

    /**
     * Inserts the key into the tree.
     *
     * @returns Whether the key wasn't already in the tree.
     *
     * @param key The key to insert.
     * @param overwrite If the key is already in the tree, it is overwritten with the output of this function. Defaults to overwriting the existing value.
     */
    public set(
        key: K,
        value: V,
        overwrite: (
            /** The value to the key that is already in the tree */
            existingValue: V,
            /** The key that is already in the tree. */
            existingKey: K,
            /** The value that was suppose to be inserted. */
            value: V,
            /** The key that was suppose to be inserted. */
            key: K
        ) => readonly [overwriteKey: boolean, value: V] = (_, __, value) => [
            true,
            value,
        ]
    ): boolean {
        // if root is null, add root node
        if (undefined === this.root) {
            this.root = new Node(key, value);
            this._size++;
            return true;
        } else {
            // if root is not null, insert into root
            let inserted = false;
            this.root = this.root
                .locateOrInsert(
                    this.comparator,
                    key,
                    value,
                    (location) => {
                        const [overwriteKey, newValue] = overwrite(
                            location.value,
                            location.key,
                            value,
                            key
                        );
                        location.value = newValue;
                        if (overwriteKey) {
                            location.key = key;
                        }
                    },
                    () => {
                        inserted = true;
                        this._size++;
                    }
                )
                ?.balance();

            return inserted;
        }
    }

    /**
     * Gets the values mapped to the given key.
     * Alias for {@link getValue}.
     * @returns The value or undefined if no value is mapped to the key.
     */
    public get(key: K): V | undefined {
        return this.getValue(key);
    }

    /**
     * Gets the values mapped to the given key.
     * @returns The value or undefined if no value is mapped to the key.
     */
    public getValue(key: K): V | undefined {
        return this.root?.locate(this.comparator, key)?.value ?? undefined;
    }

    /**
     * Gets the key that matches the given key based on the comparator.
     * @returns The key or undefined if it does not exist in the {@link SortedMap}.
     */
    public getKey(key: K): K | undefined {
        return this.root?.locate(this.comparator, key)?.key ?? undefined;
    }

    /**
     * Gets the entry whith the key that matches the given key according to the comparator.
     * @returns The entry or undefined if it does not exist in the {@link SortedMap}.
     */
    public getEntry(key: K): MapEntry<K, V> | undefined {
        return this.root?.locate(this.comparator, key)?.entry ?? undefined;
    }

    /**
     * Gets the key that matches the given key according to the comparator. If the key is not found, it is inserted with the given value or the result of the given function.
     * @param newValue The value to insert if the key is not found. If this is a function, its result will be used instead.
     * @returns The key that matches the given key or the given key if it was not found.
     */
    public getKeyOrSet(key: K, newValue: V | (() => V)): K {
        return this.locateOrInsert(key, newValue).location.key;
    }

    /**
     * Gets the value that is mapped to the given key according to the comparator. If the key is not found, it is inserted with the given value or the result of the given function.
     * @param newValue The value to insert if the key is not found. If this is a function, its result will be used instead.
     * @returns The value that was mapped to the key or the inserted value if the key was not found.
     */
    public getOrSet(key: K, newValue: V | (() => V)): V {
        return this.locateOrInsert(key, newValue).location.value;
    }

    /**
     * Gets the entry that is mapped to the given key according to the comparator. If the key is not found, it is inserted with the given value or the result of the given function.
     * @param newValue The value to insert if the key is not found. If this is a function, its result will be used instead.
     * @returns The entry that was mapped to the key or the inserted entry if the key was not found.
     */
    public getEntryOrSet(key: K, newValue: V | (() => V)): MapEntry<K, V> {
        return this.locateOrInsert(key, newValue).location.entry;
    }

    /**
     * @param key The key to look for a match for.
     * @returns Whether the {@link SortedMap} contains a matching key.
     */
    public hasKey(key: K): boolean {
        return this.root?.locate(this.comparator, key) !== undefined;
    }

    /**
     * Removes the entry with the given key from the {@link SortedMap}.
     * @returns The entry that was removed or undefined if the key wasn't found and no entry was removed.
     */
    public delete(key: K): MapEntry<K, V> | undefined {
        let removedNode: Node<K, V> | undefined;

        this.root = this.root?.remove(
            this.comparator,
            key,
            (removed) => (removedNode = removed)
        );
        this.root = this.root?.balance();

        if (undefined !== removedNode) {
            this._size--;
        }

        return removedNode?.entry;
    }

    /**
     * Deletes the entry with the largest key.
     */
    public deleteGreatest(): MapEntry<K, V> | undefined {
        let deletedEntry: MapEntry<K, V> | undefined = undefined;
        this.root?.removeLargest(
            (deletedNode) => (deletedEntry = deletedNode.entry)
        );
        return deletedEntry;
    }

    /**
     * Deletes the entry with the smallest key.
     */
    public deleteLeast(): MapEntry<K, V> | undefined {
        let deletedEntry: MapEntry<K, V> | undefined = undefined;
        this.root?.removeSmallest(
            (deletedNode) => (deletedEntry = deletedNode.entry)
        );
        return deletedEntry;
    }

    /**
     * @param index The index at which the {@link MapEntry} would appear. Negative values count from the end starting at -1; -1 being the final item, -2 being the second to final item, etc.
     * @returns The {@link MapEntry} that would appear at the given index when iterating this {@link SortedMap}.
     */
    public at(index: number): MapEntry<K, V> | undefined {
        requireSafeInteger(index);
        if (index < 0) {
            if (-index > this.size) {
                throw new Error(
                    `index ${index} out of bounds -${this.size} <= index < 0`
                );
            }
            return this.at(this.size + index);
        }
        if (index >= this.size) {
            throw new Error(
                `index ${index} out of bounds 0 <= index < ${this.size}`
            );
        }
        return this.root?.at(index)?.entry;
    }

    /**
     *
     * @param index The index at which the key would appear. Negative values count from the end starting at -1; -1 being the final item, -2 being the second to final item, etc.
     * @returns The key that would appear at the given index when iterating this {@link SortedMap}.
     */
    public keyAt(index: number): K | undefined {
        return this.at(index)?.[0];
    }

    /**
     * @param index The index at which the key would appear. Negative values count from the end starting at -1; -1 being the final item, -2 being the second to final item, etc.
     * @returns The value that would appear at the given index when iterating this {@link SortedMap}.
     */
    public valueAt(index: number): V | undefined {
        return this.at(index)?.[1];
    }

    /**
     * @param lowerBound The lowest possible key to return (inclusive lower bound).
     * @param upperBound What all keys returned must be less than (exclusive upper bound).
     * @returns A {@link Generator} over the specified range of entries.
     */
    public *range(lowerBound: K, upperBound: K): Generator<MapEntry<K, V>> {
        if (undefined === this.root) return;
        for (const node of this.root.range(
            this.comparator,
            lowerBound,
            upperBound
        )) {
            yield node.entry;
        }
    }

    /**
     * Locates the entry with the given key. If it's not found, a new entry is inserted.
     *
     */
    private locateOrInsert(
        key: K,
        newValue: V | (() => V)
    ): Readonly<{
        /** Whether the entry had to be inserts because it wasn't located. */
        inserted: boolean;

        /** Where the entry is located. */
        location: Node<K, V>;
    }> {
        if (undefined === this.root) {
            this.root = new Node(key, resultOf(newValue));
            this._size++;
            return { inserted: true, location: this.root };
        }

        let inserted = false;
        let location: Node<K, V> | undefined;
        this.root = this.root.locateOrInsert(
            this.comparator,
            key,
            newValue,
            (node) => {
                location = node;
            },
            (node) => {
                this._size++;
                location = node;
                inserted = false;
            }
        );

        return { inserted, location: location! };
    }
}

function calcBalanceFactor(
    left: Node<any, any> | undefined,
    right: Node<any, any> | undefined
): number {
    return (right?._depth ?? 0) - (left?._depth ?? 0);
}

function calcDepth(
    left: Node<any, any> | undefined,
    right: Node<any, any> | undefined
): number {
    return Math.max(right?.depth ?? -1, left?.depth ?? -1) + 1;
}

function calcNodeCount(
    left: Node<any, any> | undefined,
    right: Node<any, any> | undefined
): number {
    return (left?.nodeCount ?? 0) + (right?.nodeCount ?? 0) + 1;
}

class Node<K, V = undefined> implements Iterable<Node<K, V>> {
    // Any field that would be undefined is left un-set to save memory.
    // That is what the ts-ignores are for. So that typescript doesn't throw errors about these fields not being guarantied to be set.

    //@ts-ignore
    key: K;
    //@ts-ignore
    _value: V;
    //@ts-ignore
    _left: Node<K, V> | undefined;
    //@ts-ignore
    _right: Node<K, V> | undefined;

    _nodeCount: number;

    _depth: number;

    public get value() {
        return this._value;
    }

    public set value(value: V) {
        if (undefined !== value) this._value = value;
    }

    public get entry(): MapEntry<K, V> {
        return [this.key, this.value];
    }

    public get left() {
        return this._left;
    }

    public set left(left: Node<K, V> | undefined) {
        this._left = left;
        this.update();
    }

    public get right() {
        return this._right;
    }

    public set right(right: Node<K, V> | undefined) {
        this._right = right;
        this.update();
    }

    public get balanceFactor(): number {
        return calcBalanceFactor(this.left, this.right);
    }

    public get depth() {
        return this._depth;
    }

    public get nodeCount() {
        return this._nodeCount;
    }

    public constructor(
        key: K,
        value: V,
        left: Node<K, V> | undefined = undefined,
        right: Node<K, V> | undefined = undefined
    ) {
        if (undefined !== key) this.key = key;
        if (undefined !== value) this._value = value;
        if (undefined !== left) this._left = left;
        if (undefined !== right) this._right = right;
        this._depth = calcDepth(left, right);
        this._nodeCount = calcNodeCount(left, right);
    }

    public at(index: number): Node<K, V> | undefined {
        const leftNodeCount = this.left?.nodeCount ?? 0;
        if (index < leftNodeCount) {
            return this.left?.at(index);
        } else if (index > leftNodeCount) {
            return this.right?.at(index - leftNodeCount);
        } else {
            // index === leftNodeCount
            return this;
        }
    }

    public *[Symbol.iterator](): Iterator<Node<K, V>> {
        // no worries of stack overflow because the depth cannot be more than log_2(2^64) or 64
        if (undefined !== this.left) yield* this.left;
        yield this;
        if (undefined !== this.right) yield* this.right;
    }

    /**
     * @param comparator
     * @param lowerBound inclusive
     * @param upperBound exclusive
     * @returns A generator over the specified range of values.
     */
    public *range(
        comparator: (a: K, b: K) => number,
        lowerBound: K,
        upperBound: K
    ): Generator<Node<K, V>> {
        const upperBoundCmp = comparator(upperBound, this.key);
        if (upperBoundCmp <= 0) return;

        const lowerBoundCmp = comparator(lowerBound, this.key);

        if (lowerBoundCmp < 0 && undefined !== this.left) {
            yield* this.left.range(comparator, lowerBound, upperBound);
        }

        if (lowerBoundCmp === 0) {
            yield this;
        }

        if (undefined !== this.right) {
            yield* this.right.range(comparator, lowerBound, upperBound);
        }
    }

    public update(): void {
        this._depth = calcDepth(this._left, this._right);
        this._nodeCount = calcNodeCount(this._left, this._right);
    }

    public rotateLeft(): Node<K, V> {
        // right shouldn't be undefined if this function is being called
        const right = this._right!;

        // a undefined reference exception will be thrown here, before this._right is set, if right is undefined
        // so it's safe not to check.
        this.right = right._left;
        right.left = this;
        return right;
    }

    public rotateRight(): Node<K, V> {
        // left shouldn't be undefined if this function is being called
        const left = this._left!;

        // a undefined reference exception will be thrown here, before this._left is set, if left is undefined
        // so it's safe not to check.
        this.left = left._right;
        left.right = this;
        return left;
    }

    /** The right most sub node to this node or this node if this node has no right subnode. */
    public get rightMostSubNode(): Node<K, V> {
        let result: Node<K, V> = this;
        while (undefined !== result.right) {
            result = result.right;
        }
        return result;
    }

    /** The left most sub node to this node or this node if this node has no left subnode. */
    public get leftMostSubNode(): Node<K, V> {
        let result: Node<K, V> = this;
        while (undefined !== result.left) {
            result = result.left;
        }
        return result;
    }

    public balance(): Node<K, V> {
        const balanceFactor = this.balanceFactor;
        if (balanceFactor < -1) {
            if (undefined !== this.left && this.left.balanceFactor > 0) {
                // left right case
                this.left = this.left.rotateLeft();
                return this.rotateRight();
            } else {
                // left left case:
                return this.rotateRight();
            }
        } else if (balanceFactor > 1) {
            if (undefined !== this.right && this.right.balanceFactor < 0) {
                // right left case:
                this.right = this.right.rotateRight();
                return this.rotateLeft();
            } else {
                // right right case:
                return this.rotateLeft();
            }
        }

        return this;
    }

    public locate(
        comparator: (a: K, b: K) => number,
        key: K
    ): Node<K, V> | undefined {
        const cmp = comparator(key, this.key);
        if (cmp < 0) {
            if (undefined !== this.left) {
                return this.left.locate(comparator, key);
            } else {
                return undefined;
            }
        } else if (cmp > 0) {
            if (undefined !== this.right) {
                return this.right.locate(comparator, key);
            } else {
                return undefined;
            }
        } else {
            return this;
        }
    }

    /**
     * @returns The node at which the key now exists.
     * @param comparator
     * @param key
     * @param newKey
     */
    public locateOrInsert(
        comparator: (a: K, b: K) => number,
        key: K,
        newValue: V | (() => V),
        onLocate: (location: Node<K, V>) => void = doNothing,
        onInsert: (location: Node<K, V>) => void = doNothing
    ): Node<K, V> | undefined {
        const cmp = comparator(key, this.key);
        if (cmp < 0) {
            if (undefined === this.left) {
                this.left = new Node(key, resultOf(newValue));
                onInsert(this.left);
                return this;
            } else {
                this.left = this.left.locateOrInsert(
                    comparator,
                    key,
                    newValue,
                    onLocate,
                    onInsert
                );
                return this.balance();
            }
        } else if (cmp > 0) {
            if (undefined === this.right) {
                this.right = new Node(key, resultOf(newValue));
                onInsert(this.right);
                return this;
            } else {
                this.right = this.right.locateOrInsert(
                    comparator,
                    key,
                    newValue,
                    onLocate,
                    onInsert
                );
                return this.balance();
            }
        } else {
            onLocate(this);
            return this;
        }
    }

    /**
     * @returns The {@link Node} that replaces this one.
     */
    public removeLargest(
        getRemovedNode: (node: Node<K, V>) => void = doNothing
    ): Node<K, V> | undefined {
        if (this.right === undefined) {
            getRemovedNode(this);
            return this.left;
        } else {
            this.right = this.right.removeLargest(getRemovedNode);
            return this.balance();
        }
    }
    /**
     * @returns The {@link Node} that replaces this one.
     */
    public removeSmallest(
        getRemovedNode: (node: Node<K, V>) => void = doNothing
    ): Node<K, V> | undefined {
        if (this.left === undefined) {
            getRemovedNode(this);
            return this.right;
        } else {
            this.left = this.left.removeSmallest(getRemovedNode);
            return this.balance();
        }
    }

    /**
     * @returns The replacement for this node
     */
    public remove(
        comparator: (a: K, b: K) => number,
        key: K,
        getRemovedNode: (removed: Node<K, V>) => void = () => {}
    ): Node<K, V> | undefined {
        const cmp = comparator(key, this.key);
        if (cmp < 0) {
            if (undefined === this.left) return this;
            this.left = this.left.remove(comparator, key, getRemovedNode);
            return this.balance();
        } else if (cmp > 0) {
            if (undefined === this.right) return this;
            this.right = this.right.remove(comparator, key, getRemovedNode);
            return this.balance();
        } else {
            getRemovedNode(this);
            if (undefined === this.left) {
                if (undefined === this.right) {
                    // no successors
                    return undefined;
                } else {
                    // right successor
                    return this.right;
                }
            } else if (undefined === this.right) {
                // left successor
                return this.left;
            } else {
                // two possible successors
                const successor = this.right.leftMostSubNode;
                successor._left = this.left;
                successor._right = this.right.remove(comparator, successor.key);
                successor.update();
                return successor.balance();
            }
        }
    }
}
