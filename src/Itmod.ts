import { asArray, asIterable } from "./collections/as";
import { isArray } from "./collections/is";
import {
    cachingIterable as cachedIterable,
    range,
} from "./collections/iterables";
import NeverEndingOperationError from "./errors/NeverEndingOperationError";
import { identity, resultOf, returns } from "./functional";
import { requireIntegerOrInfinity, requireNonNegative } from "./require";
import { BreakSignal, breakSignal } from "./signals";
import { General } from "./types/literals";

export type Comparison =
    | "equals"
    | "lessThan"
    | "greaterThan"
    | "lessThanOrEqualTo"
    | "greaterThanOrEqualTo";

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

export default class Itmod<T> implements Iterable<T> {
    /**
     * @returns The {@link Iterable} source.
     */
    protected readonly getSource: () => Iterable<T>;
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
            | (() => Iterator<T>)
    ): Itmod<T> {
        if (source instanceof Function) {
            return new Itmod({ expensive: true }, () => {
                return asIterable(source());
            });
        } else if (source instanceof Itmod) {
            return source;
        } else {
            return new Itmod({}, returns(asIterable(source)));
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
            let i = typeof count === "number" ? 0 : 0n;
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
     */
    public static range(
        start: bigint,
        end: bigint,
        step: bigint
    ): Itmod<bigint>;
    /**
     * @returns An {@link Itmod} over a range of integers from start to end, incremented by 1 or -1 if end is less than start.
     */
    public static range(start: bigint, end: bigint): Itmod<bigint>;
    /**
     * @returns An {@link Itmod} over a range of integers from 0 to end, incremented by 1.
     */
    public static range(end: bigint): Itmod<bigint>;

    /**
     * @returns An {@link Itmod} over a range of integers from start to end, incremented by step.
     */
    public static range(
        start: number | bigint,
        end: number | bigint,
        step: number | bigint
    ): Itmod<number>;
    /**
     * @returns An {@link Itmod} over a range of integers from start to end, incremented by 1 or -1 if end is less than start.
     */
    public static range(
        start: number | bigint,
        end: number | bigint
    ): Itmod<number>;
    /**
     * @returns An {@link Itmod} over a range of integers from 0 to end, incremented by 1.
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
        <R = General<T>>(
            reducer: (accumulator: R | T, value: T, index: number) => R
        ): R;
        <F, R = General<T>>(
            reducer: (accumulator: R | T, value: T, index: number) => R,
            finalize: (result: R | undefined, count: number) => F
        ): F;
    } {
        const self = this;
        return function reduce(
            reducer: (accumulator: any, value: T, index: number) => any,
            finalize: (result: any, count: number) => any = identity
        ): any {
            const source = self.getSource();

            // in case of array optimization
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
        <R>(
            initialValue: R,
            reducer: (accumulator: R, value: T, index: number) => R
        ): R;
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

            // in case of array optimization
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
                        yield array[i];
                    }
                }
            );
        };
    }

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

                    const cached = isArray(source)
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
                for (
                    let i = typeof times === "number" ? 0 : 0n;
                    i < times;
                    i++
                ) {
                    yield* cached;
                }
            });
        };
    }

    private requireSelfNotInfinite(errorMessage: string | (() => string)) {
        if (this.properties.infinite) {
            throw new NeverEndingOperationError(resultOf(errorMessage));
        }
    }
}
