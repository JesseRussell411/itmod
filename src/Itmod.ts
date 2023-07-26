import CircularBuffer from "./collections/CircularBuffer";
import { asArray, asIterable } from "./collections/as";
import {
    isArray,
    isArrayAsWritable,
    isSet,
    isSetAsWritable,
} from "./collections/is";
import {
    cachingIterable as cachedIterable,
    range,
} from "./collections/iterables";
import NeverEndingOperationError from "./errors/NeverEndingOperationError";
import NotImplementedError from "./errors/NotImplementedError";
import { identity, resultOf, returns } from "./functional";
import {
    requireIntegerOrInfinity,
    requireNonNegative,
    requireNonZero,
    requireSafeInteger,
} from "./require";
import { BreakSignal, breakSignal } from "./signals";
import {
    Comparator,
    Order,
    asComparator,
    autoComparator,
    reverseOrder,
} from "./sorting";
import {
    max,
    min,
    nonIteratedCountOrUndefined,
} from "./transformations/iterable";
import { General } from "./types/literals";

export type Comparison =
    | "equals"
    | "lessThan"
    | "greaterThan"
    | "lessThanOrEqualTo"
    | "greaterThanOrEqualTo";

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
        /** Calling the source getter is expensive, ie. it's more than an O(1) operation. */
        expensive: boolean;
        /** Whether the {@link Itmod} is known to never end. False means unknown. */
        infinite: boolean;
    }>
>;

/**
 * Functional wrapper for {@link Iterable}. Provides tranformation functions such as {@link Itmod.map}, {@link Itmod.filter}, {@link Itmod.reduce}, and {@link Itmod.fold};
 */
export default class Itmod<T> implements Iterable<T> {
    /**
     * @returns The {@link Iterable} source.
     */
    public readonly getSource: () => Iterable<T>;
    protected readonly properties: ItmodProperties<T>;

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
     */
    public static from<T>(
        source:
            | Iterable<T>
            | Iterator<T>
            | (() => Iterable<T>)
            | (() => Iterator<T>),
        properties: ItmodProperties<T> = {}
    ): Itmod<T> {
        if (source instanceof Function) {
            return new Itmod(
                { ...properties, expensive: properties.expensive ?? true },
                () => {
                    return asIterable(source());
                }
            );
        } else {
            return new Itmod(properties, returns(asIterable(source)));
        }
    }

    /**
     * @returns An {@link Itmod} over the given items.
     */
    public static of<T>(...items: readonly T[]): Itmod<T> {
        return new Itmod({}, () => items);
    }

    // TODO don't take non enumerable properties, like what Object.entries does
    /**
     * @returns A Itmod over the entries of the given object.
     */
    public static fromObject<K extends keyof any, V>(
        object: Record<K, V> | (() => Record<K, V>),
        {
            includeStringKeys = true,
            includeSymbolKeys = false,
        }: {
            /** Whether to include fields indexed by symbols. Defaults to true. */
            includeSymbolKeys?: boolean;
            /** Whether to include fields indexed by strings. Defaults to true. */
            includeStringKeys?: boolean;
        } = {}
    ): Itmod<[K & (string | symbol), V]> {
        // TODO add inherited values
        const instance = resultOf(object);
        if (includeStringKeys && includeSymbolKeys) {
            return new Itmod({ expensive: true, fresh: true }, () =>
                [
                    ...Object.getOwnPropertyNames(instance),
                    ...Object.getOwnPropertySymbols(instance),
                ].map((key) => [key as any, (instance as any)[key]])
            );
        } else if (includeStringKeys) {
            return new Itmod({ expensive: true, fresh: true }, () =>
                Object.getOwnPropertyNames(instance).map((name) => [
                    name as K & (string | symbol),
                    (instance as any)[name] as V,
                ])
            );
        } else if (includeSymbolKeys) {
            return new Itmod({ expensive: true, fresh: true }, () =>
                Object.getOwnPropertySymbols(instance).map((symbol) => [
                    symbol as K & (string | symbol),
                    (instance as any)[symbol] as V,
                ])
            );
        } else {
            return Itmod.of();
        }
    }

