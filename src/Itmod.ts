import AsyncItmod from "./AsyncItmod";
import {
    requireGreaterThanZero,
    requireIntegerOrInfinity,
    requireNonNegative,
    requireSafeInteger,
    requireSafeIntegerOrInfinity,
} from "./checks";
import CircularBuffer from "./collections/CircularBuffer";
import Collection from "./collections/Collection";
import LinkedList from "./collections/LinkedList";
import SortedSequence from "./collections/SortedSequence";
import { asArray, asIterable, asSet } from "./collections/as";
import {
    isArray,
    isArrayAsWritable,
    isIterable,
    isSet,
    isSetAsWritable,
} from "./collections/is";
import {
    cachingIterable,
    emptyIterable,
    nonIteratedCountOrUndefined,
    wrapIterator,
} from "./collections/iterables";
import { toArray, toArrayReversed, toSet } from "./collections/to";
import { identity, resultOf, returns } from "./functional/functions";
import { BreakSignal, breakSignal } from "./signals";
import {
    Comparator,
    FieldSelector,
    Order,
    asComparator,
    autoComparator,
    cmpGE,
    cmpLT,
    cmpNQ,
    reverseOrder,
} from "./sorting";
import MapEntryLike from "./types/MapEntryLike";
import { ReturnTypes } from "./types/functions";

// I stumbled upon a video from the early 2000's: https://www.youtube.com/watch?v=fG8GgqfYZkw&t=1615s
// It's Anders Hejlsberg, creator of C# and Typescript, demoing LINQ, which at the time, was a radical idea in mainstream programming.
// The video is very in-formal and almost "cozy". It exudes the feeling of a smart guy showing off something cool they built.
// To me, LINQ is a piece of unassuming software that hides a deep complexity, which is what I wanted to mimic here.
// On the surface, LINQ is a collection of query function like map (called Select in LINQ) or filter (Where),
// and you'd be forgiven for thinking that was all there is to it. But just imagine the possible optimizations
// behind the scenes. When you use Contains to check if some IEnumerable contains some value, is it actually
// enumerating the whole thing, or does the particular data structure have it's own way of checking,
// with a better time complexity? It's up to the technology to decide, you just tell it what you want.

// That's the complexity I wanted to have in Itmod. You tell it what you want, and it tries its best to accomplish that as efficiently as it can.
// If you run: from(foo).sort().toArray(), Itmod will copy the contents of foo into an array, sort it, and return it.
// It's smart enough not to create another array in the toArray function, because it knows that sort returns an array,
// which is safe to modify and give away, so it doesn't need to copy that array into a new one, it can just return it.

// That is "what this is for." Because that is fun. I find it fun. It's fun to write software that is smart.
// It's fun to write software that is complex. It's fun to create the pit of success, and allow the potential user to
// accidentally do the best thing.

// TODO make ALL methods for every class in this entire library use accessors to bind "this" for FUNCTIONAL programming and more predictable behavior.
// TODO unit tests

// TODO takeSparse, skipSparse, partition by count

// TODO? RangeItmod for efficient take, takeFinal, skip, skipFinal, takeEveryNth operations. Result of Itmod.range()
// TODO? SubListItmod for take and skip to array from array

// TODO remove all uses of any, unless absolutely necessary

// TODO multistream map function
// TODO general purpose multi streaming

// design note: the purpose of every method being an accessor (get) is to bind "this" on each method without making them fields and making every instance of Itmod take loads of memory just to exist.

// #1 rule of optimizations: you can cheat as long as you don't get caught!

/**
 * Information about an {@link Itmod} and its Iterable.
 */
export type ItmodProperties<_> = Readonly<
    Partial<{
        /**
         * Each call to the source getter produces a new copy of the source.
         * This means that the source can be modified safely, assuming it is a
         * mutable collection like {@link Array}.
         */
        fresh: boolean;
        /**
         * Calling the source getter is expensive, ie. it's more than an O(1) operation.
         * *OR* The source getter has side effects or the output changes if it's called more than once.
         */
        expensiveOrNonPure: boolean;
    }>
>;

/**
 * Functional wrapper for {@link Iterable}. Provides transformation functions such as {@link Itmod.map}, {@link Itmod.filter}, {@link Itmod.reduce}, and {@link Itmod.fold};
 */
export default class Itmod<T> implements Iterable<T> {
    /**
     * @returns The {@link Iterable} source.
     */
    public readonly getSource: () => Iterable<T>;
    public readonly properties: ItmodProperties<T>;

    /**
     * @returns The {@link Iterator}.
     */
    public get [Symbol.iterator]() {
        const self = this;
        return function iterator(): Iterator<T> {
            return self.getSource()[Symbol.iterator]();
        };
    }

    public constructor(
        properties: ItmodProperties<T>,
        getSource: () => Iterable<T>
    ) {
        this.properties = properties;
        this.getSource = getSource;
    }

    /**
     * @returns An {@link Itmod} over the given source or the result of the given function.
     *
     * Use {@link Itmod.fromIterator} for {@link Iterator}s.
     */
    public static from<T>(
        source: Iterable<T> | (() => Iterable<T>),
        properties?: ItmodProperties<T>
    ): Itmod<T> {
        if (source instanceof Function) {
            return new Itmod(
                { expensiveOrNonPure: true, ...properties },
                source
            );
        } else if (source instanceof Itmod && properties === undefined) {
            return source;
        } else {
            return new Itmod({ ...properties }, returns(source));
        }
    }

    /**
     * @returns An {@link Itmod} over the given iterator or the iterator returned by the given function.
     *
     * Use {@link Itmod.from} for {@link Iterable}s.
     *
     * This function will continue an IterableIterator instead of invoking its `[Symbol.iterator]` method which, in the case of generators, will only produce a non-empty iterator once. This allows the partial iteration of an iterator, which can then be continued by another call to {@link Itmod.fromIterator}.
     */
    public static fromIterator<T>(
        source: Iterator<T> | (() => Iterator<T>),
        properties: ItmodProperties<T> = {}
    ): Itmod<T> {
        if (source instanceof Function) {
            return new Itmod({ expensiveOrNonPure: true, ...properties }, () =>
                wrapIterator(source())
            );
        } else {
            return new Itmod({ ...properties }, returns(wrapIterator(source)));
        }
    }

    /**
     * @returns An {@link Itmod} over the given items.
     */
    public static of<T = never>(...items: readonly T[]): Itmod<T> {
        return new Itmod({}, () => items);
    }

    /**
     * @returns An empty {@link Itmod} of the given type.
     */
    public static empty<T = never>(): Itmod<T> {
        return _emptyItmod;
    }

    // TODO improve type. I'm going to bed
    /**
     * @returns An Itmod over the entries of the given object.
     */
    public static fromObject<
        K extends keyof any,
        V,
        IncludeStringKeys extends boolean | undefined,
        IncludeSymbolKeys extends boolean | undefined
    >(
        object: Record<K, V> | (() => Record<K, V>),
        {
            includeStringKeys = true,
            includeSymbolKeys = true,
            includeNonEnumerable = false,
        }: {
            /**
             * Whether to include fields indexed by symbols.
             * @default true
             */
            includeSymbolKeys?: IncludeSymbolKeys;
            /**
             * Whether to include fields indexed by strings. Defaults to true.
             * @default true
             */
            includeStringKeys?: IncludeStringKeys;
            /**
             * Whether to include object fields not marked as enumerable.
             * @default false
             */
            includeNonEnumerable?: boolean;
        } = {}
    ): Itmod<
        [
            (K extends number ? string : K) &
                (
                    | (IncludeStringKeys extends false ? never : string)
                    | (IncludeSymbolKeys extends false ? never : symbol)
                ),
            V
        ]
    > {
        return new Itmod(
            { expensiveOrNonPure: object instanceof Function },
            () => {
                const instance = resultOf(object);

                return Itmod.empty()
                    .if(includeStringKeys, (self) =>
                        self.concat(Object.getOwnPropertyNames(instance))
                    )
                    .if(includeSymbolKeys, (self) =>
                        self.concat(Object.getOwnPropertySymbols(instance))
                    )
                    .map(
                        (key) =>
                            [
                                key,
                                Object.getOwnPropertyDescriptor(instance, key)!,
                            ] as const
                    )
                    .if(!includeNonEnumerable, (self) =>
                        self.filter(
                            ([_, descriptor]) => !!descriptor?.enumerable
                        )
                    )
                    .map(([key, descriptor]) => [key, descriptor.value]) as any;
            }
        );
    }

    // TODO docs
    // prettier-ignore
    public static generate<T>(count: bigint, generator: (index: bigint) => T): Itmod<T>;
    // prettier-ignore
    public static generate<T>(count: number, generator: (index: number) => T): Itmod<T>;
    public static generate<T>(count: number | bigint, item: T): Itmod<T>;
    public static generate<T>(
        count: number | bigint,
        generatorOrItem: ((index: number | bigint) => T) | T
    ): Itmod<T> {
        requireNonNegative(requireIntegerOrInfinity(count));

        if (generatorOrItem === identity) {
            return Itmod.range(count) as unknown as Itmod<T>;
        }

        if (generatorOrItem instanceof Function) {
            return new Itmod({}, function* () {
                let i = zeroLike(count);
                for (; i < count; i++) {
                    yield generatorOrItem(i);
                }
            });
        } else {
            let i = zeroLike(count);
            return new Itmod({}, function* () {
                for (; i < count; i++) {
                    yield generatorOrItem;
                }
            });
        }
    }

    /**
     * Applies the given body function to the itmod, returning the result if the condition is true. Otherwise, the given else_ function is applied and the result of that is returned instead. else_ defaults to identity, which will do nothing and return the itmod unchanged.
     * @param body What to do if the condition is true.
     * @param else_ what to do if the condition is false. Defaults to {@link identity}.
     */
    public get if(): <R, E = this>(
        condition: boolean,
        body: (self: this) => R,
        else_?: (self: this) => E
    ) => R | E {
        const self = this;
        return function if_<R, E = Itmod<T>>(
            condition: boolean,
            body: (self: Itmod<T>) => R,
            else_: (self: Itmod<T>) => E | Itmod<T> = identity
        ): R | E | Itmod<T> {
            if (condition) {
                return body(self);
            } else {
                return else_(self);
            }
        } as any;
    }

    /**
     * Calls the given function with the itmod as the argument.
     */
    public get applyTo(): <R>(body: (self: this) => R) => R {
        const self = this;
        return function applyTo<R>(body: (itmod: Itmod<T>) => R) {
            return body(self);
        } as any;
    }

    /**
     * Replaces the items in the Itmod with the given alternative (or its result if it's a function), when the Itmod is empty and has no items.
     */
    public get replaceEmptyWith() {
        const self = this;
        return function whenEmpty(
            alternative:
                | Iterable<T>
                | Iterator<T>
                | (() => Iterable<T>)
                | (() => Iterator<T>)
        ) {
            return new Itmod(self.properties, () => {
                const source = self.getSource();
                const count = nonIteratedCountOrUndefined(source);
                if (count !== undefined) {
                    if (count === 0) {
                        return asIterable(resultOf(alternative));
                    } else {
                        return source;
                    }
                }

                return (function* () {
                    let empty = true;

                    for (const item of source) {
                        yield item;
                        empty = false;
                    }

                    if (empty) {
                        yield* asIterable(resultOf(alternative));
                    }
                })();
            });
        };
    }

