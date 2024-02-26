import { requireSafeInteger } from "../checks";
import { Writable } from "../types/object";
import Collection from "./Collection";

/** A {@link LinkedList } node containing an element. */
export interface LinkedListNode<T> {
    /** The following {@link LinkedListNode}. */
    readonly next?: LinkedListNode<T>;
    /** The preceding {@link LinkedListNode}. */
    readonly previous?: LinkedListNode<T>;
    /** This {@link LinkedListNode}'s value. */
    readonly value: T;
}

/** private, writable node type */
interface Node<T> extends Writable<LinkedListNode<T>> {
    next?: Node<T>;
    previous?: Node<T>;
    /** The {@link LinkedList} that this {@link LinkedListNode} belongs to. */
    linkedList?: LinkedList<T>;
}

/**
 * Double linked list.
 */
export default class LinkedList<T> extends Collection<T> {
    private _head?: Node<T>;
    private _tail?: Node<T>;
    private _size: number = 0;

    constructor(values?: Iterable<T>) {
        super();
        if (values !== undefined) {
            for (const value of values) {
                this.push(value);
            }
        }
    }

    public static of<T>(...values: T[]): LinkedList<T> {
        return new LinkedList(values);
    }

    /** The node at index 0. The first node. */
    public get head(): LinkedListNode<T> | undefined {
        return this._head;
    }

    /** The final node. */
    public get tail(): LinkedListNode<T> | undefined {
        return this._tail;
    }

    public get size(): number {
        return this._size;
    }

    private set size(value: number) {
        this._size = value;
    }

    public *[Symbol.iterator](): Iterator<T> {
        for (const node of this.nodes()) {
            yield node.value;
        }
    }

    public nodes(): Iterable<LinkedListNode<T>> {
        const self = this;
        return {
            *[Symbol.iterator]() {
                let current = self.head;
                while (current !== undefined) {
                    const next = current.next;
                    yield current;
                    current = next;
                }
            },
        };
    }

    /**
     * Finds the node at the given index in O(index) time.
     * @param index The index of the node to get. Negative indexes refer to the {@link tail} node and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     * @returns The node at the given index or undefined if the index is out of bounds.
     */
    public nodeAt(index: number): LinkedListNode<T> | undefined {
        requireSafeInteger(index);
        if (Collection.signedIndexInBounds(this.size, index)) {
            index = Collection.loopSignedIndex(this.size, index);

            if (index < Math.trunc(this.size / 2)) {
                let current = this.head!;
                for (let i = 0; i < index; i++) {
                    current = current.next!;
                }
                return current;
            } else {
                let current = this.tail!;
                for (let i = this.size - 1; i > index; i--) {
                    current = current.previous!;
                }
                return current;
            }
        } else {
            return undefined;
        }
    }

    /**
     * Finds the element at the given index in O(index) time.
     * @param index The index of the element to get. Negative indexes refer to the {@link tail} element and count backwards: -1 refers to the final element, -2 refers to the second to final element, etc.
     * @returns The element at the given index or undefined if the index is out of bounds.
     */
    public at(index: number): T | undefined {
        return this.nodeAt(index)?.value;
    }

    /**
     * @returns An {@link Iterable} over the {@link LinkedList}'s elements in reverse order.
     */
    public reversed(): Iterable<T> {
        const self = this;
        return {
            *[Symbol.iterator]() {
                let current = self.tail;

                while (current !== undefined) {
                    yield current.value;
                    current = current.previous;
                }
            },
        };
    }

    /**
     * @returns A shallow copy of the {@link LinkedList}.
     */
    public clone(): LinkedList<T> {
        // possible to make this slightly more efficient?
        // you know what they say about pre-optimization though
        const clone = new LinkedList<T>();

        for (const value of this) {
            clone.push(value);
        }

        return clone;
    }

    /** Reverses the {@link LinkedList}'s elements. */
    public reverse(): void {
        if (this.size <= 1) return;

        let current = this._head;
        this._tail = current;

        while (current !== undefined) {
            const next = current.next;

            if (current.previous === undefined) {
                delete current.next;
            } else {
                current.next = current.previous;
            }

            if (next === undefined) {
                // was final node, now first node
                this._head = current;
                delete current.previous;
            } else {
                current.previous = next;
            }

            current = next;
        }
    }

    public final() {
        return this.tail?.value;
    }

    /**
     * Inserts the value in front of the {@link tail} node, making it the new {@link tail} node.
     *
     * @returns The {@link LinkedListNode} that was inserted.
     */
    public push(value: T): LinkedListNode<T> {
        const newNode: Node<T> = { value, linkedList: this };
        if (this.isEmpty) {
            this._head = newNode;
            this._tail = newNode;
        } else {
            this._tail!.next = newNode;
            newNode.previous = this._tail!;
            this._tail = newNode;
        }

        this.size++;

        return newNode;
    }

    /**
     * Inserts the value behind the {@link head} node, making it the new {@link head} node.
     *
     * @returns The {@link LinkedListNode} that was inserted.
     */
    public unshift(value: T): LinkedListNode<T> {
        const newNode: Node<T> = { value, linkedList: this };
        if (this.isEmpty) {
            this._head = newNode;
            this._tail = newNode;
        } else {
            this._head!.previous = newNode;
            newNode.next = this._head!;
            this._head = newNode;
        }

        this.size++;

        return newNode;
    }