    // TODO docs
    public static generate<T>(count: number | bigint, item: T): Itmod<T>;
    // prettier-ignore
    public static generate<T>(count: bigint, generator: (index: bigint) => T): Itmod<T>;
    // prettier-ignore
    public static generate<T>( count: number, generator: (index: number) => T): Itmod<T>;
    public static generate<T>(
        count: number | bigint,
        generatorOrItem: ((index: number | bigint) => T) | T
    ): Itmod<T> {
        requireNonNegative(requireIntegerOrInfinity(count));

        return new Itmod({ infinite: count === Infinity }, function* () {
            let i = zeroLike(count);
            if (generatorOrItem instanceof Function) {
                for (; i < count; i++) {
                    yield generatorOrItem(i);
                }
            } else {
                for (; i < count; i++) {
                    yield generatorOrItem;
                }
            }
        });
    }

    /**
     * @returns An {@link Itmod} over a range of integers from start to end, incremented by step.
     * @param start The first number in the sequence.
     * @param end Where the range ends (exclusive).
     * @param step How much larger each number in the sequence is from the previous number.
     */
    public static range(
        start: bigint,
        end: bigint,
        step: bigint
    ): Itmod<bigint>;
    /**
     * @returns An {@link Itmod} over a range of integers from start to end, incremented by 1 or -1 if end is less than start.
     * @param start The first number in the sequence.
     * @param end Where the range ends (exclusive).
     */
    public static range(start: bigint, end: bigint): Itmod<bigint>;
    /**
     * @returns An {@link Itmod} over a range of integers from 0 to end, incremented by 1.
     * @param end Where the range ends (exclusive).
     */
    public static range(end: bigint): Itmod<bigint>;

    /**
     * @returns An {@link Itmod} over a range of numbers from start to end, incremented by step.
     * @param start The first number in the sequence.
     * @param end Where the range ends (exclusive).
     * @param step How much larger each number in the sequence is from the previous number.
     */
    public static range(
        start: number | bigint,
        end: number | bigint,
        step: number | bigint
    ): Itmod<number>;
    /**
     * @returns An {@link Itmod} over a range of numbers from start to end, incremented by 1 or -1 if end is less than start.
     * @param start The first number in the sequence.
     * @param end Where the range ends (exclusive).
     */
    public static range(
        start: number | bigint,
        end: number | bigint
    ): Itmod<number>;
    /**
     * @returns An {@link Itmod} over a range of numbers from 0 to end, incremented by 1.
     * @param end Where the range ends (exclusive).
     */
    public static range(end: number | bigint): Itmod<number>;

    public static range(
        _startOrEnd: number | bigint,
        _end?: number | bigint,
        _step?: number | bigint
    ): Itmod<number> | Itmod<bigint> {
        if (_end === undefined) {
            const end = _startOrEnd;
            return new Itmod(
                { infinite: end === Infinity },
                returns(range(end))
            );
        } else if (_step === undefined) {
            const start = _startOrEnd;
            const end = _end;
            return new Itmod(
                { infinite: end === Infinity },
                returns(range(start, end))
            );
        } else {
            const start = _startOrEnd;
            const end = _end;
            const step = _step;
            return new Itmod(
                {
                    infinite:
                        (step > 0 && end === Infinity) ||
                        (step < 0 && end === -Infinity),
                },
                returns(range(start, end, step))
            );
        }
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
        return function map<R>(mapping: (value: T, index: number) => R) {
            return new Itmod(
                { infinite: self.properties.infinite },
                function* () {
                    let i = 0;
                    for (const value of self) {
                        yield mapping(value, i);
                        i++;
                    }
                }
            );
        };
    }