    public static get range(): {
        /**
         * @returns An {@link Itmod} over a range of integers from start to end, incremented by step.
         * @param start The first number in the sequence.
         * @param end Where the range ends (exclusive).
         * @param step How much larger each number in the sequence is from the previous number.
         */
        (start: bigint, end: bigint, step: bigint): Itmod<bigint>;
        /**
         * @returns An {@link Itmod} over a range of integers from start to end, incremented by 1 or -1 if end is less than start.
         * @param start The first number in the sequence.
         * @param end Where the range ends (exclusive).
         */
        (start: bigint, end: bigint): Itmod<bigint>;
        /**
         * @returns An {@link Itmod} over a range of integers from 0 to end, incremented by 1.
         * @param end Where the range ends (exclusive).
         */
        (end: bigint): Itmod<bigint>;

        /**
         * @returns An {@link Itmod} over a range of numbers from start to end, incremented by step.
         * @param start The first number in the sequence.
         * @param end Where the range ends (exclusive).
         * @param step How much larger each number in the sequence is from the previous number.
         */
        (
            start: number | bigint,
            end: number | bigint,
            step: number | bigint
        ): Itmod<number>;
        /**
         * @returns An {@link Itmod} over a range of numbers from start to end, incremented by 1 or -1 if end is less than start.
         * @param start The first number in the sequence.
         * @param end Where the range ends (exclusive).
         */
        (start: number | bigint, end: number | bigint): Itmod<number>;
        /**
         * @returns An {@link Itmod} over a range of numbers from 0 to end, incremented by 1.
         * @param end Where the range ends (exclusive).
         */
        (end: number | bigint): Itmod<number>;
    } {
        return function range(
            _startOrEnd: number | bigint,
            _end?: number | bigint,
            _step?: number | bigint
        ): Itmod<number> | Itmod<bigint> {
            const useNumber =
                typeof _startOrEnd === "number" ||
                typeof _end === "number" ||
                typeof _step === "number";

            const ZERO = useNumber ? 0 : (0n as any);
            const ONE = useNumber ? 1 : (1n as any);

            let start: any;
            let end: any;
            let step: any;
            if (_step !== undefined) {
                start = _startOrEnd;
                end = _end;
                step = _step;
            } else if (_end !== undefined) {
                start = _startOrEnd;
                end = _end;
                step = ONE;
            } else {
                start = ZERO;
                end = _startOrEnd;
                step = ONE;
            }

            if (useNumber) {
                start = Number(start);
                end = Number(end);
                step = Number(step);
            }

            if (step === ZERO) throw new Error("arg3 must not be zero");

            if (step < ZERO && start < end) return Itmod.empty<any>();
            if (step > ZERO && start > end) return Itmod.empty<any>();

            const test =
                step > ZERO ? (i: any) => i < end : (i: any) => i > end;

            return new Itmod({}, function* () {
                for (let i = start; test(i); i += step) yield i;
            });
        } as any;
    }

    /**
     * Calls the action on each item in the {@link Itmod} in order, one at a time. Stops if the action returns {@link breakSignal}.
     * @param action The action. Return {@link breakSignal} to stop the loop.
     * @returns void or {@link breakSignal} if {@link breakSignal} was returned by the action.
     */
    public get forEach() {
        const self = this;
        return function forEach(
            action: (value: T, index: number) => any | BreakSignal
        ) {
            let i = 0;
            for (const value of self) {
                if (action(value, i) === breakSignal) break;
                i++;
            }
        };
    }

    /**
     * Maps each item in the stream to a new item using the given mapping function.
     */
    public get map() {
        const self = this;
        return function map<R>(
            mapping: (value: T, index: number) => R
        ): Itmod<R> {
            if (mapping === identity) {
                return self as unknown as Itmod<R>;
            } else {
                return new MappedItmod(self, mapping);
            }
        };
    }

    /**
     * Concatenates all of the sub-iterables together into the result.
     */
    public get flat() {
        const self = this;
        // TODO depth parameter, after they add math to typescript number and bigint: https://github.com/microsoft/TypeScript/issues/26382
        return function flat(): Itmod<
            T extends Iterable<infer SubT> ? SubT : T
        > {
            return new Itmod({}, function* () {
                for (const item of self) {
                    if (isIterable(item)) {
                        yield* item;
                    } else {
                        yield item;
                    }
                }
            }) as Itmod<any>;
        };
    }

    /**
     * Filters out items that don't pass the test.
     * @param Test for each item. Items that make this function return true are kept. The rest are skipped.
     */
    public get filter() {
        const self = this;
        return function filter(
            test: (value: T, index: number) => boolean
        ): Itmod<T> {
            return new FilteredItmod(self, test);
        };
    }

    /**
     * Filters out undefined.
     */
    public get defined() {
        const self = this;
        return function defined(): Itmod<T extends undefined ? never : T> {
            return self.filter((item) => item !== undefined) as Itmod<any>;
        };
    }

    /**
     * Filters out null.
     */
    public get notNull() {
        const self = this;
        return function notNull(): Itmod<T extends null ? never : T> {
            return self.filter((item) => item !== null) as Itmod<any>;
        };
    }

    /**
     * Filters out null and undefined.
     */
    public get notNullish() {
        const self = this;
        return function notNullish(): Itmod<
            T extends null ? never : T extends undefined ? never : T
        > {
            return self.filter(
                (item) => item !== null && item !== undefined
            ) as Itmod<any>;
        };
    }

    /**
     * Combines the items with the items from the given iterable by interleaving them.
     */
    public get zip() {
        const self = this;
        return function zip<O>(
            other: Iterable<O>,
            {
                loose = false,
            }: {
                /**
                 * Whether to include any remaining element if the Itmod and the Iterable are not the same length.
                 * @default false
                 */
                loose?: boolean;
            } = {}
        ): Itmod<T | O> {
            return new Itmod({}, function* () {
                const iterator = self[Symbol.iterator]();
                const iteratorOther = other[Symbol.iterator]();
                let next = iterator.next();
                let nextOther = iteratorOther.next();

                while (!(next.done || nextOther.done)) {
                    yield next.value;
                    yield nextOther.value;

                    next = iterator.next();
                    nextOther = iteratorOther.next();
                }

                if (loose) {
                    while (!next.done) {
                        yield next.value;
                        next = iterator.next();
                    }

                    while (!nextOther.done) {
                        yield nextOther.value;
                        nextOther = iteratorOther.next();
                    }
                }
            });
        };
    }

    public get reduce(): {
        // using General<T>, caused more problems than it solved ):
        // /**
        //  * Combines all the items into one using the given reduction function.
        //  * @param reduction Combines each item with the accumulating result, starting with the first two items.
        //  * @returns The final result of the reduction, unless the Itmod was empty, then undefined is returned.
        //  */
        // <R = General<T>>(
        //     reduction: (
        //         /** The accumulating result. Equal to the returned value from the previous item. */
        //         accumulator: R | T,
        //         /** The current value to add onto the result. */
        //         value: T,
        //         /** The index of the current value. */
        //         index: number
        //     ) => R
        // ): R | undefined;
        // /**
        //  * Combines all the items into one using the given reduction function.
        //  * @param reduction Combines each item with the accumulating result, starting with the first two items.
        //  * @param finalizer Called after the result is collected to perform any final modifications. Not called if the Itmod was empty.
        //  * @returns The result of the finalizer unless the Itmod was empty, then undefined is returned.
        //  */
        // <F, R = General<T>>(
        //     reduction: (
        //         /** The accumulating result. Equal to the returned value from the previous item. */
        //         accumulator: R | T,
        //         /** The current value to add onto the result. */
        //         value: T,
        //         /** The index of the current value. */
        //         index: number
        //     ) => R,
        //     finalize: (
        //         /** The final result of the reduction. */
        //         result: R,
        //         /** How many items were in the {@link Iterable}. */
        //         count: number
        //     ) => F
        // ): F | undefined;

        /**
         * Combines all the items into one using the given reduction function.
         * @param reduction Combines each item with the accumulating result, starting with the first two items.
         * @returns The final result of the reduction, unless the Itmod was empty, then undefined is returned.
         */
        <R = T>(
            reduction: (
                /** The accumulating result. Equal to the returned value from the previous item. */
                accumulator: R | T,
                /** The current value to add onto the result. */
                value: T,
                /** The index of the current value. */
                index: number
            ) => R
        ): R | undefined;
        /**
         * Combines all the items into one using the given reduction function.
         * @param reduction Combines each item with the accumulating result, starting with the first two items.
         * @param finalizer Called after the result is collected to perform any final modifications. Not called if the Itmod was empty.
         * @returns The result of the finalizer unless the Itmod was empty, then undefined is returned.
         */
        <F, R = T>(
            reduction: (
                /** The accumulating result. Equal to the returned value from the previous item. */
                accumulator: R | T,
                /** The current value to add onto the result. */
                value: T,
                /** The index of the current value. */
                index: number
            ) => R,
            finalize: (
                /** The final result of the reduction. */
                result: R,
                /** How many items were in the {@link Iterable}. */
                count: number
            ) => F
        ): F | undefined;
    } {
        const self = this;
        return function reduce(
            reduction: (accumulator: any, value: T, index: number) => any,
            finalize: (result: any, count: number) => any = identity
        ): any {
            const source = self.getSource();
            const iterator = source[Symbol.iterator]();

            let next = iterator.next();
            if (next.done) {
                return undefined;
            }

            let accumulator = next.value;
            let i = 1;
            while (!(next = iterator.next()).done) {
                accumulator = reduction(accumulator, next.value, i);
                i++;
            }
            const count = i;

            return finalize(accumulator, count);
        };
    }

    public get fold(): {
        /**
         * Combines all the items into one using the given reduction function and initial value.
         * @param reduction Combines each item with the accumulating result, starting with the initial value and the first item.
         */
        <R>(
            initialValue: R,
            reduction: (accumulator: R, value: T, index: number) => R
        ): R;
        /**
         * Combines all the items into one using the given reduction function and initial value.
         * @param reduction Combines each item with the accumulating result, starting with the initial value and the first item.
         * @param finalizer Called after the result is collected to perform any final modifications.
         */
        <R, F>(
            initialValue: R,
            reduction: (accumulator: R, value: T, index: number) => R,
            finalize: (result: R, count: number) => F
        ): F;
    } {
        const self = this;
        return function fold(
            initialValue: any,
            reduction: (accumulator: any, value: T, index: number) => any,
            finalize: (result: any, count: number) => any = identity
        ) {
            const source = self.getSource();

            let accumulator = initialValue;
            let i = 0;
            for (const item of source) {
                accumulator = reduction(accumulator, item, i);
                i++;
            }
            const count = i;

            return finalize(accumulator, count);
        };
    }

    /**
     * Concatenates the given {@link Iterable} onto the end of the {@link Itmod}.
     */
    public get concat() {
        const self = this;
        return function concat<O>(other: Iterable<O>): Itmod<T | O> {
            return new Itmod({}, function* () {
                yield* self;
                yield* other;
            });
        };
    }
    /**
     * Concatenates the given {@link Iterable} onto the start of the {@link Itmod}.
     */
    public get preConcat() {
        const self = this;
        return function preConcat<O>(other: Iterable<O>): Itmod<T | O> {
            return new Itmod({}, function* () {
                yield* other;
                yield* self;
            });
        };
    }

    /**
     * Concatenates the given item onto the end of the {@link Itmod}.
     */
    public get append() {
        const self = this;
        return function append<O>(item: O): Itmod<T | O> {
            return new Itmod(self.properties, () => {
                const source = self.getSource();

                // maintain fresh array by pushing onto it
                if (self.properties.fresh && isArrayAsWritable<T | O>(source)) {
                    source.push(item);
                    return source;
                }

                // maintain fresh linked list by pushing onto it
                if (self.properties.fresh && source instanceof LinkedList) {
                    source.push(item);
                    return source;
                }

                return (function* () {
                    yield* source;
                    yield item;
                })();
            });
        };
    }

    /**
     * Concatenates the given item onto the start of the {@link Itmod}.
     */
    public get prepend() {
        const self = this;
        return function prepend<O>(item: O): Itmod<T | O> {
            return new Itmod(self.properties, () => {
                const source = self.getSource();

                // maintain fresh linked list
                if (self.properties.fresh && source instanceof LinkedList) {
                    source.unshift(item);
                    return source;
                }

                return (function* () {
                    yield item;
                    yield* source;
                })();
            });
        };
    }

    /**
     * Reverses the items in the {@link Itmod}.
     */
    public get reverse() {
        const self = this;
        return function reverse(): Itmod<T> {
            return new ReversedItmod(self);
        };
    }

    /**
     * Repeats the items the given number of times.
     * @param times How many times to repeat the items. Negative numbers also reverse the items. 0 returns no items.
     */
    public get repeat() {
        const self = this;
        return function repeat(times: number | bigint): Itmod<T> {
            if (times < 0) {
                return self.reverse().repeat(-times);
            }

            requireIntegerOrInfinity(times);
            if (typeof times === "number") requireSafeInteger(times);
            if (times === 0) return Itmod.empty();

            return new RepeatedItmod(self, times);
        };
    }

    /**
     * @returns The first item or undefined if the source is empty.
     */
    public get first() {
        const self = this;
        return function first(): T | undefined {
            for (const item of self) return item;
            return undefined;
        };
    }

    /**
     * @returns The final item or undefined if the source is empty.
     */
    public get final() {
        const self = this;
        const externalFinal = final;
        return function final(): T | undefined {
            const source = self.getSource();
            return externalFinal(source)?.value;
        };
    }

    public get distinct() {
        const self = this;
        return function distinct(id: (item: T) => any = identity) {
            return new Itmod(self.properties, () => {
                const source = getDeepSource(self);

                if (id === identity && isSet(source)) return source;

                return (function* () {
                    const returned = new Set<any>();
                    for (const item of source) {
                        const itemId = id(item);

                        if (!returned.has(itemId)) {
                            yield item;
                            returned.add(itemId);
                        }
                    }
                })();
            });
        };
    }