    /**
     * Removes the {@link tail} node and returns it.
     *
     * @returns The former {@link tail} or undefined if the {@link LinkedList} is empty.
     */
    public popNode(): LinkedListNode<T> | undefined {
        if (this.isEmpty) return undefined;

        const node = this._tail!;
        if (this.size === 1) {
            delete this._head;
            delete this._tail;
        } else {
            this._tail = node.previous!;
            delete this._tail.next;
        }

        delete node.next;
        delete node.previous;
        delete node.linkedList;

        this.size--;

        return node;
    }

    /**
     * Removes the {@link tail} node and returns its value.
     *
     * @returns The former {@link tail}'s value or undefined if the {@link LinkedList} is empty.
     */
    public pop(): T | undefined {
        return this.popNode()?.value;
    }

    /**
     * Removes the {@link head} node and returns it.
     *
     * @returns The former {@link head} or undefined if the {@link LinkedList} is empty.
     */
    public shiftNode(): LinkedListNode<T> | undefined {
        if (this.isEmpty) return undefined;

        const node = this._head!;
        if (this.size === 1) {
            delete this._head;
            delete this._tail;
        } else {
            this._head = node.next!;
            delete this._head.previous;
        }

        delete node.next;
        delete node.previous;
        delete node.linkedList;

        this.size--;

        return node;
    }

    /**
     * Removes the {@link head} node and returns its value.
     *
     * @returns The former {@link head}'s value or undefined if the {@link LinkedList} is empty.
     */
    public shift(): T | undefined {
        return this.shiftNode()?.value;
    }

    /**
     * Inserts the given value before or after the given node.
     *
     * @param orientation Whether to insert the value before or after the given node or index.
     * @param node The node to insert the value next to or the index of the node. Time complexity is O(index) if given an index.
     * @param value The value to insert.
     *
     * @returns The inserted {@link LinkedListNode} or undefined if the given node or index isn't in the {@link LinkedList}.
     */
    public insert(
        orientation: "before" | "after",
        node: LinkedListNode<T> | number,
        value: T
    ): LinkedListNode<T> | undefined {
        if (typeof node === "number") {
            let nodeAtIndex = this.nodeAt(node);
            if (nodeAtIndex === undefined) return undefined;
            return this.insert(orientation, nodeAtIndex, value);
        }

        let _node: Node<T> = node;
        if (_node.linkedList !== this) return undefined;

        if (orientation === "before") {
            // if first node, unshift
            if (_node === this._head) {
                return this.unshift(value);
            }
            const newNode: Node<T> = { value, linkedList: this, next: _node };

            if (_node.previous !== undefined) {
                // if existing node already have a node before it, switch links to connect new node to it so that it is before new node
                newNode.previous = _node.previous;
                _node.previous.next = newNode;
            }

            // set new node to go before existing node
            _node.previous = newNode;

            this.size++;

            return newNode;
        } else {
            // if last node, push
            if (_node === this._tail) {
                return this.push(value);
            }
            const newNode: Node<T> = {
                value,
                linkedList: this,
                previous: _node,
            };

            if (_node.next !== undefined) {
                // if existing node already have a node after it, switch links to connect new node to it so that it is after new node
                newNode.next = _node.next;
                _node.next.previous = newNode;
            }

            // set new node to go after existing node
            _node.next = newNode;

            this.size++;

            return newNode;
        }
    }

    /**
     * Sets the value on the given node.
     *
     * @param node The node to set the value of or the index of the node. Time complexity is O(index) if given an index.
     * @param value The value.
     *
     * @returns Whether the value was set.
     */
    public set(node: LinkedListNode<T> | number, value: T): boolean {
        if (typeof node === "number") {
            const nodeAtIndex = this.nodeAt(node);
            if (nodeAtIndex === undefined) return false;
            return this.set(nodeAtIndex, value);
        }

        const _node = node as Node<T>;
        if (_node.linkedList !== this) return false;

        _node.value = value;
        return true;
    }

    /**
     * Removes the given {@link LinkedListNode} from the {@link LinkedList} and returns its value.
     * @param node The node to delete or the index of the node. Time complexity is O(index) if given an index.
     * @returns The removed element or undefined if the given node or index wasn't in the {@link LinkedList }.
     */
    public delete(node: LinkedListNode<T> | number): T | undefined {
        // handle index
        if (typeof node === "number") {
            const nodeAtIndex = this.nodeAt(node);
            if (nodeAtIndex === undefined) return undefined;
            return this.delete(nodeAtIndex);
        }

        // cast to private Node class
        let _node: Node<T> = node;
        // does the node belong to this list?
        if (_node.linkedList !== this) return undefined;

        if (this.size === 1) {
            // only one node in list
            // node is both head and tail. remove both
            delete this._head;
            delete this._tail;
        } else if (_node === this._head) {
            // node is head. remove head and replace it with next
            // remove previous node from next node
            delete _node.next!.previous;
            this._head = _node.next!;
        } else if (_node === this._tail) {
            // node is tail. remove tail and replace with previous
            // remove next node from previous node
            delete _node.previous!.next;
            this._tail = _node.previous!;
        } else {
            // node is middle of list somewhere
            // set links from previous and next nodes to reach "over" the node
            _node.previous!.next = _node.next;
            _node.next!.previous = _node.previous;
        }

        // emancipate the deleted node, cut all ties to the list
        delete _node.next;
        delete _node.previous;
        delete _node.linkedList;

        // decrement size because one node gone now
        this.size--;

        // return deleted value
        return _node.value;
    }

    /**
     * Deletes all elements from the {@link LinkedList}.
     */
    public clear(): void {
        let current = this._head;
        while (current !== undefined) {
            const next = current.next;
            delete current.next;
            delete current.previous;
            delete current.linkedList;
            current = next;
        }

        delete this._head;
        delete this._tail;
        this.size = 0;
    }
}