    /**
     * Filters out items that don't pass the test.
     * @param Test for each item. Items that make this function return true are kept. The rest are skipped.
     */
    public get filter() {
        const self = this;
        return function filter<R extends T = T>(
            test: (value: T, index: number) => boolean
        ): Itmod<R> {
            return new Itmod(
                { infinite: self.properties.infinite },
                function* () {
                    let i = 0;
                    for (const value of self) {
                        if (test(value, i)) yield value as R;
                        i++;
                    }
                }
            );
        };
    }

    public get reduce(): {
        /**
         * Combines all the items into one using the given reducer function.
         * @param reducer Combines each item with the accumulating result, starting with the first two items.
         */
        <R = General<T>>(
            reducer: (
                /** The accumulating result. Equal to the returned value from the previous item. */
                accumulator: R | T,
                /** The current value to add onto the result. */
                value: T,
                /** The index of the current value. */
                index: number
            ) => R
        ): R;
        /**
         * Combines all the items into one using the given reducer function.
         * @param reducer Combines each item with the accumulating result, starting with the first two items.
         * @param finalizer Called after the result is collected to perform any final modifications.
         */
        <F, R = General<T>>(
            reducer: (
                /** The accumulating result. Equal to the returned value from the previous item. */
                accumulator: R | T,
                /** The current value to add onto the result. */
                value: T,
                /** The index of the current value. */
                index: number
            ) => R,
            finalize: (
                /** The final result of the reducer. */
                result: R | undefined,
                /** How many items were in the {@link Iterable}. */
                count: number
            ) => F
        ): F;
    } {
        const self = this;
        return function reduce(
            reducer: (accumulator: any, value: T, index: number) => any,
            finalize: (result: any, count: number) => any = identity
        ): any {
            const source = self.getSource();

            // array optimization
            if (isArray(source)) {
                if (source.length === 0) {
                    return finalize(undefined, 0);
                } else {
                    return finalize(source.reduce(reducer), source.length);
                }
            }

            const iterator = source[Symbol.iterator]();
            let next = iterator.next();
            if (next.done) {
                return finalize(undefined, 0);
            }

            let accumulator = next.value;
            let i = 1;
            while (!(next = iterator.next()).done) {
                accumulator = reducer(accumulator, next.value, i);
                i++;
            }
            const count = i;

            return finalize(accumulator, count);
        };
    }

    public get fold(): {
        /**
         * Combines all the items into one using the given reducer function and initial value.
         * @param reducer Combines each item with the accumulating result, starting with the initial value and the first item.
         */
        <R>(
            initialValue: R,
            reducer: (accumulator: R, value: T, index: number) => R
        ): R;
        /**
         * Combines all the items into one using the given reducer function and initial value.
         * @param reducer Combines each item with the accumulating result, starting with the initial value and the first item.
         * @param finalizer Called after the result is collected to perform any final modifications.
         */
        <R, F>(
            initialValue: R,
            reducer: (accumulator: R, value: T, index: number) => R,
            finalize: (result: R, count: number) => F
        ): F;
    } {
        const self = this;
        return function fold(
            initialValue: any,
            reducer: (accumulator: any, value: T, index: number) => any,
            finalize: (result: any, count: number) => any = identity
        ) {
            const source = self.getSource();

            // array optimization
            if (isArray(source)) {
                if (source.length === 0) {
                    return finalize(initialValue, 0);
                } else {
                    return finalize(
                        source.reduce(reducer, initialValue),
                        source.length
                    );
                }
            }

            const iterator = source[Symbol.iterator]();
            let next = iterator.next();
            if (next.done) {
                return finalize(initialValue, 0);
            }

            let accumulator = initialValue;
            let i = 0;
            while (!(next = iterator.next()).done) {
                accumulator = reducer(accumulator, next.value, i);
                i++;
            }
            const count = i;

            return finalize(accumulator, count);
        };
    }