    // set operations:

    /**
     * Performs the set operation, union.
     * @returns The items found in this Itmod plus the items in the given iterable, unless they where already in the Itmod.
     */
    public get union(): {
        (
            other: Iterable<T>,
            /** How to identify each item. Defaults to {@link identity}. */
            id?: (item: T) => any
        ): Itmod<T>;
        <O>(
            other: Iterable<O>,
            /** How to identify each item from the itmod. Defaults to {@link identity}. */
            id?: (item: T) => any,
            /** How to identify each item from the given iterable. Defaults to {@link identity} if given undefined. If left blank, defaults to the identity function given to id. */
            otherId?: (item: O) => any
        ): Itmod<T>;
    } {
        const self = this;
        return function union<O>(
            ...args: [
                other: Iterable<O>,
                id?: (item: T | O) => any,
                otherId?: (item: O) => any
            ]
        ): Itmod<T | O> {
            let [
                other,
                id = identity,
                otherId = args.length === 3 ? identity : id,
            ] = args;

            return new Itmod({}, function* () {
                const source = getDeepSource(self.getSource());
                if (id === identity && otherId === identity) {
                    const toAdd = new Set<T | O>(other);
                    for (const item of source) {
                        yield item;
                        toAdd.delete(item);
                    }
                    yield* toAdd;
                } else {
                    const toAdd = from(other).indexBy(otherId).toMap();
                    for (const item of source) {
                        yield item;
                        toAdd.delete(id(item));
                    }
                    yield* toAdd.values();
                }
            });
        };
    }

    /**
     * Performs the set operation, intersection.
     * @returns The items found in both this Itmod and the given iterable.
     */
    public get intersection(): {
        (
            other: Iterable<T>,
            /** How to identify each item. Defaults to {@link identity}. */
            id?: (item: T) => any
        ): Itmod<T>;
        <O>(
            other: Iterable<O>,
            /** How to identify each item from the itmod. Defaults to {@link identity}. */
            id?: (item: T) => any,
            /** How to identify each item from the given iterable. Defaults to {@link identity} if given undefined. If left blank, defaults to the identity function given to id. */
            otherId?: (item: O) => any
        ): Itmod<T>;
    } {
        const self = this;
        return function intersection<O>(
            ...args: [
                other: Iterable<O>,
                id?: (item: T | O) => any,
                otherId?: (item: O) => any
            ]
        ): Itmod<T | O> {
            let [
                other,
                id = identity,
                otherId = args.length === 3 ? identity : id,
            ] = args;

            return new Itmod({}, function* () {
                const source = getDeepSource(self.getSource());
                // incase other is an itmod
                other = getDeepSource(other);

                if (id === identity && otherId === identity) {
                    let set: ReadonlySet<T | O>;
                    let list: Iterable<T | O>;

                    if (isSet(source) && isSet(other)) {
                        if (source.size > other.size) {
                            set = source;
                            list = other;
                        } else {
                            list = source;
                            set = other;
                        }
                    } else if (isSet(other)) {
                        set = other;
                        list = source;
                    } else {
                        set = asSet(source);
                        list = other;
                    }

                    for (const item of list) {
                        if (set.has(item)) yield item;
                    }
                } else {
                    const set = from(other).map(otherId).asSet();
                    for (const item of source) {
                        if (set.has(id(item))) {
                            yield item;
                        }
                    }
                }
            });
        };
    }

    /**
     * Performs the set operation, difference.
     * @returns The items found in this Itmod but not in the given iterable.
     */
    public get difference(): {
        (
            other: Iterable<T>,
            /** How to identify each item. Defaults to {@link identity}. */
            id?: (item: T) => any
        ): Itmod<T>;
        <O>(
            other: Iterable<O>,
            /** How to identify each item from the itmod. Defaults to {@link identity}. */
            id?: (item: T) => any,
            /** How to identify each item from the given iterable. Defaults to {@link identity} if given undefined. If left blank, defaults to the identity function given to id. */
            otherId?: (item: O) => any
        ): Itmod<T>;
    } {
        const self = this;
        return function difference<O>(
            ...args: [
                other: Iterable<O>,
                id?: (item: T | O) => any,
                otherId?: (item: O) => any
            ]
        ): Itmod<T> {
            let [
                other,
                id = identity,
                otherId = args.length === 3 ? identity : id,
            ] = args;

            return new Itmod({}, function* () {
                const source = getDeepSource(self.getSource());
                if (id === identity && otherId === identity) {
                    const set = asSet<T | O>(other);
                    for (const item of source) {
                        if (!set.has(item)) {
                            yield item;
                        }
                    }
                } else {
                    const set = Itmod.from(other).map(otherId).asSet();
                    for (const item of source) {
                        if (!set.has(id(item))) {
                            yield item;
                        }
                    }
                }
            });
        };
    }

    /**
     * Keeps the first given number of items, skipping the rest.
     */
    public get take() {
        const self = this;
        return function take(count: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(count);
            requireNonNegative(count);
            return new Itmod(self.properties, () => {
                const source = self.getSource();

                if (count === Infinity) return source;
                if (isZero(count)) return emptyIterable();

                const size = nonIteratedCountOrUndefined(source);
                if (size !== undefined && size <= count) {
                    return source;
                }

                // optimization for fresh array
                if (self.properties.fresh && isArrayAsWritable(source)) {
                    source.length = Math.min(source.length, Number(count));
                    return source;
                }

                return (function* () {
                    const iterator = source[Symbol.iterator]();
                    for (let i = zeroLike(count); i < count; i++) {
                        const next = iterator.next();
                        if (next.done) break;

                        yield next.value;
                    }
                })();
            });
        };
    }

    /**
     * Takes the final given number of items, skipping the preceding items.
     */
    public get takeFinal() {
        const self = this;
        return function takeFinal(count: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(count);
            requireNonNegative(count);
            return new Itmod({ fresh: true, expensiveOrNonPure: true }, () => {
                const source = self.getSource();
                if (count === Infinity) return source;
                if (isZero(count)) return emptyIterable();

                const sourceSize = nonIteratedCountOrUndefined(source);

                if (sourceSize !== undefined) {
                    return from(source).if(sourceSize > count, (itmod) =>
                        itmod.skip(sourceSize - Number(count))
                    );
                }

                const buffer = new CircularBuffer<T>(Number(count));
                for (const value of source) {
                    buffer.push(value);
                }

                return buffer;
            });
        };
    }

    /**
     * Takes every item who's index is divisible by the given number (including the item at index 0, the first item).
     *
     * For example:
     *
     * `takeEveryNth(2)` would return the items at index 0, 2, 4, 6, 8, etc.
     *
     * `takeEveryNth(4)` would return the items at index 0, 4, 8, 12, etc.
     *
     * `takeEveryNth(1)` would return all items
     *
     * `takeEveryNth(Infinity)` would return no items
     *
     * `takeEveryNth(0)` would throw an error.
     *
     * `takeEveryNth(-1)` would throw an error.
     */
    public get takeEveryNth() {
        const self = this;
        return function takeEveryNth(n: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(n);
            requireGreaterThanZero(n);
            return new Itmod<T>({}, () => {
                const source = self.getSource();
                if (n === Infinity) return emptyIterable();
                if (isOne(n)) return source;

                return (function* () {
                    let i = zeroLike(n);
                    for (const item of source) {
                        i++;
                        if (i >= n) {
                            yield item;
                            i = zeroLike(n);
                        }
                    }
                })();
            });
        };
    }

    /**
     * Takes items as long as the given condition returns true for the item and its index, stopping when the condition returns false, not taking the item that made the condition return false.
     */
    public get takeWhile() {
        const self = this;
        return function takeWhile(
            condition: (item: T, index: number) => boolean
        ): Itmod<T> {
            return new Itmod(self.properties, () => {
                const source = self.getSource();

                // optimization for fresh array
                if (self.properties.fresh && isArrayAsWritable(source)) {
                    let i = 0;
                    for (; i < source.length; i++) {
                        if (!condition(source[i] as T, i)) break;
                    }

                    source.length = i;
                    return source;
                }

                return (function* () {
                    let i = 0;
                    for (const item of source) {
                        if (!condition(item, i)) break;
                        yield item;
                        i++;
                    }
                })();
            });
        };
    }

    /**
     * Takes the given count of items in order at random. The items taken are evenly distributed across the length of the items. Do not attempt on an infinite sequence; this will cause an infinite loop.
     * @param count How many items to take.
     * @param getRandomInt A function that returns a random integer that is greater than or equal to 0 and less than upperBound: 0 <= n < upperBound. Defaults to {@link Math.random}, which is not guarantied to be cryptographically secure.
     */
    public get takeRandom() {
        const self = this;
        return function takeRandom(
            count: number | bigint,
            getRandomInt?: (upperBound: number) => number
        ): Itmod<T> {
            return new TakeRandomItmod(self, count, getRandomInt);
        };
    }

    public get takeAtRandom() {
        const self = this;
        return function takeAtRandom(
            chance: number,
            getRandomFloat: () => number = Math.random
        ) {
            if (getRandomFloat === Math.random) {
                return self.filter(() => getRandomFloat() < chance); // This use of filter breaks the rule that the test function must be pure, so we need to be careful about it.
            } else {
                return new Itmod({}, function* () {
                    for (const item of self) {
                        if (getRandomFloat() < chance) {
                            yield item;
                        }
                    }
                });
            }
        };
    }

    /**
     * Skips the first given number of items, keeping the rest.
     */
    public get skip() {
        const self = this;
        return function skip(count: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(count);
            requireNonNegative(count);
            return new Itmod(self.properties, () => {
                const source = self.getSource();

                if (isZero(count)) return source;
                if (count === Infinity) return emptyIterable();

                const size = nonIteratedCountOrUndefined(source);
                if (size !== undefined && count >= size) return emptyIterable();

                if (isArray(source)) {
                    return (function* () {
                        for (let i = Number(count); i < source.length; i++) {
                            yield source[i] as T;
                        }
                    })();
                } else {
                    return (function* () {
                        const iterator = source[Symbol.iterator]();
                        let next = iterator.next();

                        for (let i = zeroLike(count); i < count; i++) {
                            if (next.done) return;
                            next = iterator.next();
                        }

                        while (!next.done) {
                            yield next.value;
                            next = iterator.next();
                        }
                    })();
                }
            });
        };
    }

    /**
     * Skips the final given number of items, taking the preceding items.
     */
    public get skipFinal() {
        const self = this;
        return function skipFinal(count: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(requireNonNegative(count));
            return new Itmod(self.properties, () => {
                const source = self.getSource();
                if (count === Infinity) return emptyIterable();
                if (isZero(count)) return source;

                const sourceSize = nonIteratedCountOrUndefined(source);
                if (sourceSize !== undefined) {
                    if (sourceSize > count) {
                        return from(source).take(sourceSize - Number(count));
                    } else {
                        return emptyIterable();
                    }
                }

                return (function* () {
                    const buffer = new CircularBuffer<T>(Number(count));

                    for (const item of source) {
                        if (buffer.isFull) yield buffer.at(0) as T;
                        buffer.push(item);
                    }
                })();
            });
        };
    }

    /**
     * Skips every item who's index is divisible by the given number (including the item at index 0, the first item).
     *
     * For example:
     *
     * `skipEveryNth(2)` would return the items at index 1, 3, 5, 7, 9, etc.
     *
     * `skipEveryNth(4)` would return the items at index 1, 2, 3, 5, 6, 7, 9, etc.
     *
     * `skipEveryNth(1)` would return no items
     *
     * `skipEveryNth(Infinity)` would return all items
     *
     * `skipEveryNth(0)` would throw an error.
     *
     * `skipEveryNth(-1)` would throw an error.
     */
    public get skipEveryNth() {
        const self = this;
        return function skipEveryNth(n: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(n);
            requireGreaterThanZero(n);
            return new Itmod<T>(self.properties, () => {
                const source = self.getSource();
                if (n === Infinity) return source;
                if (isOne(n)) return emptyIterable();

                return (function* () {
                    let i = zeroLike(n);
                    for (const item of source) {
                        i++;
                        if (i >= n) {
                            i = zeroLike(n);
                        } else {
                            yield item;
                        }
                    }
                })();
            });
        };
    }

