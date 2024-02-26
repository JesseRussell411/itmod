import Itmod from "./Itmod";
import { BreakSignal, breakSignal } from "./signals";
import { AwaitableIterable } from "./types/iterable";

export type AsyncItmodProperties<_> = Readonly<Partial<{ expensive: boolean }>>;

export default class AsyncItmod<T> implements AsyncIterable<T> {
    public readonly getSource: () =>
        | Promise<AwaitableIterable<T>>
        | AwaitableIterable<T>;
    public readonly properties: AsyncItmodProperties<T>;

    public constructor(
        properties: AsyncItmodProperties<T>,
        getSource: () => Promise<AwaitableIterable<T>> | AwaitableIterable<T>
    ) {
        this.properties = properties;
        this.getSource = getSource;
    }

    public get [Symbol.asyncIterator]() {
        const self = this;
        return async function* asyncIterator() {
            yield* await self.getSource();
        };
    }

    public get forEach() {
        const self = this;
        return async function forEach(
            action: (
                item: T,
                index: number
            ) =>
                | void
                | Promise<void>
                | BreakSignal
                | Promise<BreakSignal>
                | Promise<void | BreakSignal>
        ) {
            let i = 0;
            for await (const item of self) {
                const result = await action(item, i);
                i++;
                if (result === breakSignal) break;
            }
        };
    }

    public get map() {
        const self = this;
        return function map<R>(
            mapping: (item: T, index: number) => R
        ): AsyncItmod<Awaited<R>> {
            return new AsyncItmod({}, async function* () {
                let i = 0;
                for await (const item of self) {
                    yield await mapping(item, i);
                    i++;
                }
            });
        };
    }

    public get filter() {
        const self = this;
        return function filter<R extends T = T>(
            condition: (item: T, index: number) => boolean | Promise<boolean>
        ): AsyncItmod<Awaited<R>> {
            return new AsyncItmod({}, async function* () {
                let i = 0;
                for await (const item of self) {
                    if (await condition(item, i)) yield item as R;
                    i++;
                }
            });
        };
    }

    // public get flat() {
    //     const self = this;
    //     return function flat(): AsyncItmod<Awaited<T> extends AwaitableIterable<T>infer SubT> ? SubT : T> {

    //     }
    // }

    public get toArray() {
        const self = this;
        return async function toArray(): Promise<Awaited<T>[]> {
            const result = [] as Awaited<T>[];
            for await (const item of self) {
                result.push(item);
            }
            return result;
        };
    }

    public get toSet() {
        const self = this;
        return async function toSet(): Promise<Set<Awaited<T>>> {
            const result = new Set<Awaited<T>>();
            for await (const item of self) {
                result.add(item);
            }
            return result;
        };
    }

    // TODO toMap

    public get toItmod() {
        const self = this;
        return async function toItmod(): Promise<Itmod<Awaited<T>>> {
            return Itmod.from(await self.toArray());
        };
    }
}
/*


methods to have (basically nothing that involves copying the whole thing into memory before you can get the first item (like reverse) (unless that memory is the desired result like with toArray or makestring, if that memory is just a middle-man type of thing, that's different.), since you should just use toItmod for that)
forEach
map
flat
filter
defined
notNull
notNullish
zip
reduce
fold
concat
preConcat
append
prepend
first
final
distinct
?union
?intersection
?difference
take
takeFinal
takeEveryNth
takeWhile
skip
skipFinal
skipEveryNth
skipWhile
copyWithin
indexed
includes
some
none
every
count
min
max
groupBy
split
partitionBySize
?groupJoin
?innerGroupJoin
?join
?innerJoin
toArray
toSet
toMap
indexBy
toObject
sequenceEquals
makeString


*/