    /**
     * Concatenates the given {@link Iterable} onto the end of the {@link Itmod}'s iterable.
     */
    public get concat() {
        const self = this;
        return function concat<O>(other: Iterable<O>): Itmod<T | O> {
            return new Itmod(
                { infinite: self.properties.infinite },
                function* () {
                    yield* self;
                    yield* other;
                }
            );
        };
    }
    /**
     * Concatenates the given {@link Iterable} onto the start of the {@link Itmod}'s iterable.
     */
    public get preConcat() {
        const self = this;
        return function preConcat<O>(other: Iterable<O>): Itmod<T | O> {
            return new Itmod(
                { infinite: self.properties.infinite },
                function* () {
                    yield* other;
                    yield* self;
                }
            );
        };
    }

    /**
     * Reverses the items in the {@link Itmod}.
     */
    public get reverse() {
        this.requireSelfNotInfinite(
            "cannot reverse an infinite number of values"
        );

        const self = this;
        return function reverse(): Itmod<T> {
            return new Itmod(
                { infinite: self.properties.infinite },
                function* () {
                    const source = self.getSource();
                    const array = asArray(source);
                    for (let i = array.length - 1; i >= 0; i--) {
                        yield array[i] as T;
                    }
                }
            );
        };
    }

    /**
     * Repeats the items the given number of times.
     * @param times How many times to repeat the items. Negative number also reverse the items. 0 returns an empty {@link Itmod}.
     */
    public get repeat() {
        const self = this;
        return function repeat(times: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(times);
            if (times < 0) {
                return self.reverse().repeat(-times);
            }

            if (self.properties.infinite) {
                return self;
            }

            if (times === Infinity) {
                return new Itmod({ infinite: true }, function* () {
                    const source = self.getSource();

                    const cached = isSolid(source)
                        ? source
                        : cachedIterable(source);

                    while (true) {
                        yield* cached;
                    }
                });
            }

            return new Itmod({}, function* () {
                const source = self.getSource();
                const cached = isArray(source)
                    ? source
                    : cachedIterable(source);
                for (let i = zeroLike(times); i < times; i++) {
                    yield* cached;
                }
            });
        };
    }

    /**
     * Keeps the first given number of items, skipping the rest.
     */
    public get take() {
        const self = this;
        const externalTake = take;
        return function take(count: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(requireNonZero(count));
            return new Itmod({}, () => externalTake(count, self.getSource()));
        };
    }

    /**
     * Skips the first given number of items, keeping the rest.
     */
    public get skip() {
        const self = this;
        const externalSkip = skip;
        return function skip(count: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(requireNonZero(count));
            return new Itmod({}, () => externalSkip(count, self.getSource()));
        };
    }

    /**
     * Takes the final given number of items, skipping the preceding items.
     */
    public get takeFinal() {
        const self = this;
        const externalTakeFinal = takeFinal;
        return function takeFinal(count: number | bigint) {
            requireIntegerOrInfinity(requireNonNegative(count));
            return new Itmod({}, () =>
                externalTakeFinal(count, self.getSource())
            );
        };
    }

    /**
     * Skips the final given number of items, skipping the preceding items.
     */
    public get skipFinal() {
        const self = this;
        const externalSkipFinal = skipFinal;
        return function skipFinal(count: number | bigint) {
            requireIntegerOrInfinity(requireNonNegative(count));
            return new Itmod({}, () =>
                externalSkipFinal(count, self.getSource())
            );
        };
    }

    /**
     * @deprecated not implemented yet
     */
    public get takeSparse() {
        throw new NotImplementedError();
    }

    /**
     * @deprecated not implemented yet
     */
    public get skipSparse() {
        throw new NotImplementedError();
    }