    /**
     * Takes items as long as the given condition returns true for the item and its index, stopping when the condition returns false, not taking the item that made the condition return false.
     */
    public get skipWhile() {
        const self = this;
        return function skipWhile(
            condition: (item: T, index: number) => boolean
        ): Itmod<T> {
            return new Itmod({}, function* () {
                const source = self.getSource();
                const iterator = source[Symbol.iterator]();

                let next = iterator.next();
                let i = 0;
                while (!next.done) {
                    if (!condition(next.value, i)) break;
                    next = iterator.next();
                    i++;
                }

                while (!next.done) {
                    yield next.value;
                    next = iterator.next();
                }
            });
        };
    }

    /**
     * Skips the given count of items at random. The items skipped are evenly distributed across the length of the items. Do not attempt on an infinite sequence; this will cause an infinite loop.
     * @param count How many items to skip.
     * @param getRandomInt A function that returns a random integer that is greater than or equal to 0 and less than upperBound: 0 <= n < upperBound. Defaults to {@link Math.random}, which is not guarantied to be cryptographically secure.
     */
    public get skipRandom() {
        const self = this;
        return function skipRandom(
            count: number | bigint,
            getRandomInt?: (upperBound: number) => number
        ): Itmod<T> {
            requireIntegerOrInfinity(count);
            requireNonNegative(count);
            return new SkipRandomItmod(self, count, getRandomInt);
        };
    }

    /**
     * Equivalent to {@link Array.copyWithin}.
     */
    public get copyWithin() {
        const self = this;
        return function copyWithin(
            target: number | bigint,
            start: number | bigint,
            end?: number | bigint
        ) {
            return new Itmod({ expensiveOrNonPure: true, fresh: true }, () => {
                const array = self.toArray();
                array.copyWithin(
                    Number(target),
                    Number(start),
                    end === undefined ? undefined : Number(end)
                );
                return array;
            });
        };
    }

    /**
     * Alias for for {@link Itmod.map}`((item, i) => [i, item])`
     *
     * Maps each element to a tuple containing its index and itself.
     */
    public get indexed() {
        const self = this;
        return function indexed(): Itmod<[index: number, item: T]> {
            return self.map((item, index) => [index, item]);
        };
    }

    /**
     * @returns Whether the Itmod contains the item.
     */
    public get includes() {
        const self = this;
        return function includes(item: T): boolean {
            const source = getDeepSource(self.getSource());
            if (isSet(source)) {
                return source.has(item);
            }

            for (const sourceItem of source) {
                if (Object.is(item, sourceItem)) {
                    return true;
                }
            }

            return false;
        };
    }

    /**
     * @returns Whether the given condition returns true for at least one element and its index.
     */
    public get some() {
        const self = this;
        return function some(
            condition: (item: T, index: number) => boolean
        ): boolean {
            let i = 0;
            for (const item of self) {
                if (condition(item, i)) return true;
                i++;
            }
            return false;
        };
    }

    /**
     * Alias for `!this.some(condition)`
     * @returns Whether the given condition returns false for every element and its index.
     */
    public get none() {
        const self = this;
        return function none(
            condition: (item: T, index: number) => boolean
        ): boolean {
            return !self.some(condition);
        };
    }

    /**
     * @returns Whether the given condition returns true for every element and its index.
     */
    public get every() {
        const self = this;
        return function every(
            condition: (item: T, index: number) => boolean
        ): boolean {
            let i = 0;
            for (const item of self) {
                if (!condition(item, i)) return false;
                i++;
            }
            return true;
        };
    }

    /**
     * Attempts to determine how many items are in the {@link Iterable} without iterating it.
     * @returns The number of items or undefined if it couldn't be determined.
     */
    public get nonIteratedCountOrUndefined() {
        const self = this;
        const externalNonIteratedCountOrUndefined = nonIteratedCountOrUndefined;
        return function nonIteratedCountOrUndefined() {
            if (self.properties.expensiveOrNonPure) return undefined;
            return externalNonIteratedCountOrUndefined(self.getSource());
        };
    }

    /**
     * Counts how many items are in the {@link Iterable}.
     * @returns The number of items.
     */
    public get count() {
        const self = this;
        return function count(): number {
            const nonIteratedCount = self.nonIteratedCountOrUndefined();
            if (nonIteratedCount !== undefined) {
                return nonIteratedCount;
            }

            let count = 0;
            for (const _ of self) {
                count++;
            }

            return count;
        };
    }

    public get min(): {
        /**
         * @returns The smallest given number of items.
         * @param count How many items to return.
         * @param order How to sort the items.
         */
        (count: number | bigint, order?: Order<T>): Itmod<T>;
        /**
         * @returns The smallest item.
         * @param order How to sort the items.
         */
        (order?: Order<T>): T | undefined;
    } {
        const self = this;
        function min(count: number | bigint, order?: Order<T>): Itmod<T>;
        function min(order?: Order<T>): T | undefined;
        function min(
            ...args:
                | [count: number | bigint, order?: Order<T>]
                | [order?: Order<T>]
        ): Itmod<T> | T | undefined {
            if (typeof args[0] === "number" || typeof args[0] === "bigint") {
                const [count, order = autoComparator] = args;
                requireSafeIntegerOrInfinity(requireNonNegative(count));
                if (isZero(count)) return Itmod.empty<T>();
                if (count === Infinity) return self.sort(order);

                return new Itmod(
                    { fresh: true, expensiveOrNonPure: true },
                    () => {
                        const source = self.getSource();

                        const result = new SortedSequence<T>(order, {
                            maxSize: Number(count),
                            keep: "least",
                        });

                        result.pushMany(source);

                        return result;
                    }
                );
            } else {
                const [order = autoComparator] = args;
                const comparator = asComparator(order);

                return self.reduce((least, current) =>
                    cmpLT(comparator(current, least)) ? current : least
                ) as T | undefined;
            }
        }
        return min;
    }

    public get max(): {
        /**
         * @returns The largest given number of items.
         * @param count How many items to return.
         * @param order How to sort the items.
         */
        (count: number | bigint, order?: Order<T>): Itmod<T>;
        /**
         * @returns The largest item.
         * @param order How to sort the items.
         */
        (order?: Order<T>): T | undefined;
    } {
        const self = this;
        function max(count: number | bigint, order?: Order<T>): Itmod<T>;
        function max(order?: Order<T>): T | undefined;
        function max(
            ...args:
                | [count: number | bigint, order?: Order<T>]
                | [order?: Order<T>]
        ): Itmod<T> | T | undefined {
            if (typeof args[0] === "number" || typeof args[0] === "bigint") {
                const [count, order = autoComparator] = args;
                requireSafeIntegerOrInfinity(requireNonNegative(count));
                if (isZero(count)) return Itmod.empty<T>();
                if (count === Infinity) return self.sort(order);

                return new Itmod(
                    { fresh: true, expensiveOrNonPure: true },
                    () => {
                        const source = self.getSource();

                        const result = new SortedSequence<T>(order, {
                            maxSize: Number(count),
                            keep: "greatest",
                        });

                        result.pushMany(source);

                        return result;
                    }
                );
            } else {
                const [order = autoComparator] = args;
                const comparator = asComparator(order);

                return self.reduce((greatest, current) =>
                    cmpGE(comparator(current, greatest)) ? current : greatest
                ) as T | undefined;
            }
        }
        return max;
    }

    public get groupBy() {
        const self = this;
        return function groupBy<
            KeySelector extends (item: T) => unknown,
            AdditionalKeySelectors extends readonly ((item: T) => unknown)[]
        >(
            keySelector: KeySelector,
            ...additionalKeySelectors: AdditionalKeySelectors
        ): GroupedItmod<KeySelector, AdditionalKeySelectors, T, T[]> {
            return new GroupedItmod(
                self,
                keySelector,
                additionalKeySelectors,
                identity
            );
        };
    }

    // Indexes each item by the key provided by the keySelector. Of items with duplicate keys, only one is kept.
    public get indexBy() {
        const self = this;
        return function indexBy<K>(
            keySelector: (item: T, index: number) => K
        ): Itmod<[K, T]> {
            return new Itmod({ expensiveOrNonPure: true, fresh: true }, () =>
                self.toMap(keySelector, identity)
            );
        };
    }

    public get split(): {
        (deliminator: Iterable<T>): Itmod<T[]>;
        <O>(
            deliminator: Iterable<O>,
            equalityChecker: (a: T, b: O) => boolean
        ): Itmod<T[]>;
    } {
        const externalSplit = split;
        const self = this;
        return function split<O>(
            deliminator: Iterable<O>,
            equalityChecker?: (a: T, b: O) => boolean
        ) {
            return new Itmod(
                {},
                returns(externalSplit(self, deliminator, equalityChecker))
            );
        };
    }

    public get partitionBySize() {
        const self = this;
        return function partitionBySize(size: number | bigint): Itmod<T[]> {
            requireIntegerOrInfinity(size);
            requireGreaterThanZero(size);

            if (typeof size !== "number") {
                size = Number(size);
            }

            const selfSize = self.nonIteratedCountOrUndefined();

            /** optimization for when it is known that there will only be one partition at most. */
            if (
                size === Infinity ||
                (selfSize !== undefined && selfSize <= size)
            ) {
                return new Itmod({}, function* () {
                    const partition = self.toArray();
                    if (partition.length > 0) yield partition;
                });
            }

            return new Itmod({}, function* () {
                let partition: T[] = [];

                for (const item of self) {
                    partition.push(item);

                    if (partition.length >= size) {
                        yield partition;
                        partition = [];
                    }
                }
                if (partition.length !== 0) yield partition;
            });
        };
    }

    public get groupJoin(): {
        <I, K, R>(
            inner: Iterable<I>,
            outerKeySelector: (item: T) => K,
            innerKeySelector: (item: I) => K,
            resultSelector: (outer: T, innerGroup: I[]) => R
        ): Itmod<R>;
        <I, R>(
            inner: Iterable<I>,
            is: (outer: T, inner: I) => boolean,
            resultSelector: (outer: T, innerGroup: I[]) => R
        ): Itmod<R>;
    } {
        const self = this;
        return function groupJoin<I, K, R>(
            ...args:
                | [
                      inner: Iterable<I>,
                      outerKeySelector: (item: T) => K,
                      innerKeySelector: (item: I) => K,
                      resultSelector: (outer: T, innerGroup: I[]) => any
                  ]
                | [
                      inner: Iterable<I>,
                      is: (outer: T, inner: I) => boolean,
                      resultSelector: (outer: T, innerGroup: I[]) => any
                  ]
        ) {
            if (args.length === 3) {
                const [inner, is, resultSelector] = args;
                return new Itmod({}, () => {
                    return groupJoinByComparison(
                        self,
                        inner,
                        is,
                        resultSelector,
                        false
                    );
                });
            } else {
                const [
                    inner,
                    outerKeySelector,
                    innerKeySelector,
                    resultSelector,
                ] = args;
                return new Itmod({}, () => {
                    return groupJoinByKey(
                        self,
                        inner,
                        outerKeySelector,
                        innerKeySelector,
                        resultSelector,
                        false
                    );
                });
            }
        };
    }

    public get innerGroupJoin(): {
        <I, K, R>(
            inner: Iterable<I>,
            outerKeySelector: (item: T) => K,
            innerKeySelector: (item: I) => K,
            resultSelector: (outer: T, innerGroup: I[]) => R
        ): Itmod<R>;
        <I, R>(
            inner: Iterable<I>,
            is: (outer: T, inner: I) => boolean,
            resultSelector: (outer: T, innerGroup: I[]) => R
        ): Itmod<R>;
    } {
        const self = this;
        return function groupJoin<I, K, R>(
            ...args:
                | [
                      inner: Iterable<I>,
                      outerKeySelector: (item: T) => K,
                      innerKeySelector: (item: I) => K,
                      resultSelector: (outer: T, innerGroup: I[]) => any
                  ]
                | [
                      inner: Iterable<I>,
                      is: (outer: T, inner: I) => boolean,
                      resultSelector: (outer: T, innerGroup: I[]) => any
                  ]
        ) {
            if (args.length === 3) {
                const [inner, is, resultSelector] = args;
                return new Itmod({}, () => {
                    return groupJoinByComparison(
                        self,
                        inner,
                        is,
                        resultSelector,
                        true
                    );
                });
            } else {
                const [
                    inner,
                    outerKeySelector,
                    innerKeySelector,
                    resultSelector,
                ] = args;
                return new Itmod({}, () => {
                    return groupJoinByKey(
                        self,
                        inner,
                        outerKeySelector,
                        innerKeySelector,
                        resultSelector,
                        true
                    );
                });
            }
        };
    }

