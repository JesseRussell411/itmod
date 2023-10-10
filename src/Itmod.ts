import CircularBuffer from "./collections/CircularBuffer";
import Collection from "./collections/Collection";
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
    cachingIterable as cachedIterable,
    emptyIterable,
    nonIteratedCountOrUndefined,
    range,
} from "./collections/iterables";
import { toArray, toSet } from "./collections/to";
import NeverEndingOperationError from "./errors/NeverEndingOperationError";
import { identity, resultOf, returns } from "./functional/functions";
import {
    requireGreaterThanZero,
    requireIntegerOrInfinity,
    requireNonNegative,
    requireSafeInteger,
    requireSafeIntegerOrInfinity,
} from "./require";
import { BreakSignal, breakSignal } from "./signals";
import {
    Comparator,
    Field,
    FieldSelector,
    Order,
    asComparator,
    autoComparator,
    reverseOrder,
} from "./sorting";
import MapEntryLike from "./types/MapEntryLike";
import { General } from "./types/literals";

// TODO unit tests

// TODO? remove infinite flag; probably not worth it.

// TODO join, leftJoin, groupJoin, takeSparse, skipSparse, ifEmpty, partition by count

// TODO? RangeItmod for efficient take, takeFinal, skip, skipFinal, takeEveryNth operations. Result of Itmod.range()
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
 * Functional wrapper for {@link Iterable}. Provides transformation functions such as {@link Itmod.map}, {@link Itmod.filter}, {@link Itmod.reduce}, and {@link Itmod.fold};
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

    /**
     * @returns An empty {@link Itmod} of the given type.
     */
    public static empty<T>(): Itmod<T> {
        return _emptyItmod;
    }

    // TODO don't take non enumerable properties, like what Object.entries does
    /**
     * @returns A Itmod over the entries of the given object.
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
            ) as any;
        } else if (includeSymbolKeys) {
            return new Itmod({ expensive: true, fresh: true }, () =>
                Object.getOwnPropertySymbols(instance).map((symbol) => [
                    symbol as K & (string | symbol),
                    (instance as any)[symbol] as V,
                ])
            ) as any;
        } else {
            return Itmod.of();
        }
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
        return function map<R>(
            mapping: (value: T, index: number) => R
        ): Itmod<R> {
            return new MappedItmod(self.properties, self.getSource, mapping);
        };
    }

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

    public get defined() {
        const self = this;
        return function defined(): Itmod<T extends undefined ? never : T> {
            return self.filter((item) => item !== undefined);
        };
    }

    public get notNull() {
        const self = this;
        return function notNull(): Itmod<T extends null ? never : T> {
            return self.filter((item) => item !== null);
        };
    }

    public get zip() {
        const self = this;
        return function zip<O>(
            other: Iterable<O>,
            {
                loose = true,
            }: {
                /**
                 * Whether to include any remaining element if the itmod and the iterable are not the same length.
                 * @default true
                 */
                loose?: boolean;
            } = {}
        ): Itmod<T | O> {
            return new Itmod({}, function* () {
                const iterator = self[Symbol.iterator]();
                const iteratorOther = other[Symbol.iterator]();
                let next = iterator.next();
                let nextOther = iteratorOther.next();

                // really unnecessary but this way next.done only gets pulled once, which might be a good idea if next is designed poorly.
                let nextDone = next.done;
                let nextDoneOther = nextOther.done;

                while (!(nextDone || nextDoneOther)) {
                    yield next.value;
                    yield nextOther.value;

                    next = iterator.next();
                    nextOther = iteratorOther.next();
                    nextDone = next.done;
                    nextDoneOther = nextOther.done;
                }

                if (loose) {
                    while (!nextDone) {
                        yield next.value;
                        next = iterator.next();
                        nextDone = next.done;
                    }

                    while (!nextDoneOther) {
                        yield nextOther.value;
                        nextOther = iteratorOther.next();
                        nextDoneOther = nextOther.done;
                    }
                }
            });
        };
    }

    public get reduce(): {
        /**
         * Combines all the items into one using the given reducer function.
         * @param reducer Combines each item with the accumulating result, starting with the first two items.
         * @returns The final result of the reducer, unless the itmod was empty, then undefined is returned.
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
        ): R | undefined;
        /**
         * Combines all the items into one using the given reducer function.
         * @param reducer Combines each item with the accumulating result, starting with the first two items.
         * @param finalizer Called after the result is collected to perform any final modifications. Not called if the itmod was empty.
         * @returns The result of the finalizer unless the itmod was empty, then undefined is returned.
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

            const iterator = source[Symbol.iterator]();
            let next = iterator.next();
            if (next.done) {
                return undefined;
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

            let accumulator = initialValue;
            let i = 0;
            const iterator = source[Symbol.iterator]();
            let next: IteratorResult<T>;
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
                    const array = self.asArray();
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
            if (typeof times === "number") requireSafeInteger(times);
            if (times === 0) return Itmod.empty();
            if (times < 0) {
                return self.reverse().repeat(-times);
            }

            if (self.properties.infinite) {
                // source is infinite
                return self;
            }

            if (times === Infinity) {
                // repeat infinite times
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
                const cached = isSolid(source)
                    ? source
                    : cachedIterable(source);
                for (let i = zeroLike(times); i < times; i++) {
                    yield* cached;
                }
            });
        };
    }

    /**
     * @returns The first item or undefined if the source is empty.
     */
    public get first() {
        const self = this;
        return function first() {
            for (const item of self) return item;
            return undefined;
        };
    }

    public get distinct() {
        const self = this;
        return function distinct(id: (item: T) => any = identity) {
            return new Itmod({}, function* () {
                const source = self.getSource();

                if (id === identity && isSet(source)) yield* source;

                const returned = new Set<T>();
                for (const item of source) {
                    const itemId = id(item);

                    if (!returned.has(itemId)) {
                        yield item;
                        returned.add(itemId);
                    }
                }
            });
        };
    }

    public get including(): {
        (other: Iterable<T>): Itmod<T>;
        <O>(other: Iterable<O>, id: (item: T | O) => any): Itmod<T | O>;
    } {
        const self = this;
        return function including<O>(
            other: Iterable<O>,
            id?: (item: T | O) => any
        ): Itmod<T | O> {
            if (self.properties.infinite) return self as Itmod<T | O>;
            if (other instanceof Itmod && other.properties.infinite) {
                return new Itmod({ infinite: true }, function* () {
                    yield* self;
                    yield* other;
                });
            }
            if (id === undefined) {
                return new Itmod({}, function* () {
                    const toInclude = new Set(other);
                    for (const item of self) {
                        yield item;
                        toInclude.delete(item as any);
                    }
                    yield* toInclude;
                });
            } else {
                return new Itmod({}, function* () {
                    const toInclude = new Map<any, O>();
                    for (const item of other) {
                        toInclude.set(id(item), item);
                    }
                    for (const item of self) {
                        yield item;
                        toInclude.delete(id(item));
                    }
                    yield* toInclude.values();
                });
            }
        };
    }

    /**
     * Keeps the first given number of items, skipping the rest.
     */
    public get take() {
        const self = this;
        const externalTake = take;
        return function take(count: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(requireNonNegative(count));
            return new Itmod(
                {
                    fresh: self.properties.expensive,
                    expensive: self.properties.expensive,
                },
                () => {
                    const source = self.getSource();

                    // optimization for fresh array
                    if (self.properties.fresh && isArrayAsWritable(source)) {
                        source.length = Math.min(source.length, Number(count));
                        return source;
                    }

                    return externalTake(count, source);
                }
            );
        };
    }

    /**
     * Skips the first given number of items, keeping the rest.
     */
    public get skip() {
        const self = this;
        const externalSkip = skip;
        return function skip(count: number | bigint): Itmod<T> {
            requireIntegerOrInfinity(requireNonNegative(count));
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
     * Skips the final given number of items, taking the preceding items.
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

    public get takeEveryNth() {
        const externalTakeEveryNth = takeEveryNth;
        const self = this;
        return function takeEveryNth(n: number | bigint): Itmod<T> {
            return new Itmod<T>(
                { infinite: self.properties.infinite && n !== Infinity },
                () => externalTakeEveryNth(n, self.getSource())
            );
        };
    }

    public get takeWhile() {
        const externalTakeWhile = takeWhile;
        const self = this;
        return function takeWhile(
            condition: (item: T, index: number) => boolean
        ): Itmod<T> {
            return new Itmod(
                {
                    fresh: self.properties.fresh,
                    expensive: self.properties.expensive,
                },
                () => {
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

                    return externalTakeWhile(condition, source);
                }
            );
        };
    }

    public get takeRandom() {
        const externalTakeRandom = takeRandom;
        const self = this;
        return function takeRandom(
            count: number | bigint,
            getRandomInt?: (upperBound: number) => number
        ) {
            requireIntegerOrInfinity(requireNonNegative(count));
            return new Itmod(
                { infinite: self.properties.infinite && count === Infinity },
                () => externalTakeRandom(count, self.getSource(), getRandomInt)
            );
        };
    }

    public get skipEveryNth() {
        const externalSkipEveryNth = skipEveryNth;
        const self = this;
        return function skipEveryNth(n: number | bigint): Itmod<T> {
            return new Itmod<T>({ infinite: self.properties.infinite }, () =>
                externalSkipEveryNth(n, self.getSource())
            );
        };
    }

    public get skipWhile() {
        const externalSkipWhile = skipWhile;
        const self = this;
        return function skipWhile(
            condition: (item: T, index: number) => boolean
        ): Itmod<T> {
            return new Itmod({}, () =>
                externalSkipWhile(self.getSource(), condition)
            );
        };
    }

    public get skipRandom() {
        const externalSkipRandom = skipRandom;
        const self = this;
        return function skipRandom(
            count: number | bigint,
            getRandomInt?: (upperBound: number) => number
        ) {
            requireIntegerOrInfinity(requireNonNegative(count));
            return new Itmod(
                { infinite: self.properties.infinite && count === Infinity },
                () => externalSkipRandom(count, self.getSource(), getRandomInt)
            );
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
            return new Itmod({ expensive: true, fresh: true }, () => {
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

    public get indexed() {
        const self = this;
        return function indexed(): MappedItmod<T, [index: number, item: T]> {
            return self.map((item, index) => [index, item]);
        };
    }

    public get includes() {
        const self = this;
        return function includes(item: T): boolean {
            const source = self.getSource();
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

    public get some() {
        const self = this;
        return function some(condition: (item: T, index: number) => boolean) {
            let i = 0;
            for (const item of self) {
                if (condition(item, i)) return true;
                i++;
            }
            return false;
        };
    }

    public get every() {
        const self = this;
        return function every(condition: (item: T, index: number) => boolean) {
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
            "cannot get the largest of infinite values"
        );
        const self = this;
        return function min(
            count: number | bigint,
            order: Order<T> = autoComparator
        ): Itmod<T> {
            requireSafeIntegerOrInfinity(requireNonNegative(count));
            if (isZero(count)) return Itmod.empty<T>();
            if (count === Infinity) return self.sort(order);

            return new Itmod({ fresh: true, expensive: true }, () => {
                const source = self.getSource();

                const result = new SortedSequence<T>(order, {
                    maxSize: Number(count),
                    keep: "least",
                });

                result.pushMany(source);

                return result;
            });
        };
    }

    /**
     * @returns The largest given number of items.
     * @param count How many items to return.
     * @param order How to sort the items.
     */
    public get max() {
        this.requireSelfNotInfinite(
            "cannot get the largest of infinite values"
        );
        const self = this;
        return function max(
            count: number | bigint,
            order: Order<T> = autoComparator
        ): Itmod<T> {
            requireSafeIntegerOrInfinity(requireNonNegative(count));
            if (isZero(count)) return Itmod.empty<T>();
            if (count === Infinity) return self.sort(order);

            return new Itmod({ fresh: true, expensive: true }, () => {
                const source = self.getSource();

                const result = new SortedSequence<T>(order, {
                    maxSize: Number(count),
                    keep: "greatest",
                });

                result.pushMany(source);

                return result;
            });
        };
    }

    public get groupBy(): {
        <K>(keySelector: (item: T, index: number) => K): Itmod<
            [key: K, group: T[]]
        >;
        <K, G>(
            keySelector: (item: T, index: number) => K,
            groupSelector: (group: T[]) => G
        ): Itmod<[key: K, group: G]>;
    } {
        const self = this;
        return function groupBy<K>(
            keySelector: (item: T, index: number) => K,
            groupSelector?: (group: T[]) => any
        ): Itmod<[key: K, group: any]> {
            return new Itmod({ expensive: true, fresh: true }, () => {
                const groups = new Map<K, any>();

                let i = 0;

                for (const item of self) {
                    const key = keySelector(item, i);
                    const group = groups.get(key) as T[];
                    if (group !== undefined) {
                        group.push(item);
                    } else {
                        groups.set(key, [item]);
                    }
                    i++;
                }

                if (groupSelector !== undefined) {
                    for (const entry of groups) {
                        const group = groupSelector(entry[1]);
                        groups.set(entry[0], group);
                    }
                }

                return groups;
            });
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
                { infinite: self.properties.infinite },
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

            if (
                size === Infinity ||
                (selfSize !== undefined && selfSize < size)
            ) {
                return new Itmod({}, function* () {
                    yield self.toArray();
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

    /**
     * Copies all the items into an {@link Array}.
     */
    public get toArray() {
        this.requireSelfNotInfinite("cannot copy infinite items into an array");
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
        this.requireSelfNotInfinite("cannot copy infinite items into a set");
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
         * @returns A {@link Map} of the items in the itmod.
         */
        (): T extends MapEntryLike<infer K, infer V>
            ? Map<K, V>
            : Map<unknown, unknown>;
        /**
         * @returns A {@link Map} of the items in the itmod.
         * @param keySelector Returns the key to use in the map entry for each item.
         */
        <K>(
            keySelector: (item: T, index: number) => K,
            valueSelector?: undefined
        ): T extends MapEntryLike<any, infer V> ? Map<K, V> : Map<K, unknown>;
        /**
         * @returns A {@link Map} of the items in the itmod.
         * @param valueSelector Returns the value to use in the map entry for each item.
         */
        <V>(
            keySelector: undefined,
            valueSelector: (item: T, index: number) => V
        ): T extends MapEntryLike<infer K, any> ? Map<K, V> : Map<unknown, V>;
        /**
         * @returns A {@link Map} of the items in the itmod.
         * @param keySelector Returns the key to use in the map entry for each item.
         * @param valueSelector Returns the value to use in the map entry for each item.
         */
        <K, V>(
            keySelector: (item: T, index: number) => K,
            valueSelector: (item: T, index: number) => V
        ): Map<K, V>;
    } {
        this.requireSelfNotInfinite("cannot copy infinite items into a map");
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
        this.requireSelfNotInfinite(
            "cannot copy infinite items into an object"
        );
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

    /**
     * If the {@link Iterable} is an {@link Array}, returns that {@link Set} as readonly; otherwise, copies all the items into an {@link Array} and returns that.
     */
    public get asArray() {
        this.requireSelfNotInfinite(
            "cannot represent infinite items as an array"
        );
        const self = this;
        const externalAsArray = asArray;
        return function asArray(): readonly T[] {
            const source = self.getSource();
            return externalAsArray(source);
        };
    }

    /**
     * If the {@link Iterable} is a {@link Set}, returns that {@link Set}] as readonly; otherwise, copies all the items into a {@link Set} and returns that.
     */
    public get asSet() {
        this.requireSelfNotInfinite("cannot represent infinite items as a set");
        const self = this;
        const externalAsSet = asSet;
        return function asSet(): ReadonlySet<T> {
            const source = self.getSource();
            return externalAsSet(source);
        };
    }

    public get asMap(): {
        /** @returns A {@link ReadonlyMap} view of the itmod. */
        (): T extends MapEntryLike<infer K, infer V>
            ? ReadonlyMap<K, V>
            : ReadonlyMap<unknown, unknown>;
        /**
         * @returns A {@link ReadonlyMap} view of the itmod.
         * @param keySelector Returns the key to use in the map entry for each item.
         */
        <K>(
            keySelector: (item: T, index: number) => K,
            valueSelector?: undefined
        ): T extends MapEntryLike<any, infer V>
            ? ReadonlyMap<K, V>
            : ReadonlyMap<K, unknown>;
        /**
         * @returns A {@link ReadonlyMap} view of the itmod.
         * @param valueSelector Returns the value to use in the map entry for each item.
         */
        <V>(
            keySelector: undefined,
            valueSelector: (item: T, index: number) => V
        ): T extends MapEntryLike<infer K, any>
            ? ReadonlyMap<K, V>
            : ReadonlyMap<unknown, V>;
        /**
         * @returns A {@link ReadonlyMap} view of the itmod.
         * @param keySelector Returns the key to use in the map entry for each item.
         * @param valueSelector Returns the value to use in the map entry for each item.
         */
        <K, V>(
            keySelector: (item: T, index: number) => K,
            valueSelector: (item: T, index: number) => V
        ): ReadonlyMap<K, V>;
    } {
        this.requireSelfNotInfinite("cannot represent infinite items as a map");
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
        this.requireSelfNotInfinite(
            "cannot represent infinite items as an object"
        );
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
        (order: Comparator<T>): SortedItmod<T>;
        (order: FieldSelector<T>): SortedItmod<T>;
        (order: Field<T>): SortedItmod<T>;
        (...orders: (Comparator<T> | Field<T>)[]): SortedItmod<T>;
        (...orders: (FieldSelector<T> | Field<T>)[]): SortedItmod<T>;
        (...orders: Order<T>[]): SortedItmod<T>;
    } {
        this.requireSelfNotInfinite("cannot sort infinite items");
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
    public get sortDescending(): {
        (order: Comparator<T>): SortedItmod<T>;
        (order: FieldSelector<T>): SortedItmod<T>;
        (order: Field<T>): SortedItmod<T>;
        (...orders: (Comparator<T> | Field<T>)[]): SortedItmod<T>;
        (...orders: (FieldSelector<T> | Field<T>)[]): SortedItmod<T>;
        (...orders: Order<T>[]): SortedItmod<T>;
    } {
        this.requireSelfNotInfinite("cannot sort infinite items");
        const self = this;
        return function sortDescending(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(
                self.properties,
                self.getSource,
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
        this.requireSelfNotInfinite("cannot shuffle infinite items");
        const self = this;
        return function shuffle(getRandomInt?: (upperBound: number) => number) {
            return new Itmod({ fresh: true, expensive: true }, () => {
                const array = self.toArray();
                fisherYatesShuffle(array, getRandomInt);
                return array;
            });
        };
    }

    /**
     * Internally collapses the iterable into a solid collection like an {@link Array}.
     */
    public get collapse() {
        this.requireSelfNotInfinite("cannot collapse infinite items");
        const self = this;
        return function collapse() {
            const source = self.getSource();
            if (isSolid(source)) {
                return Itmod.from(source);
            } else {
                return Itmod.from([...source]);
            }
        };
    }

    /**
     * Checks if the given Iterable contains the same items in the same order as the {@link Itmod}.
     *
     * @param other The given Iterable.
     * @param is Returns whether the two given items are considered equal.
     *
     */
    public get sequenceEquals() {
        const self = this;
        return function sequenceEquals<O = T>(
            other: Iterable<O>,
            /**
             * @default Object.is
             */
            is: (a: T, b: O) => boolean = (a, b) => Object.is(a, b)
        ) {
            if (other instanceof Itmod) {
                if (
                    !!self.properties.infinite !== !!other.properties.infinite
                ) {
                    return false;
                }

                if (self.properties.infinite && other.properties.infinite) {
                    throw new NeverEndingOperationError(
                        "cannot check if two infinite sequences are equal"
                    );
                }
            }
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
         * @returns The string values of each item in the stream concatenated together with the string value of the given separator between them.
         */
        (separator: any): string;
        /**
         * @returns The string values of each item in the stream concatenated together with the string value of the given separator between them.
         * @param start Concatenated onto the start of the resulting string.
         */
        (start: any, separator: any): string;
        /**
         * @returns The string values of each item in the stream concatenated together with the string value of the given separator between them.
         * @param start Concatenated onto the start of the resulting string.
         * @param end Concatenated onto the end of the resulting string.
         */
        (start: any, separator: any, end: any): string;
    } {
        const self = this;
        const externalMakeString = makeString;
        return function makeString(
            ...args: [any, any, any] | [any, any] | [any] | []
        ): string {
            self.requireSelfNotInfinite(
                "cannot collect infinite items into a string"
            );

            if (args.length === 0) {
                return externalMakeString(self.getSource());
            } else if (args.length === 1) {
                const separator = args[0];
                return externalMakeString(self.getSource(), separator);
            } else {
                const [start, separator, end] = args;
                return externalMakeString(
                    self.getSource(),
                    start,
                    separator,
                    end
                );
            }
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
        {
            preSorted = false,
        }: {
            /** The source has already been sorted. */
            preSorted?: boolean;
        } = {}
    ) {
        super(
            preSorted ? properties : { fresh: true, expensive: true },
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

    /**
     * Adds more fallback sorts to the {@link SortedItmod}.
     */
    public get thenBy(): {
        (order: Comparator<T>): SortedItmod<T>;
        (order: FieldSelector<T>): SortedItmod<T>;
        (order: Field<T>): SortedItmod<T>;
        (...orders: (Comparator<T> | Field<T>)[]): SortedItmod<T>;
        (...orders: (FieldSelector<T> | Field<T>)[]): SortedItmod<T>;
        (...orders: Order<T>[]): SortedItmod<T>;
    } {
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
    public get thenByDescending(): {
        (order: Comparator<T>): SortedItmod<T>;
        (order: FieldSelector<T>): SortedItmod<T>;
        (order: Field<T>): SortedItmod<T>;
        (...orders: (Comparator<T> | Field<T>)[]): SortedItmod<T>;
        (...orders: (FieldSelector<T> | Field<T>)[]): SortedItmod<T>;
        (...orders: Order<T>[]): SortedItmod<T>;
    } {
        const self = this;
        return function thenBy(...orders: Order<T>[]): SortedItmod<T> {
            return new SortedItmod(
                self.originalProperties,
                self.originalGetSource,
                [...self.orders, ...orders.map(reverseOrder)]
            );
        };
    }

    public get take() {
        const self = this;
        return function take(count: number | bigint) {
            return self.min(count, self.comparator);
        };
    }

    public get takeFinal() {
        const self = this;
        return function takeFinal(count: number | bigint) {
            return self.max(count, self.comparator);
        };
    }

    // TODO skip and skipFinal
}

/**
 * {@link Itmod} With a mapping applied to its items. The result of {@link Itmod.map}.
 */
export class MappedItmod<T, R> extends Itmod<R> {
    protected readonly mapping: (value: T, index: number) => R;
    protected readonly originalGetSource: () => Iterable<T>;
    protected readonly originalProperties: ItmodProperties<T>;
    protected readonly indexOffset: number;
    protected readonly indexIncrement: number;

    public constructor(
        properties: ItmodProperties<T>,
        getSource: () => Iterable<T>,
        mapping: (value: T, index: number) => R,
        {
            indexOffset = 0,
            indexIncrement = 1,
        }: {
            /**
             * Offset added to the index given to the mapping function.
             * @default 0
             */
            indexOffset?: number;
            /**
             * How much to increment the index given to the mapping function.
             * @default 1
             */
            indexIncrement?: number;
        } = {}
    ) {
        super({ infinite: properties.infinite }, function* () {
            const source = getSource();
            let i = indexOffset;
            for (const value of source) {
                yield mapping(value, i);
                i += indexIncrement;
            }
        });
        this.mapping = mapping;
        this.originalGetSource = getSource;
        this.originalProperties = properties;
        this.indexOffset = indexOffset;
        this.indexIncrement = indexIncrement;
    }

    public get skip() {
        const self = this;
        const externalSkip = skip;
        return function skip(count: number | bigint): Itmod<R> {
            return new MappedItmod(
                self.originalProperties,
                () => externalSkip(count, self.originalGetSource()),
                self.mapping,
                // offset the mapping index for the non-skipped items
                { indexOffset: Number(count) + self.indexOffset }
            );
        };
    }

    // Each of these overloads checks if the mapping function uses index.
    // If it doesn't. It is safe to take or skip before mapping without doing anything to adjust the index.
    // TODO find ways to make the index correct when needed without just mapping first.

    // There's no overload for take because take then map already has optimal behavior.

    public get takeFinal() {
        const self = this;
        const parentTakeFinal = super.takeFinal;
        const externalTakeFinal = takeFinal;
        return function takeFinal(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return parentTakeFinal(count);
            } else {
                return new MappedItmod(
                    {
                        ...self.originalProperties,
                        expensive: true,
                        fresh: true,
                    },
                    () => externalTakeFinal(count, self.originalGetSource()),
                    self.mapping
                );
            }
        };
    }

    public get skipFinal() {
        const self = this;
        const externalSkipFinal = skipFinal;
        const parentSkipFinal = super.skipFinal;
        return function skipFinal(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return parentSkipFinal(count);
            } else {
                return new MappedItmod(
                    self.originalProperties,
                    () => externalSkipFinal(count, self.originalGetSource()),
                    self.mapping
                );
            }
        };
    }

    public get takeEveryNth() {
        const self = this;
        const externalTakeEveryNth = takeEveryNth;
        const parentTakeEveryNth = super.takeEveryNth;
        return function takeEveryNth(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return parentTakeEveryNth(count);
            } else {
                return new MappedItmod(
                    self.originalProperties,
                    () => externalTakeEveryNth(count, self.originalGetSource()),
                    self.mapping
                );
            }
        };
    }

    public get takeRandom() {
        const self = this;
        const externalTakeRandom = takeRandom;
        const parentTakeRandom = super.takeRandom;
        return function takeRandom(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return parentTakeRandom(count);
            } else {
                return new MappedItmod(
                    self.originalProperties,
                    () => externalTakeRandom(count, self.originalGetSource()),
                    self.mapping
                );
            }
        };
    }

    public get skipEveryNth() {
        const self = this;
        const externalSkipEveryNth = skipEveryNth;
        const parentSkipEveryNth = super.skipEveryNth;
        return function skipEveryNth(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return parentSkipEveryNth(count);
            } else {
                return new MappedItmod(
                    self.originalProperties,
                    () => externalSkipEveryNth(count, self.originalGetSource()),
                    self.mapping
                );
            }
        };
    }

    public get skipRandom() {
        const self = this;
        const externalSkipRandom = skipRandom;
        const parentSkipRandom = super.skipRandom;
        return function skipRandom(count: number | bigint): Itmod<R> {
            // check if mapping function uses the index.
            if (self.mapping.length >= 2) {
                return parentSkipRandom(count);
            } else {
                return new MappedItmod(
                    self.originalProperties,
                    () => externalSkipRandom(count, self.originalGetSource()),
                    self.mapping
                );
            }
        };
    }
}

const _emptyItmod = new Itmod<any>({}, returns(emptyIterable()));

function take<T>(count: number | bigint, source: Iterable<T>): Iterable<T> {
    requireIntegerOrInfinity(requireNonNegative(count));
    if (count === Infinity) return source;
    if (isZero(count)) return [];

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
    if (isZero(count)) return source;
    if (count === Infinity) return [];

    return {
        *[Symbol.iterator]() {
            if (isArray(source)) {
                const numberCount = Number(count);
                if (numberCount === Infinity) return [];
                for (let i = numberCount; i < source.length; i++) {
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

/**
 * note: expensive and fresh
 */
function takeFinal<T>(
    count: number | bigint,
    source: Iterable<T>
): Iterable<T> {
    requireIntegerOrInfinity(requireNonNegative(count));
    if (count === Infinity) return source;
    if (isZero(count)) return [];

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
    if (isZero(count)) return source;

    const size = nonIteratedCountOrUndefined(source);

    if (size !== undefined) {
        if (count >= size) return [];
        return take(size - Number(count), source);
    }

    return {
        *[Symbol.iterator]() {
            const buffer = new CircularBuffer<T>(Number(count));

            for (const item of source) {
                if (buffer.isFull) yield buffer.at(0)!;
                buffer.push(item);
            }
        },
    };
}

function takeEveryNth<T>(n: number | bigint, source: Iterable<T>): Iterable<T> {
    requireIntegerOrInfinity(requireGreaterThanZero(n));
    if (n === Infinity) return emptyIterable();
    if (isOne(n)) return source;

    return {
        *[Symbol.iterator]() {
            let i = zeroLike(n);
            for (const item of source) {
                i++;
                if (i >= n) {
                    yield item;
                    i = zeroLike(n);
                }
            }
        },
    };
}

function takeWhile<T>(
    condition: (item: T, index: number) => boolean,
    source: Iterable<T>
) {
    return {
        *[Symbol.iterator]() {
            let i = 0;
            for (const item of source) {
                if (!condition(item, i)) break;
                yield item;
                i++;
            }
        },
    };
}

function takeRandom<T>(
    count: number | bigint,
    source: Iterable<T>,
    getRandomInt?: (upperBound: number) => number
): Iterable<T> {
    requireIntegerOrInfinity(requireNonNegative(count));
    if (isZero(count)) return emptyIterable();

    const shuffled = [...source];
    fisherYatesShuffle(shuffled, getRandomInt);

    return take(count, shuffled);
}

function skipEveryNth<T>(n: number | bigint, source: Iterable<T>): Iterable<T> {
    requireIntegerOrInfinity(requireGreaterThanZero(n));
    if (n === Infinity) return source;
    if (isOne(n)) return emptyIterable();

    return {
        *[Symbol.iterator]() {
            let i = zeroLike(n);
            for (const item of source) {
                i++;
                if (i >= n) {
                    i = zeroLike(n);
                } else {
                    yield item;
                }
            }
        },
    };
}

function skipWhile<T>(
    source: Iterable<T>,
    condition: (item: T, index: number) => boolean
) {
    return {
        *[Symbol.iterator]() {
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
        },
    };
}

function skipRandom<T>(
    count: number | bigint,
    source: Iterable<T>,
    getRandomInt?: (upperBound: number) => number
): Iterable<T> {
    requireIntegerOrInfinity(requireNonNegative(count));
    if (count === Infinity) return emptyIterable();
    if (isZero(count)) return source;

    const nonIteratedCount = nonIteratedCountOrUndefined(source);
    if (nonIteratedCount !== undefined && count >= nonIteratedCount) {
        return emptyIterable();
    }

    const shuffled = [...source];
    if (count >= shuffled.length) return emptyIterable();
    fisherYatesShuffle(shuffled, getRandomInt);

    return take(shuffled.length - Number(count), shuffled);
}

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

function isZero(n: number | bigint): n is 0 | 0n {
    return n === 0 || n === 0n;
}

function isOne(n: number | bigint): n is 1 | 0n {
    return n === 1 || n === 1n;
}

function isSolid<T>(iterable: Iterable<T>): boolean {
    return (
        isArray(iterable) ||
        iterable instanceof Set ||
        iterable instanceof Map ||
        iterable instanceof Collection
    );
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
 * @param getRandomInt Returns a random integer that's greater than or equal to 0 and less than upperBound. Defaults to using {@link Math.random}, which is not cryptographically secure.
 */
export function fisherYatesShuffle(
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

function defaultGetRandomInt(upperBound: number) {
    return Math.trunc(Math.random() * upperBound);
}

function makeString(
    collection: Iterable<unknown>,
    startOrSeparator: unknown = "",
    separator: unknown = "",
    end: unknown = ""
): string {
    if (arguments.length === 2) {
        const separator = startOrSeparator;
        return makeString(collection, "", separator, "");
    }

    const start = startOrSeparator;

    if (typeof start !== "string") {
        return makeString(collection, `${start}`, separator, end);
    }

    if (typeof separator !== "string") {
        return makeString(collection, start, `${separator}`, end);
    }

    if (typeof end !== "string") {
        return makeString(collection, start, separator, `${end}`);
    }

    if (typeof collection === "string" && separator === "") {
        // This check may or may not be necessary. I have no way to test if it is.
        if (start === "" && end === "") {
            return collection;
        } else {
            return start + collection + end;
        }
    }
    // TODO test performance difference
    // return start + [...collection].join(separator) + end;

    const builder: unknown[] = [start];

    const iterator = collection[Symbol.iterator]();
    let next = iterator.next();

    if (!next.done) {
        builder.push(next.value);

        while (!(next = iterator.next()).done) {
            builder.push(separator);
            builder.push(next.value);
        }
    }

    builder.push(end);
    return builder.join("");
}

/**
 * Splits the collection on the deliminator.
 * Equivalent to {@link String.split} except that regular expressions aren't supported.
 */
export function split<T, O>(
    collection: Iterable<T>,
    deliminator: Iterable<O>,
    equalityChecker: (t: T, o: O) => boolean = Object.is
): Iterable<T[]> {
    const delim = [...deliminator];
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