    /**
     * Attempts to determine how many items are in the {@link Iterable} without iterating it.
     * @returns The number of items or undefined if it couldn't be determined.
     */
    public get nonIteratedCountOrUndefined() {
        const self = this;
        const externalNonIteratedCountOrUndefined = nonIteratedCountOrUndefined;
        return function nonIteratedCountOrUndefined() {
            if (self.properties.expensive) return undefined;
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
            const source = self.getSource();
            const nonIteratedCount = nonIteratedCountOrUndefined(source);
            if (nonIteratedCount !== undefined) {
                return nonIteratedCount;
            }

            let count = 0;
            for (const _ of source) count++;

            return count;
        };
    }

    /**
     * @returns The smallest given number of items.
     * @param count How many items to return.
     * @param order How to sort the items.
     */
    public get min() {
        this.requireSelfNotInfinite(
            "cannot get the smallest of infinite values"
        );
        const self = this;
        const externalMin = min;
        return function min(
            count: number | bigint,
            order: Order<T> = autoComparator
        ) {
            requireSafeInteger(requireNonNegative(count));
            return new Itmod({}, () => externalMin(self, count, order));
        };
    }

    /**
     * @returns The smallest given number of items.
     * @param count How many items to return.
     * @param order How to sort the items.
     */
    public get max() {
        this.requireSelfNotInfinite(
            "cannot get the largest of infinite values"
        );
        const self = this;
        const externalMax = max;
        return function max(
            count: number | bigint,
            order: Order<T> = autoComparator
        ) {
            requireSafeInteger(requireNonNegative(count));
            return new Itmod({}, () => externalMax(self, count, order));
        };
    }

    /**
     * Copies all the items into an {@link Array}.
     */
    public get toArray() {
        const self = this;
        return function toArray(): T[] {
            const source = self.getSource();
            if (self.properties.fresh && isArrayAsWritable(source)) {
                return source;
            } else {
                return [...source];
            }
        };
    }

    /**
     * Copies all the items into a {@link Set}.
     */
    public get toSet() {
        const self = this;
        return function toSet(): Set<T> {
            const source = self.getSource();
            if (self.properties.fresh && isSetAsWritable(source)) {
                return source;
            } else {
                return new Set(source);
            }
        };
    }

    /**
     * If the {@link Iterable} is an {@link Array}, returns that {@link Set} as readonly; otherwise, copies all the items into an {@link Array} and returns that.
     */
    public get asArray() {
        const self = this;
        return function toArray(): readonly T[] {
            const source = self.getSource();
            if (isArray(source)) {
                return source;
            } else {
                return [...source];
            }
        };
    }

    /**
     * If the {@link Iterable} is a {@link Set}, returns that {@link Set}] as readonly; otherwise, copies all the items into a {@link Set} and returns that.
     */
    public get asSet() {
        const self = this;
        return function toSet(): ReadonlySet<T> {
            const source = self.getSource();
            if (isSet(source)) {
                return source;
            } else {
                return new Set(source);
            }
        };
    }

    /**
     * Sorts the items.
     * @param orders How to sort the items. Defaults to {@link autoComparator}.
     */
    public get sort() {
        const self = this;
        return function sort(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(
                self.properties,
                self.getSource,
                orders.length === 0 ? [autoComparator] : orders
            );
        };
    }

    /**
     * Sorts the items in descending order.
     * @param orders How to sort the items. Defaults to {@link autoComparator}.
     */
    public get sortDescending() {
        const self = this;
        return function sort(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(
                self.properties,
                self.getSource,
                orders.length === 0 ? [reverseOrder(autoComparator)] : orders
            );
        };
    }

    /**
     * Requires the {@link Itmod} to not be known to be infinite.
     */
    private requireSelfNotInfinite(errorMessage: string | (() => string)) {
        if (this.properties.infinite) {
            throw new NeverEndingOperationError(resultOf(errorMessage));
        }
    }
}

/**
 * {@link Itmod} With a mapping applied to its items. The result of {@link Itmod.map}.
 */
export class MappedItmod<T, R> extends Itmod<R> {
    protected readonly mapping: (value: T, index: number) => R;
    protected readonly originalGetSource: () => Iterable<T>;
    protected readonly originalProperties: ItmodProperties<T>;