    public get join(): {
        <I, K, R>(
            inner: Iterable<I>,
            outerKeySelector: (item: T) => K,
            innerKeySelector: (item: I) => K,
            resultSelector: (outer: T, innerGroup: I | undefined) => R
        ): Itmod<R>;
        <I, R>(
            inner: Iterable<I>,
            is: (outer: T, inner: I) => boolean,
            resultSelector: (outer: T, innerGroup: I | undefined) => R
        ): Itmod<R>;
    } {
        const self = this;
        return function join<I, K, R>(
            ...args:
                | [
                      inner: Iterable<I>,
                      outerKeySelector: (item: T) => K,
                      innerKeySelector: (item: I) => K,
                      resultSelector: (outer: T, innerGroup: I | undefined) => R
                  ]
                | [
                      inner: Iterable<I>,
                      is: (outer: T, inner: I) => boolean,
                      resultSelector: (outer: T, innerGroup: I | undefined) => R
                  ]
        ) {
            if (args.length === 3) {
                const [inner, is, resultSelector] = args;
                return new Itmod({}, () => {
                    return joinByComparison(
                        self,
                        inner,
                        is,
                        resultSelector,
                        false
                    );
                });
            } else {
                const [
                    inner,
                    outerKeySelector,
                    innerKeySelector,
                    resultSelector,
                ] = args;
                return new Itmod({}, () => {
                    return joinByKey(
                        self,
                        inner,
                        outerKeySelector,
                        innerKeySelector,
                        resultSelector,
                        false
                    );
                });
            }
        };
    }

    public get innerJoin(): {
        <I, K, R>(
            inner: Iterable<I>,
            outerKeySelector: (item: T) => K,
            innerKeySelector: (item: I) => K,
            resultSelector: (outer: T, innerGroup: I | undefined) => R
        ): Itmod<R>;
        <I, R>(
            inner: Iterable<I>,
            is: (outer: T, inner: I) => boolean,
            resultSelector: (outer: T, innerGroup: I | undefined) => R
        ): Itmod<R>;
    } {
        const self = this;
        return function join<I, K, R>(
            ...args:
                | [
                      inner: Iterable<I>,
                      outerKeySelector: (item: T) => K,
                      innerKeySelector: (item: I) => K,
                      resultSelector: (
                          outer: T,
                          innerGroup: I | undefined
                      ) => any
                  ]
                | [
                      inner: Iterable<I>,
                      is: (outer: T, inner: I) => boolean,
                      resultSelector: (
                          outer: T,
                          innerGroup: I | undefined
                      ) => any
                  ]
        ) {
            if (args.length === 3) {
                const [inner, is, resultSelector] = args;
                return new Itmod({}, () => {
                    return joinByComparison(
                        self,
                        inner,
                        is,
                        resultSelector,
                        true
                    );
                });
            } else {
                const [
                    inner,
                    outerKeySelector,
                    innerKeySelector,
                    resultSelector,
                ] = args;
                return new Itmod({}, () => {
                    return joinByKey(
                        self,
                        inner,
                        outerKeySelector,
                        innerKeySelector,
                        resultSelector,
                        true
                    );
                });
            }
        };
    }

    /**
     * Copies all the items into an {@link Array}.
     */
    public get toArray() {
        const self = this;
        const externalToArray = toArray;
        return function toArray(): T[] {
            const source = self.getSource();
            if (self.properties.fresh && isArrayAsWritable(source)) {
                return source;
            } else {
                return externalToArray(source);
            }
        };
    }

    /**
     * Copies all the items into a {@link Set}.
     */
    public get toSet() {
        const self = this;
        const externalToSet = toSet;
        return function toSet(): Set<T> {
            const source = self.getSource();
            if (self.properties.fresh && isSetAsWritable(source)) {
                return source;
            } else {
                return externalToSet(source);
            }
        };
    }

    public get toMap(): {
        /**
         * @returns A {@link Map} of the items in the Itmod.
         */
        (): T extends MapEntryLike<infer K, infer V>
            ? Map<K, V>
            : Map<unknown, unknown>;
        /**
         * @returns A {@link Map} of the items in the Itmod.
         * @param keySelector Returns the key to use in the map entry for each item.
         */
        <K>(
            keySelector: (item: T, index: number) => K,
            valueSelector?: undefined
        ): T extends MapEntryLike<any, infer V> ? Map<K, V> : Map<K, unknown>;
        /**
         * @returns A {@link Map} of the items in the Itmod.
         * @param valueSelector Returns the value to use in the map entry for each item.
         */
        <V>(
            keySelector: undefined,
            valueSelector: (item: T, index: number) => V
        ): T extends MapEntryLike<infer K, any> ? Map<K, V> : Map<unknown, V>;
        /**
         * @returns A {@link Map} of the items in the Itmod.
         * @param keySelector Returns the key to use in the map entry for each item.
         * @param valueSelector Returns the value to use in the map entry for each item.
         */
        <K, V>(
            keySelector: (item: T, index: number) => K,
            valueSelector: (item: T, index: number) => V
        ): Map<K, V>;
    } {
        const self = this;
        const externalToMap = toMap;
        return function toMap(
            keySelector?: (item: T, index: number) => any,
            valueSelector?: (item: T, index: number) => any
        ): any {
            const source = self.getSource();
            if (
                keySelector === undefined &&
                valueSelector === undefined &&
                self.properties.fresh &&
                source instanceof Map
            ) {
                return source;
            }
            return externalToMap(source, keySelector, valueSelector);
        };
    }

    public get toObject(): {
        (): T extends MapEntryLike<infer K extends keyof any, infer V>
            ? Record<K, V>
            : {};
        <K extends keyof any>(
            keySelector: (item: T, index: number) => K,
            valueSelector?: undefined
        ): T extends MapEntryLike<any, infer V>
            ? Record<K, V>
            : Record<K, unknown>;
        <V>(
            keySelector: undefined,
            valueSelector: (item: T, index: number) => V
        ): T extends MapEntryLike<infer K extends keyof any, any>
            ? Record<K, V>
            : {};
        <K extends keyof any, V>(
            keySelector: (item: T, index: number) => K,
            valueSelector: (item: T, index: number) => V
        ): Record<K, V>;
    } {
        const self = this;
        return function toObject<K, V>(
            keySelector: (item: T, index: number) => any = (item: any) =>
                item?.[0],
            valueSelector: (item: T, index: number) => any = (item: any) =>
                item?.[1]
        ): any {
            const result = {} as Record<any, any>;

            let i = 0;
            for (const item of self) {
                const key = keySelector(item, i);
                const value = valueSelector(item, i);

                result[key] = value;

                i++;
            }

            return result;
        };
    }

    public get toAsyncItmod() {
        const self = this;
        return function toAsyncItmod() {
            return new AsyncItmod({}, async function* () {
                yield* self;
            });
        };
    }

    /**
     * If the {@link Iterable} is an {@link Array}, returns that {@link Array} as readonly; otherwise, copies all the items into an {@link Array} and returns that.
     */
    public get asArray() {
        const self = this;
        const externalAsArray = asArray;
        return function asArray(): readonly T[] {
            const source = self.getSource();
            return externalAsArray(source);
        };
    }

    /**
     * If the {@link Iterable} is a {@link Set}, returns that {@link Set} as readonly; otherwise, copies all the items into a {@link Set} and returns that.
     */
    public get asSet() {
        const self = this;
        const externalAsSet = asSet;
        return function asSet(): ReadonlySet<T> {
            const source = self.getSource();
            return externalAsSet(source);
        };
    }

    public get asMap(): {
        /** @returns A {@link ReadonlyMap} view of the Itmod. */
        (): T extends MapEntryLike<infer K, infer V>
            ? ReadonlyMap<K, V>
            : ReadonlyMap<unknown, unknown>;
        /**
         * @returns A {@link ReadonlyMap} view of the Itmod.
         * @param keySelector Returns the key to use in the map entry for each item.
         */
        <K>(
            keySelector: (item: T, index: number) => K,
            valueSelector?: undefined
        ): T extends MapEntryLike<any, infer V>
            ? ReadonlyMap<K, V>
            : ReadonlyMap<K, unknown>;
        /**
         * @returns A {@link ReadonlyMap} view of the Itmod.
         * @param valueSelector Returns the value to use in the map entry for each item.
         */
        <V>(
            keySelector: undefined,
            valueSelector: (item: T, index: number) => V
        ): T extends MapEntryLike<infer K, any>
            ? ReadonlyMap<K, V>
            : ReadonlyMap<unknown, V>;
        /**
         * @returns A {@link ReadonlyMap} view of the Itmod.
         * @param keySelector Returns the key to use in the map entry for each item.
         * @param valueSelector Returns the value to use in the map entry for each item.
         */
        <K, V>(
            keySelector: (item: T, index: number) => K,
            valueSelector: (item: T, index: number) => V
        ): ReadonlyMap<K, V>;
    } {
        const self = this;
        return function asMap(
            keySelector?: (item: T, index: number) => any,
            valueSelector?: (item: T, index: number) => any
        ): any {
            const source = self.getSource();
            if (
                keySelector === undefined &&
                valueSelector === undefined &&
                source instanceof Map
            ) {
                return source;
            }
            return toMap(source, keySelector, valueSelector);
        };
    }

    public get asObject(): {
        (): T extends MapEntryLike<infer K extends keyof any, infer V>
            ? Readonly<Record<K, V>>
            : Readonly<{}>;
        <K extends keyof any>(
            keySelector: (item: T, index: number) => K,
            valueSelector?: undefined
        ): T extends MapEntryLike<any, infer V>
            ? Readonly<Record<K, V>>
            : Readonly<Record<K, unknown>>;
        <V>(
            keySelector: undefined,
            valueSelector: (item: T, index: number) => V
        ): T extends MapEntryLike<infer K extends keyof any, any>
            ? Readonly<Record<K, V>>
            : Readonly<{}>;
        <K extends keyof any, V>(
            keySelector: (item: T, index: number) => K,
            valueSelector: (item: T, index: number) => V
        ): Readonly<Record<K, V>>;
    } {
        const self = this;
        return function asObject(
            keySelector: (item: T, index: number) => any = (item: any) =>
                item?.[0],
            valueSelector: (item: T, index: number) => any = (item: any) =>
                item?.[1]
        ): any {
            return self.toObject(keySelector, valueSelector);
        };
    }

    /**
     * Sorts the items.
     * @param orders How to sort the items. Defaults to {@link autoComparator}.
     */
    public get sort(): {
        (...orders: Comparator<T>[]): SortedItmod<T>;
        (...orders: FieldSelector<T>[]): SortedItmod<T>;
        (...orders: Order<T>[]): SortedItmod<T>;
    } {
        const self = this;
        return function sort(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(
                self,
                orders.length === 0 ? [autoComparator] : orders
            );
        };
    }

    /**
     * Sorts the items in descending order.
     * @param orders How to sort the items. Defaults to {@link autoComparator}.
     */
    public get sortDescending(): {
        (...orders: Comparator<T>[]): SortedItmod<T>;
        (...orders: FieldSelector<T>[]): SortedItmod<T>;
        (...orders: Order<T>[]): SortedItmod<T>;
    } {
        const self = this;
        return function sortDescending(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(
                self,
                orders.length === 0
                    ? [reverseOrder(autoComparator)]
                    : orders.map(reverseOrder)
            );
        };
    }

    /**
     * Shuffles the items.
     * @param getRandomInt Returns a random integer that's greater than or equal to 0 and less than upperBound. Defaults to using {@link Math.random}, which is not cryptographically secure.
     */
    public get shuffle() {
        const self = this;
        return function shuffle(getRandomInt?: (upperBound: number) => number) {
            return new Itmod({ fresh: true, expensiveOrNonPure: true }, () => {
                const array = self.toArray();
                fisherYatesShuffle(array, getRandomInt);
                return array;
            });
        };
    }

    /**
     * Iterates the Itmod and caches the result. Subsequent iterations iterate this cache instead of using the original source.
     */
    public get collapse() {
        const self = this;
        return function collapse() {
            return Itmod.from([...self]);
        };
    }

    /**
     * Checks if the given Iterable contains the same items in the same order as the {@link Itmod}.
     *
     * @param other The given Iterable.
     * @param is Returns whether the two given items are considered equal.
     */
    public get sequenceEquals() {
        const self = this;
        return function sequenceEquals<O = T>(
            other: Iterable<O>,
            /**
             * @default Object.is
             */
            is: (a: T, b: O) => boolean = Object.is
        ) {
            const source = self.getSource();

            // try to check size
            const aSize = nonIteratedCountOrUndefined(source);
            if (aSize !== undefined) {
                const bSize = nonIteratedCountOrUndefined(other);
                if (bSize !== undefined && aSize !== bSize) return false;
            }

            // check contents
            const aIterator = self[Symbol.iterator]();
            const bIterator = other[Symbol.iterator]();

            while (true) {
                const aNext = aIterator.next();
                const bNext = bIterator.next();

                const aDone = aNext.done;
                const bDone = bNext.done;
                // if done, return whether both are done, which means they have the same length. If they don't have the same length, they're not equal
                if (aDone || bDone) return aDone === bDone;

                if (!is(aNext.value, bNext.value)) return false;
            }
        };
    }