    public constructor(
        properties: ItmodProperties<T>,
        getSource: () => Iterable<T>,
        mapping: (value: T, index: number) => R
    ) {
        super({ infinite: properties.infinite }, function* () {
            const source = getSource();
            let i = 0;
            for (const value of source) {
                yield mapping(value, i);
                i++;
            }
        });
        this.mapping = mapping;
        this.originalGetSource = getSource;
        this.originalProperties = properties;
    }

    public get skip() {
        const self = this;
        return function skip(count: number | bigint) {
            requireNonNegative(requireIntegerOrInfinity(count));
            return new Itmod({}, function* () {
                const source = self.originalGetSource();
                if (isArray(source)) {
                    for (let i = Number(count); i < source.length; i++) {
                        yield self.mapping(source[i] as T, i);
                    }
                } else {
                    const iterator = source[Symbol.iterator]();
                    let next = iterator.next();
                    let i = 0;
                    for (; i < count; i++) {
                        if (next.done) return;
                        next = iterator.next();
                    }

                    while (!next.done) {
                        yield self.mapping(next.value, i);
                        next = iterator.next();
                        i++;
                    }
                }
            });
        };
    }

    public get takeSparse() {
        throw new NotImplementedError();
    }

    public get skipSparse() {
        throw new NotImplementedError();
    }
}

/**
 * An {@link Itmod} with a sort applied to its items. The result of {@link Itmod.sort}.
 */
export class SortedItmod<T> extends Itmod<T> {
    private readonly orders: readonly Order<T>[];
    private readonly comparator: Comparator<T>;
    private readonly originalGetSource: () => Iterable<T>;
    private readonly originalProperties: ItmodProperties<T>;
    public constructor(
        properties: ItmodProperties<T>,
        getSource: () => Iterable<T>,
        orders: readonly Order<T>[],
        { preSorted = false }: { preSorted?: boolean } = {}
    ) {
        super(
            preSorted !== undefined
                ? properties
                : { fresh: true, expensive: true },
            preSorted
                ? getSource
                : () => {
                      const source = getSource();
                      const array =
                          properties.fresh && isArrayAsWritable(source)
                              ? source
                              : [...source];

                      array.sort(comparator);

                      return array;
                  }
        );

        this.orders = orders;
        this.originalGetSource = getSource;
        this.originalProperties = properties;

        const comparators = orders.map(asComparator);
        const comparator = (a: T, b: T) => {
            for (const comparator of comparators) {
                const cmp = comparator(a, b);
                if (cmp !== 0) return cmp;
            }
            return 0;
        };
        this.comparator = comparator;
    }

    // public get take(count: number | bigint) {
    //     const self = this;
    //     const externalTake = take;
    //     return function take() {
    //         return new Itmod({}, )
    //     }
    // }

    // public get skip() {
    //     const skip = (count: number | bigint): SortedItmod<T> => {
    //         // TODO do this better
    //         requireNonNegative(requireIntegerOrInfinity(count));
    //         const sourceCount = this.nonIteratedCountOrUndefined();
    //         if (sourceCount !== undefined) {
    //             if (count >= sourceCount)
    //                 return new SortedItmod(
    //                     { fresh: true },
    //                     () => [],
    //                     this.orders,
    //                     { preSorted: true }
    //                 );
    //             return this.takeFinal(
    //                 typeof count === "bigint"
    //                     ? BigInt(sourceCount) - count
    //                     : sourceCount - count
    //             );
    //         } else {
    //             return new SortedItmod({}, () => super.skip(count), );
    //         }
    //     };
    //     return skip;
    // }

    // public get take() {
    //     const self = this;
    //     return function take(count: number | bigint): SortedItmod<T> {
    //         requireNonNegative(requireIntegerOrInfinity(count));
    //         return new SortedItmod<T>(
    //             { fresh: true, expensive: true },
    //             () => min(self, count, self.comparator),
    //             self.orders,
    //             { preSorted: true }
    //         );
    //     };
    // }

    // public get takeFinal() {
    //     const self = this;
    //     return function takeFinal(count: number | bigint): SortedItmod<T> {
    //         requireNonNegative(requireIntegerOrInfinity(count));
    //         return new SortedItmod<T>(
    //             { fresh: true, expensive: true },
    //             () => max(self, count, self.comparator),
    //             self.orders,
    //             { preSorted: true }
    //         );
    //     };
    // }

    /**
     * Adds more fallback sorts to the {@link SortedItmod}.
     */
    public get thenBy() {
        const self = this;
        return function thenBy(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(
                self.originalProperties,
                self.originalGetSource,
                [...self.orders, ...orders]
            );
        };
    }

    /**
     * Adds more fallback sorts to the {@link SortedItmod} in descending order.
     */
    public get thenByDescending() {
        const self = this;
        return function thenBy(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(
                self.originalProperties,
                self.originalGetSource,
                [...self.orders, ...orders.map(reverseOrder)]
            );
        };
    }
}

function take<T>(count: number | bigint, source: Iterable<T>): Iterable<T> {
    requireIntegerOrInfinity(requireNonNegative(count));
    if (count === Infinity) return source;

    const size = nonIteratedCountOrUndefined(source);
    if (size !== undefined) {
        if (count >= size) return source;
    }

    return {
        *[Symbol.iterator]() {
            const iterator = source[Symbol.iterator]();
            for (let i = zeroLike(count); i < count; i++) {
                const next = iterator.next();
                if (next.done) break;

                yield next.value;
            }
        },
    };
}

function skip<T>(count: number | bigint, source: Iterable<T>): Iterable<T> {
    requireIntegerOrInfinity(requireNonNegative(count));
    if (count === 0 || count === 0n) return source;
    if (count === Infinity) return [];

    return {
        *[Symbol.iterator]() {
            if (isArray(source)) {
                const numberCount = Number(count);
                if (numberCount === Infinity) return [];
                for (let i = Number(count); i < source.length; i++) {
                    yield source[i] as T;
                }
            } else {
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
            }
        },
    };
}

function takeFinal<T>(
    count: number | bigint,
    source: Iterable<T>
): Iterable<T> {
    requireIntegerOrInfinity(requireNonNegative(count));
    if (count === Infinity) return source;
    if (count === 0 || count === 0n) return [];

    const size = nonIteratedCountOrUndefined(source);
    if (size !== undefined) {
        if (count >= size) return source;
        return skip(size - Number(count), source);
    }

    const buffer = new CircularBuffer<T>(Number(count));
    for (const value of source) {
        buffer.push(value);
    }

    return buffer;
}

function skipFinal<T>(
    count: number | bigint,
    source: Iterable<T>
): Iterable<T> {
    requireIntegerOrInfinity(requireNonNegative(count));
    if (count === Infinity) return [];
    if (count === 0 || count === 0n) return source;

    const size = nonIteratedCountOrUndefined(source);
    if (size !== undefined) {
        if (count >= size) return [];
        return take(size - Number(count), source);
    }

    return {
        *[Symbol.iterator]() {
            const buffer = new CircularBuffer<T>(Number(count));
            let i = zeroLike(count);
            for (const item of source) {
                buffer.unshift(item);
                if (i >= count) {
                    yield buffer.at(0)!;
                } else {
                    i++;
                }
            }
        },
    };
}

function zeroLike<N extends number | bigint>(n: N): N extends number ? 0 : 0n {
    if (typeof n === "number") {
        return 0 as any;
    } else {
        return 0n as any;
    }
}

function isSolid<T>(
    iterable: Iterable<T>
): iterable is ReadonlyArray<T> | ReadonlySet<T> {
    return isArray(iterable) || isSet(iterable);
}