    public get makeString(): {
        /**
         * @returns The string values of each item in the stream concatenated together.
         */
        (): string;
        /**
         * @returns The string values of each item in the stream concatenated together with the given separator between them.
         * @param separator Inserted in between each item. Defaults to "" (blank string).
         */
        (separator: string): string;
        /**
         * @returns The string values of each item in the stream concatenated together with the given separator between them.
         * @param start Concatenated onto the start of the resulting string. Defaults to "" (blank string).
         * @param separator Inserted in between each item. Defaults to "" (blank string).
         */
        (start: string, separator: string): string;
        /**
         * @returns The string values of each item in the stream concatenated together with the given separator between them.
         * @param start Concatenated onto the start of the resulting string. Defaults to "" (blank string).
         * @param separator Inserted in between each item. Defaults to "" (blank string).
         * @param end Concatenated onto the end of the resulting string. Defaults to "" (blank string).
         */
        (start: string, separator: string, end: string): string;
    } {
        const self = this;
        return function makeString(
            ...args: [string, string, string] | [string, string] | [string] | []
        ): string {
            let [start = "", separator = "", end = ""] =
                args.length <= 1 ? ["", args[0], ""] : args;

            if (separator === "") {
                const source = self.getSource();
                if (typeof source === "string") {
                    // This check may or may not be necessary. I have no way to test if it is.
                    // Other than by testing memory usage maybe? Or can you do a heap dump in javascript?
                    // maybe use the debugger
                    if (start === "" && end === "") {
                        return source;
                    } else {
                        return start + source + end;
                    }
                } else if (self.properties.expensiveOrNonPure) {
                    return start + asArray(source).join(separator) + end;
                }
            }

            return start + self.asArray().join(separator) + end;
        };
    }
}

/**
 * An {@link Itmod} with a sort applied to its items. The result of {@link Itmod.sort}.
 */
export class SortedItmod<T> extends Itmod<T> {
    private readonly original: Itmod<T>;
    private readonly orders: readonly Order<T>[];
    private readonly comparator: Comparator<T>;
    public constructor(original: Itmod<T>, orders: readonly Order<T>[]) {
        super({ fresh: true, expensiveOrNonPure: true }, () => {
            const array = original.toArray();
            array.sort(comparator);
            return array;
        });

        this.orders = orders;
        this.original = original;

        const comparators = orders.map(asComparator);
        const comparator = (a: T, b: T) => {
            for (const comparator of comparators) {
                const cmp = comparator(a, b);
                if (cmpNQ(cmp)) return cmp;
            }
            return 0;
        };
        this.comparator = comparator;
    }

    /**
     * Adds more fallback sorts to the {@link SortedItmod}.
     */
    public get thenBy(): {
        (...orders: Comparator<T>[]): SortedItmod<T>;
        (...orders: FieldSelector<T>[]): SortedItmod<T>;
        (...orders: Order<T>[]): SortedItmod<T>;
    } {
        const self = this;
        return function thenBy(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(self.original, [...self.orders, ...orders]);
        };
    }

    /**
     * Adds more fallback sorts to the {@link SortedItmod} in descending order.
     */
    public get thenByDescending(): {
        (...orders: Comparator<T>[]): SortedItmod<T>;
        (...orders: FieldSelector<T>[]): SortedItmod<T>;
        (...orders: Order<T>[]): SortedItmod<T>;
    } {
        const self = this;
        return function thenBy(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(self.original, [
                ...self.orders,
                ...orders.map(reverseOrder),
            ]);
        };
    }

    public get count() {
        return this.original.count;
    }

    public get nonIteratedCountOrUndefined() {
        return this.original.nonIteratedCountOrUndefined;
    }

    public get take() {
        const self = this;
        return function take(count: number | bigint) {
            return self.original.min(count, self.comparator);
        };
    }

    public get takeFinal() {
        const self = this;
        return function takeFinal(count: number | bigint) {
            return self.original.max(count, self.comparator);
        };
    }

    // TODO skip and skipFinal

    public get first() {
        const self = this;
        return function first() {
            return self.min(self.comparator);
        };
    }

    public get final() {
        const self = this;
        return function final() {
            return self.max(self.comparator);
        };
    }
}

/**
 * {@link Itmod} With a mapping applied to its items. The result of {@link Itmod.map}.
 */
export class MappedItmod<T, R> extends Itmod<R> {
    protected readonly mapping: (value: T, index: number) => R;
    protected readonly original: Itmod<T>;
    protected readonly config: Readonly<{
        indexOffset: number;
    }>;

    public constructor(
        original: Itmod<T>,
        mapping: (value: T, index: number) => R,
        {
            indexOffset = 0,
        }: {
            /**
             * Offset added to the index given to the mapping function.
             * @default 0
             */
            indexOffset?: number;
        } = {}
    ) {
        super({}, function* () {
            let i = indexOffset;
            for (const value of original) {
                yield mapping(value, i);
                i++;
            }
        });

        this.mapping = mapping;
        this.original = original;
        this.config = { indexOffset };
    }

    public get map() {
        const self = this;
        return function map<R2>(
            mapping: (item: R, index: number) => R2
        ): MappedItmod<T, R2> {
            return new MappedItmod(
                self.original,
                (item, index) => mapping(self.mapping(item, index), index),
                self.config
            );
        };
    }

    public get count() {
        return this.original.count;
    }

    public get nonIteratedCountOrUndefined() {
        return this.original.nonIteratedCountOrUndefined;
    }

    public get take() {
        const self = this;
        return function take(count: number | bigint): Itmod<R> {
            // no need to adjust indexes for take.
            return new MappedItmod(
                self.original.take(count),
                self.mapping,
                self.config
            );
        };
    }

    public get skip() {
        const self = this;
        return function skip(count: number | bigint): Itmod<R> {
            return new MappedItmod(self.original.skip(count), self.mapping, {
                ...self.config,
                // offset the mapping index for the non-skipped items
                indexOffset: self.config.indexOffset + Number(count),
            });
        };
    }

    // Each of these overloads checks if the mapping function uses index.
    // If it doesn't. It is safe to take or skip before mapping without doing anything to adjust the index.

    private get parentTakeFinal() {
        return super.takeFinal;
    }
    public get takeFinal() {
        const self = this;
        return function takeFinal(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return new MappedItmod(
                    self.original,
                    (item, index) => [item, index] as const
                )
                    .parentTakeFinal(count)
                    .map(([item, index]) => self.mapping(item, index));
            } else {
                return new MappedItmod(
                    self.original.takeFinal(count),
                    self.mapping
                );
            }
        };
    }

    private get parentSkipFinal() {
        return super.skipFinal;
    }
    public get skipFinal() {
        const self = this;
        return function skipFinal(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return new MappedItmod(
                    self.original,
                    (item, index) => [item, index] as const
                )
                    .parentSkipFinal(count)
                    .map(([item, index]) => self.mapping(item, index));
            } else {
                return new MappedItmod(
                    self.original.skipFinal(count),
                    self.mapping
                );
            }
        };
    }

    private get parentTakeEveryNth() {
        return super.takeEveryNth;
    }
    public get takeEveryNth() {
        const self = this;
        return function takeEveryNth(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return new MappedItmod(
                    self.original,
                    (item, index) => [item, index] as const
                )
                    .parentTakeEveryNth(count)
                    .map(([item, index]) => self.mapping(item, index));
            } else {
                return new MappedItmod(
                    self.original.takeEveryNth(count),
                    self.mapping
                );
            }
        };
    }

    private get parentTakeRandom() {
        return super.takeRandom;
    }
    public get takeRandom() {
        const self = this;
        return function takeRandom(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return new MappedItmod(
                    self.original,
                    (item, index) => [item, index] as const
                )
                    .parentTakeRandom(count)
                    .map(([item, index]) => self.mapping(item, index));
            } else {
                return new MappedItmod(
                    self.original.takeRandom(count),
                    self.mapping
                );
            }
        };
    }

    private get parentSkipEveryNth() {
        return super.skipEveryNth;
    }
    public get skipEveryNth() {
        const self = this;
        return function skipEveryNth(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return new MappedItmod(
                    self.original,
                    (item, index) => [item, index] as const
                )
                    .parentSkipEveryNth(count)
                    .map(([item, index]) => self.mapping(item, index));
            } else {
                return new MappedItmod(
                    self.original.skipEveryNth(count),
                    self.mapping
                );
            }
        };
    }

    private get parentSkipRandom() {
        return super.skipRandom;
    }
    public get skipRandom() {
        const self = this;
        return function skipRandom(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return new MappedItmod(
                    self.original,
                    (item, index) => [item, index] as const
                )
                    .parentSkipRandom(count)
                    .map(([item, index]) => self.mapping(item, index));
            } else {
                return new MappedItmod(
                    self.original.skipRandom(count),
                    self.mapping
                );
            }
        };
    }

    private get parentReverse() {
        return super.reverse;
    }
    public get reverse() {
        const self = this;
        return function reverse(): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return new MappedItmod(
                    self.original,
                    (item, index) => [item, index] as const
                )
                    .parentReverse()
                    .map(([item, index]) => self.mapping(item, index));
            } else {
                return new MappedItmod(self.original.reverse(), self.mapping);
            }
        };
    }

    private get parentShuffle() {
        return super.shuffle;
    }
    public get shuffle() {
        const self = this;
        return function shuffle(): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return new MappedItmod(
                    self.original,
                    (item, index) => [item, index] as const
                )
                    .parentShuffle()
                    .map(([item, index]) => self.mapping(item, index));
            } else {
                return new MappedItmod(self.original.shuffle(), self.mapping);
            }
        };
    }

    public get final() {
        const self = this;
        const externalFinal = final;
        return function final() {
            const source = self.original.getSource();
            const result = externalFinal(source);

            if (result === undefined) return undefined;
            return self.mapping(result.value, result.index);
        };
    }
}

export class ReversedItmod<T> extends Itmod<T> {
    protected readonly original: Itmod<T>;
    public constructor(original: Itmod<T>) {
        super({ expensiveOrNonPure: true }, () => {
            const source = original.getSource();

            if (source instanceof Collection) {
                return source.reversed();
            }

            return (function* () {
                const array = asArray(source);
                for (let i = array.length - 1; i >= 0; i--) {
                    yield array[i] as T;
                }
            })();
        });
        this.original = original;
    }

    public get count() {
        return this.original.count;
    }

    public get nonIteratedCountOrUndefined() {
        return this.original.nonIteratedCountOrUndefined;
    }

    public get reverse() {
        const self = this;
        return function reverse() {
            return self.original;
        };
    }

    public get final() {
        const self = this;
        return function final(): T | undefined {
            return self.original.first();
        };
    }

    public get takeFinal() {
        const self = this;
        return function takeFinal(n: number | bigint) {
            return self.original.take(n).reverse();
        };
    }

    public get toArray() {
        const self = this;
        return function toArray() {
            const originalSource = self.original.getSource();

            if (
                isArrayAsWritable(originalSource) &&
                self.original.properties.fresh
            ) {
                originalSource.reverse();
                return originalSource;
            }

            return toArrayReversed(getDeepSource(originalSource));
        };
    }

    public get asArray() {
        const self = this;
        return function asArray() {
            return self.toArray();
        };
    }
}

export class RepeatedItmod<T> extends Itmod<T> {
    protected readonly original: Itmod<T>;
    protected readonly times: number | bigint;
    public constructor(original: Itmod<T>, times: number | bigint) {
        requireNonNegative(times);
        if (typeof times === "number") requireSafeInteger(times);

        super({}, function* () {
            const source = cachingIterable(original);
            if (times === Infinity) {
                while (true) {
                    yield* source;
                }
            } else {
                for (let i = zeroLike(times); i < times; i++) {
                    yield* source;
                }
            }
        });

        this.original = original;
        this.times = times;
    }

    public get count() {
        const self = this;
        return function count() {
            return self.original.count() * Number(self.times);
        };
    }

    public get nonIteratedCountOrUndefined() {
        const self = this;
        return function nonIteratedCountOrUndefined() {
            const count = self.original.nonIteratedCountOrUndefined();
            if (count === undefined) return undefined;
            return count * Number(self.times);
        };
    }

    public get reverse() {
        const self = this;
        return function reverse() {
            return new RepeatedItmod(self.original.reverse(), self.times);
        };
    }

    public get distinct() {
        const self = this;
        return function distinct(id?: (item: T) => any) {
            return self.original.distinct(id);
        };
    }

    public get toSet() {
        const self = this;
        return function toSet(): Set<T> {
            return self.original.toSet();
        };
    }

    public get asSet() {
        const self = this;
        return function asSet(): ReadonlySet<T> {
            return self.original.asSet();
        };
    }

    private get parentMap() {
        return super.map;
    }
    public get map() {
        const self = this;
        return function map<R>(
            mapping: (item: T, index: number) => R
        ): Itmod<R> {
            if (mapping.length >= 2) {
                return self.parentMap(mapping);
            } else {
                return new RepeatedItmod(
                    self.original.map(mapping),
                    self.times
                );
            }
        };
    }

    private get parentFilter() {
        return super.filter;
    }
    public get filter() {
        const self = this;
        return function filter(
            test: (item: T, index: number) => boolean
        ): Itmod<T> {
            if (test.length >= 2) {
                return self.parentFilter(test);
            } else {
                return new RepeatedItmod(
                    self.original.filter(test),
                    self.times
                );
            }
        };
    }

    public get toArray() {
        const self = this;
        if (self.times <= 1) return self.original.toArray;
        return function toArray() {
            const result = self.original.toArray();
            if (result.length === 0) return result;

            const times = Number(self.times);

            let currentLength = result.length;
            const desiredLength = currentLength * times;
            result.length = desiredLength;

            const desiredLength_floorDiv2 = Math.trunc(desiredLength / 2);

            while (true) {
                if (currentLength <= desiredLength_floorDiv2) {
                    result.copyWithin(currentLength, 0, currentLength);
                    currentLength *= 2;
                } else {
                    result.copyWithin(
                        currentLength,
                        0,
                        desiredLength - currentLength
                    );
                    currentLength = desiredLength; // *Even though currentLength isn't used after this line, keeping it correct will make this code more robust. The optimizer will probably recognize this an an unnecessary line anyway, and not actually include it in compiled output.
                    break;
                }
            }

            return result;
        };
    }

    public get asArray() {
        return this.toArray;
    }

    public get makeString(): Itmod<T>["makeString"] {
        const self = this;
        return function makeString(...args: any) {
            return (from(self.asArray()).makeString as any)(...args);
        } as any;
    }
}

export class FlattenedItmod<T> extends Itmod<
    T extends Iterable<infer SubT> ? SubT : T
> {
    protected readonly original: Itmod<T>;
    public constructor(original: Itmod<T>) {
        super({}, function* () {
            for (const item of original) {
                if (isIterable(item)) {
                    yield* item as any;
                } else {
                    yield item as any;
                }
            }
        });
        this.original = original;
    }

    public get reverse() {
        const self = this;
        return function reverse(): Itmod<
            T extends Iterable<infer SubT> ? SubT : T
        > {
            return new FlattenedItmod(
                self.original
                    .reverse()
                    .map((item) =>
                        isIterable(item) ? from(item).reverse() : item
                    ) as any
            );
        };
    }

    public get count() {
        const self = this;
        return function count() {
            return self.original.fold(
                0,
                (total, item) =>
                    total + (isIterable(item) ? from(item).count() : 1)
            );
        };
    }

    public get nonIteratedCountOrUndefined() {
        return function nonIteratedCountOrUndefined() {
            return undefined;
        };
    }
}

export class FilteredItmod<T> extends Itmod<T> {
    private readonly original: Itmod<T>;
    private readonly test: (item: T, index: number) => boolean;
    public constructor(
        original: Itmod<T>,
        test: (item: T, index: number) => boolean
    ) {
        super({}, function* () {
            let i = 0;
            for (const item of original) {
                if (test(item, i)) yield item;
                i++;
            }
        });
        this.original = original;
        this.test = test;
    }

    public get reverse() {
        const self = this;
        const parentReverse = super.reverse;
        return function reverse(): Itmod<T> {
            if (self.test.length >= 2) {
                return parentReverse();
            } else {
                return new FilteredItmod(self.original.reverse(), self.test);
            }
        };
    }
}

export class GroupedItmod<
    KeySelector extends (item: T) => unknown,
    AdditionalKeySelectors extends readonly ((item: T) => unknown)[],
    T,
    Group
> extends Itmod<
    GroupByRecursiveResult<
        ReturnTypes<[KeySelector, ...AdditionalKeySelectors]>,
        Group
    > extends Iterable<infer SubT>
        ? SubT
        : never
> {
    private readonly original: Itmod<T>;
    private readonly keySelector: KeySelector;
    private readonly additionalKeySelectors: AdditionalKeySelectors;
    private readonly groupMapping: (items: T[]) => Group;
    public constructor(
        original: Itmod<T>,
        keySelector: KeySelector,
        additionalKeySelectors: AdditionalKeySelectors,
        groupMapping: (items: T[]) => Group
    ) {
        super(
            {
                fresh: true,
                expensiveOrNonPure: true,
            },
            () => {
                return groupByRecursive(
                    original.getSource(),
                    [keySelector, ...additionalKeySelectors],
                    groupMapping
                ) as any;
            }
        );
        this.keySelector = keySelector;
        this.additionalKeySelectors = additionalKeySelectors;
        this.original = original;
        this.groupMapping = groupMapping;
    }

    /**
     * Applies a mapping to each group, keeping the key the same.
     */
    public get mapGroups() {
        const self = this;
        return function mapGroup<G>(mapping: (group: Group) => G) {
            return new GroupedItmod(
                self.original,
                self.keySelector,
                self.additionalKeySelectors,
                (group) => mapping(self.groupMapping(group))
            );
        };
    }

    // TODO:
    // public get reduceGroups(): {
    //     /**
    //      * Combines all the items into one using the given reduction function.
    //      * @param reduction Combines each item with the accumulating result, starting with the first two items.
    //      * @returns The final result of the reduction, unless the Itmod was empty, then undefined is returned.
    //      */
    //     <R = T>(
    //         reduction: (
    //             /** The accumulating result. Equal to the returned value from the previous item. */
    //             accumulator: R | T,
    //             /** The current value to add onto the result. */
    //             value: T,
    //             /** The index of the current value. */
    //             index: number
    //         ) => R
    //     ): R | undefined;
    //     /**
    //      * Combines all the items into one using the given reduction function.
    //      * @param reduction Combines each item with the accumulating result, starting with the first two items.
    //      * @param finalizer Called after the result is collected to perform any final modifications. Not called if the Itmod was empty.
    //      * @returns The result of the finalizer unless the Itmod was empty, then undefined is returned.
    //      */
    //     <F, R = T>(
    //         reduction: (
    //             /** The accumulating result. Equal to the returned value from the previous item. */
    //             accumulator: R | T,
    //             /** The current value to add onto the result. */
    //             value: T,
    //             /** The index of the current value. */
    //             index: number
    //         ) => R,
    //         finalize: (
    //             /** The final result of the reduction. */
    //             result: R,
    //             /** How many items were in the {@link Iterable}. */
    //             count: number
    //         ) => F
    //     ): F | undefined;
    // } {
    //     const self = this;
    //     return function reduceGroups<R>(
    //         reduction: (accumulator: any, item: T, index: number) => R,
    //         finalize?: (result: R, count: number) => any
    //     ) {
    //         return new Itmod({expensive: true, fresh: true}, () => {
    //             const accumulators = new Map<
    //         })
    //     };
    // }
}

export class TakeRandomItmod<T> extends Itmod<T> {
    private readonly original: Itmod<T>;
    private readonly _count: number | bigint; // had to add underscore to field name so that it doesn't collide with the count() method
    private readonly getRandomInt?: (upperBound: number) => number;
    public constructor(
        original: Itmod<T>,
        count: number | bigint,
        getRandomInt?: (upperBound: number) => number
    ) {
        requireIntegerOrInfinity(count);
        requireNonNegative(count);
        super({ expensiveOrNonPure: true }, () => {
            if (count === 0) return emptyIterable();
            let size = original.nonIteratedCountOrUndefined(); // take advantage of certain optimizations

            let source = getDeepSource(original);
            if (count === Infinity) return source;

            size ??= nonIteratedCountOrUndefined(source);

            if (size === undefined) {
                // convert source to an array to get its size
                const array = toArray(source);
                source = array;

                // get length of the array
                size = array.length;
            }

            const indexesToTake = range(size)
                .shuffle(getRandomInt)
                .take(count)
                .asSet();

            return from(source).filter((_, index) => indexesToTake.has(index));
        });
        this.original = original;
        this._count = count;
        this.getRandomInt = getRandomInt;
    }

    public get shuffle() {
        const parentShuffle = super.shuffle;
        if (this.getRandomInt !== undefined) {
            return parentShuffle;
        }
        const self = this;
        return function shuffle(getRandomInt?: (upperBound: number) => number) {
            if (getRandomInt !== undefined) {
                return parentShuffle(getRandomInt);
            }
            return self.original.shuffle().take(self._count);
        };
    }

    public get nonIteratedCountOrUndefined() {
        const self = this;
        return function nonIteratedCountOrUndefined() {
            const originalCount = self.original.nonIteratedCountOrUndefined();
            if (originalCount === undefined) return undefined;

            if (self._count < originalCount) {
                return Number(self._count);
            } else {
                return originalCount;
            }
        };
    }
}

export class SkipRandomItmod<T> extends Itmod<T> {
    private readonly original: Itmod<T>;
    private readonly _count: number | bigint; // had to add underscore to field name so that it doesn't collide with the count() method
    private readonly getRandomInt?: (upperBound: number) => number;
    public constructor(
        original: Itmod<T>,
        count: number | bigint,
        getRandomInt?: (upperBound: number) => number
    ) {
        requireIntegerOrInfinity(count);
        requireNonNegative(count);
        super({ expensiveOrNonPure: true }, () => {
            if (count === Infinity) return emptyIterable();
            let size = original.nonIteratedCountOrUndefined();
            let source = getDeepSource(original);
            size ??= nonIteratedCountOrUndefined(source);

            if (size === undefined) {
                // convert source to an array to get size
                const array = toArray(source);
                source = array;

                // get length of the array
                size = array.length;
            }

            const indexesToSkip = range(size)
                .shuffle(getRandomInt)
                .take(count)
                .asSet();

            return from(source).filter((_, index) => !indexesToSkip.has(index));
        });
        this.original = original;
        this._count = count;
        this.getRandomInt = getRandomInt;
    }

    public get shuffle() {
        const parentShuffle = super.shuffle;
        if (this.getRandomInt !== undefined) {
            return parentShuffle;
        }
        const self = this;
        return function shuffle(getRandomInt?: (upperBound: number) => number) {
            if (getRandomInt !== undefined) {
                return parentShuffle(getRandomInt);
            }
            return self.original.shuffle().skip(self._count);
        };
    }

    // TODO overload take
}

export class RangeItmod<
    Start extends number | bigint,
    End extends number | bigint,
    Step extends number | bigint
> extends Itmod<
    Start extends bigint
        ? End extends bigint
            ? Step extends bigint
                ? bigint
                : number
            : number
        : number
> {
    protected readonly start: Start;
    protected readonly end: End;
    protected readonly step: Step;

    public constructor(
        start: Start,
        end: End,
        step: Step
    ) {
        super({}, function* () {
            let _start: any = start;
            let _end: any = end;
            // shut up typescript
            let _step: any = step as any;
            const useNumber =
                typeof _start === "number" ||
                typeof _end === "number" ||
                typeof _step === "number";
            
            const ZERO = useNumber ? 0 : (0n as any);
    
            if (useNumber) {
                _start = Number(_start);
                _end = Number(_end);
                _step = Number(_step);
            }

            if (_step === ZERO) throw new Error("arg3 must not be zero");

            if (_step < ZERO && _start < _end) return Itmod.empty<any>();
            if (_step > ZERO && _start > _end) return Itmod.empty<any>();

            const test =
                _step > ZERO ? (i: any) => i < _end : (i: any) => i > _end;

            return new Itmod({}, function* () {
                for (let i = _start; test(i); i += _step) yield i;
            });
        });
        this.start = start;
        this.end = end;
        this.step = step;

    }
}

const _emptyItmod = new Itmod<any>({}, returns(emptyIterable()));

/**
 * @returns 0n if the input is a bigint; 0 if the input is a number;
 */
function zeroLike<N extends number | bigint>(n: N): N extends number ? 0 : 0n {
    if (typeof n === "number") {
        return 0 as any;
    } else {
        return 0n as any;
    }
}

function isZero(n: number): n is 0;
function isZero(n: bigint): n is 0n;
function isZero(n: number | bigint): n is 0 | 0n;
function isZero(n: number | bigint): n is 0 | 0n {
    return n === 0 || n === 0n;
}

function isOne(n: number): n is 1;
function isOne(n: bigint): n is 1n;
function isOne(n: number | bigint): n is 1 | 1n;
function isOne(n: number | bigint): n is 1 | 1n {
    return n === 1 || n === 1n;
}

function toMap<T>(
    source: Iterable<T>,
    keySelector: (item: T, index: number) => any = (i: any) => i?.[0],
    valueSelector: (item: T, index: number) => any = (i: any) => i?.[1]
): any {
    const result = new Map<any, any>();

    let i = 0;
    for (const item of source) {
        const key = keySelector(item, i);
        const value = valueSelector(item, i);

        result.set(key, value);

        i++;
    }

    return result;
}

/**
 * Shuffles the given array in place.
 * @param array What to shuffle.
 * @param getRandomInt Returns a random integer that's greater than or equal to 0 and less than the upperBound. Defaults to using {@link Math.random}, which is not cryptographically secure.
 */
function fisherYatesShuffle(
    array: any[],
    getRandomInt: (upperBound: number) => number = defaultGetRandomInt
): void {
    // Fisher-Yates algorithm
    for (let i = array.length - 1; i > 0; i--) {
        const j = getRandomInt(i + 1);

        const temp = array[i]!;
        array[i] = array[j]!;
        array[j] = temp;
    }
}

/**
 * Uses {@link Math.random} to produce a random whole number that is greater than or equal to 0 and less than the given upperBound.
 * @param upperBound The whole number returned will be less than this.
 * @returns The whole number.
 */
function defaultGetRandomInt(upperBound: number) {
    return Math.trunc(Math.random() * upperBound);
}

/**
 * Splits the collection on the deliminator.
 * Equivalent to {@link String.split} except that regular expressions aren't supported.
 */
function split<T, O>(
    collection: Iterable<T>,
    deliminator: Iterable<O>,
    equalityChecker: (t: T, o: O) => boolean = Object.is
): Iterable<T[]> {
    const delim = toArray(deliminator);
    return {
        *[Symbol.iterator]() {
            let chunk: T[] = [];

            let d = 0;

            for (const item of collection) {
                chunk.push(item);

                if (equalityChecker(item, delim[d] as O)) {
                    d++;
                } else {
                    d = 0;
                }
                
                if (d >= delim.length) {
                    chunk.length -= delim.length;

                    yield chunk;

                    d = 0;
                    chunk = [];
                }
            }

            yield chunk;
        },
    };
}

function groupJoinByKey<O, I, K, R>(
    left: Iterable<O>,
    right: Iterable<I>,
    outerKeySelector: (item: O) => K,
    innerKeySelector: (item: I) => K,
    resultSelector: (outer: O, innerGroup: I[]) => R,
    inner: boolean
): Iterable<R> {
    return {
        *[Symbol.iterator]() {
            const rightGrouped = groupBy(right, innerKeySelector);

            for (const item of left) {
                const key = outerKeySelector(item);
                const group = rightGrouped.get(key);
                if (group !== undefined || !inner) {
                    const result = resultSelector(item, group ?? []);
                    yield result;
                }
            }
        },
    };
}

function groupJoinByComparison<O, I, R>(
    left: Iterable<O>,
    right: Iterable<I>,
    is: (outer: O, inner: I) => boolean,
    resultSelector: (outer: O, innerGroup: I[]) => R,
    inner: boolean
): Iterable<R> {
    return {
        *[Symbol.iterator]() {
            const innerCached = toArray(right);

            for (const o of left) {
                const innerGroup: I[] = [];
                for (const inner of innerCached) {
                    if (is(o, inner)) {
                        innerGroup.push(inner);
                    }
                }

                if (innerGroup.length > 0 || !inner) {
                    const result = resultSelector(o, innerGroup);
                    yield result;
                }
            }
        },
    };
}

function joinByKey<A, B, K, R>(
    left: Iterable<A>,
    right: Iterable<B>,
    leftKeySelector: (item: A) => K,
    rightKeySelector: (item: B) => K,
    resultSelector: (left: A, right: B | undefined) => R,
    inner: boolean
): Iterable<R> {
    return {
        *[Symbol.iterator]() {
            const rightIndexed = indexBy(right, rightKeySelector);
            for (const item of left) {
                const key = leftKeySelector(item);
                if (!inner || rightIndexed.has(key)) {
                    const rightItem = rightIndexed.get(key);
                    const result = resultSelector(item, rightItem);
                    yield result;
                }
            }
        },
    };
}

function joinByComparison<A, B, R>(
    left: Iterable<A>,
    right: Iterable<B>,
    is: (left: A, right: B) => boolean,
    resultSelector: (left: A, right: B | undefined) => R,
    inner: boolean
) {
    return {
        *[Symbol.iterator]() {
            const rightCached = toArray(right);
            for (const item of left) {
                let matchingRightItem: B | undefined = undefined;
                let itemFound = false;

                for (const rightItem of rightCached) {
                    if (is(item, rightItem)) {
                        matchingRightItem = rightItem;
                        itemFound = true;
                        break;
                    }
                }

                if (itemFound || !inner) {
                    const result = resultSelector(item, matchingRightItem);
                    yield result;
                }
            }
        },
    };
}

function indexBy<T, K>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K
): Map<K, T> {
    const indexedItems = new Map<K, T>();

    let i = 0;
    for (const item of items) {
        const key = keySelector(item, i);
        indexedItems.set(key, item);
    }

    return indexedItems;
}

function groupBy<T, K>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K
): Map<K, T[]>;

function groupBy<T, K, G>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K,
    groupSelector: (group: T[], key: K) => G
): Map<K, G>;

function groupBy<T, K>(
    items: Iterable<T>,
    keySelector: (item: T, index: number) => K,
    groupSelector: (group: T[], key: K) => any = identity
): Map<K, any> {
    const groups = new Map<K, any>();

    let i = 0;
    for (const item of items) {
        const key = keySelector(item, i);
        const group = groups.get(key);
        if (group === undefined) {
            groups.set(key, [item]);
        } else {
            group.push(item);
        }
        i++;
    }

    if (groupSelector !== identity) {
        for (const [key, group] of groups) {
            groups.set(key, groupSelector(group, key));
        }
    }

    return groups;
}

export type GroupByRecursiveResult<
    Keys extends readonly any[],
    Group
> = Keys extends readonly [infer Key, ...infer Rest]
    ? Map<Key, GroupByRecursiveResult<Rest, Group>>
    : Group;

function groupByRecursive<
    T,
    KeySelectors extends readonly ((item: T) => unknown)[]
>(
    items: Iterable<T>,
    keySelectors: KeySelectors
): GroupByRecursiveResult<ReturnTypes<KeySelectors>, T[]>;

function groupByRecursive<
    T,
    KeySelectors extends readonly ((item: T) => unknown)[],
    GroupSelector extends (group: T[]) => unknown
>(
    items: Iterable<T>,
    keySelectors: KeySelectors,
    groupSelector: GroupSelector
): GroupByRecursiveResult<ReturnTypes<KeySelectors>, ReturnType<GroupSelector>>;

function groupByRecursive<
    T,
    KeySelectors extends readonly ((item: T) => unknown)[]
>(
    items: Iterable<T>,
    keySelectors: KeySelectors,
    groupSelector: (group: T[]) => any = identity
): any {
    const [keySelector, ...rest] = keySelectors;

    if (keySelector === undefined) return groupSelector(toArray(items));

    return groupBy(
        items,
        keySelector,
        rest.length === 0
            ? groupSelector
            : (group) => groupByRecursive(group, rest, groupSelector)
    );
}

function final<T>(
    source: Iterable<T>
): { value: T; index: number } | undefined {
    if (isArray(source)) {
        if (source.length === 0) return undefined;

        const i = source.length - 1;
        return { value: source[i] as T, index: i };
    } else if (source instanceof Collection) {
        const size = source.size;

        if (size === 0) return undefined;
        return { value: source.final() as T, index: size - 1 };
    } else if (source instanceof Itmod) {
        const final = source.indexed().final();
        if (final === undefined) return undefined;
        const [index, value] = final;
        return { value, index };
    } else {
        let final: T | undefined = undefined;
        let i = -1;
        for (const item of source) {
            i++;
            final = item;
        }

        if (i === -1) return undefined;
        return { value: final as T, index: i };
    }
}

/**
 * If the given iterable is an Itmod, return's it's source, unless it's source is also an Itmod, then it's source's source is returned. Etc.
 *
 * Not always necessary but can be useful.
 *
 * *NOTE* assume to be expensive as one of the nested sources might be expensive. No good way to tell ahead of time.
 */
function getDeepSource<T>(source: Iterable<T>): Iterable<T> {
    while (source instanceof Itmod) {
        source = source.getSource();
    }
    return source;
}

/**
 * Out of two iterables, tries to pick the best one to use as a set, and the best one to use as a list.
 * @param prioritize Which to prioritize if neither is a set. Defaults to "smaller".
 * This default is under the assumption that the list would be iterated in full regardless,
 * which is what would need to be done to copy it into a set,
 * so copying it into a set ahead of time wouldn't help and just use more memory than necessary.
 */
function pickTheSet<Left, Right>(
    left: Iterable<Left>,
    right: Iterable<Right>,
    prioritize:
        | "prioritizeLeft"
        | "prioritizeRight"
        | "prioritizeSmaller"
        | "prioritizeLarger" = "prioritizeSmaller"
): "left" | "right" {
    const aIsSet = isSet(left);
    const bIsSet = isSet(right);

    if (aIsSet && bIsSet) {
        if (left.size > right.size) {
            return "left";
        } else {
            return "right";
        }
    } else if (aIsSet) {
        return "left";
    } else if (bIsSet) {
        return "right";
    } else {
        // neither is already a set
        if (prioritize === "prioritizeLeft") {
            return "left";
        }
        if (prioritize === "prioritizeRight") {
            return "right";
        }
        const sizeA = nonIteratedCountOrUndefined(left);
        const sizeB = nonIteratedCountOrUndefined(right);

        if (sizeA !== undefined && sizeB !== undefined) {
            if (
                prioritize === "prioritizeLarger"
                    ? sizeA > sizeB
                    : sizeA < sizeB
            ) {
                return "left";
            } else {
                return "right";
            }
        } else if (sizeA !== undefined) {
            return "left";
        } else if (sizeB !== undefined) {
            return "right";
        } else {
            return "left";
        }
    }
}

function innerJoin<Left, Right, OnLeft, OnRight>(
    left: Iterable<Left>,
    right: Iterable<Right>,
    onLeft: (item: Left) => OnLeft,
    onRight: (item: Right) => OnRight,
    is: (left: OnLeft, right: OnRight) => boolean = Object.is
): Iterable<{ left: Left; right: Right }> {
    if (is === Object.is) {
        return from(function* () {
            /** stores the right items for each key which have already been encountered in the nested loop */
            const rightCache = new Map<OnRight, Right[]>();
            /** the iterator for right, stored in a variable so it can be continuously iterated in the inner loop */
            const rightIterator = right[Symbol.iterator]();

            for (const leftItem of left) {
                const leftKey = onLeft(leftItem);

                // check the cache for right items
                let rightCacheGroup = rightCache.get(leftKey as any);

                if (rightCacheGroup !== undefined) {
                    // cache is not empty, yield all joinings for cached items
                    for (const rightItem of rightCacheGroup) {
                        yield { left: leftItem, right: rightItem };
                    }
                }

                // look for more matching right items, caching everything
                for (const rightItem of fromIterator(rightIterator)) {
                    const rightKey = onRight(rightItem);
                    if (is(leftKey, rightKey)) {
                        yield { left: leftItem, right: rightItem };
                    }

                    // cache the value
                    const rightCacheGroup = rightCache.get(rightKey);
                    if (rightCacheGroup !== undefined) {
                        rightCacheGroup.push(rightItem);
                    } else {
                        rightCache.set(rightKey, [rightItem]);
                    }
                }
            }
        });
    } else {
        return from(function* () {
            for (const leftItem of left) {
                const leftKey = onLeft(leftItem);

                for (const rightItem of right) {
                    const rightKey = onRight(rightItem);

                    if (is(leftKey, rightKey)) {
                        yield { left: leftItem, right: rightItem };
                    }
                }
            }
        });
    }
}

export const from = Itmod.from;

export const fromIterator = Itmod.fromIterator;

export const fromObject = Itmod.fromObject;

export const generate = Itmod.generate;

export const of = Itmod.of;

export const range = Itmod.range;

export const empty = Itmod.empty;
