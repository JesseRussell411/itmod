import Itmod, {
    empty,
    from,
    fromIterator,
    fromObject,
    generate,
    of,
    range,
} from "../src/Itmod";
import CircularBuffer from "../src/collections/CircularBuffer";
import LinkedList from "../src/collections/LinkedList";
import { identity } from "../src/functional/functions";
import { breakSignal } from "../src/signals";
import { autoComparator } from "../src/sorting";

test("iterator", () => {
    const itmod = Itmod.of(1, 2, 3, 4);
    const array = [] as number[];

    for (const n of itmod) {
        array.push(n);
    }

    expect(array).toEqual([1, 2, 3, 4]);
});

test("constructor", () => {
    const itmod = new Itmod({}, () => [1, 2, 3, 4]);
    expect([...itmod]).toEqual([1, 2, 3, 4]);
});

describe("from", () => {
    test("iterable", () => {
        const itmod = Itmod.from({
            *[Symbol.iterator]() {
                for (const n of [1, 2, 3, 4]) {
                    yield n;
                }
            },
        });
        expect([...itmod]).toEqual([1, 2, 3, 4]);
    });
    test("iterator", () => {
        const itmod = Itmod.from([1, 2, 3, 4][Symbol.iterator]());
        expect([...itmod]).toEqual([1, 2, 3, 4]);
    });
    test("iterableGetter", () => {
        const itmod = Itmod.from(() => ({
            *[Symbol.iterator]() {
                for (const n of [1, 2, 3, 4]) {
                    yield n;
                }
            },
        }));
        expect([...itmod]).toEqual([1, 2, 3, 4]);
    });
    test("iteratorGetter", () => {
        const itmod = Itmod.from(() => [1, 2, 3, 4][Symbol.iterator]());
        expect([...itmod]).toEqual([1, 2, 3, 4]);
    });
});

test("of", () => {
    const itmod = Itmod.of(1, 2, 3, 4);
    expect([...itmod]).toEqual([1, 2, 3, 4]);
});

test("empty", () => {
    const itmod = Itmod.empty();
    expect(itmod.count()).toBe(0);
    expect([...itmod]).toEqual([]);
});

describe("fromObject", () => {
    test("string keys only", () => {
        const foo = Symbol("foo");
        const itmod = Itmod.fromObject(
            { [foo]: 1, bar: 2 },
            { includeStringKeys: true, includeSymbolKeys: false }
        );
        const array = [...itmod];
        expect(array.map((entry) => entry[0])).toEqual(["bar"]);
    });
    test("symbol keys only", () => {
        const foo = Symbol("foo");
        const itmod = Itmod.fromObject(
            { [foo]: 1, bar: 2 },
            { includeStringKeys: false, includeSymbolKeys: true }
        );
        const array = [...itmod];
        expect(array.map((entry) => entry[0])).toEqual([foo]);
    });
    test("string and symbol keys", () => {
        const foo = Symbol("foo");
        const itmod = Itmod.fromObject(
            { [foo]: 1, bar: 2 },
            { includeStringKeys: true, includeSymbolKeys: true }
        );
        for (const entry of itmod) {
            expect([foo, "bar"]).toContain(entry[0]);
        }
        const [one, two] = [...itmod];
        expect(one).toBeDefined();
        expect(two).toBeDefined();

        expect(one![0]).not.toBe(two![0]);
    });
});

describe("generate", () => {
    test("number count of fixed item", () => {
        const itmod = Itmod.generate(4, "foo");
        expect([...itmod]).toEqual(["foo", "foo", "foo", "foo"]);
    });
    test("bigint count of fixed item", () => {
        const itmod = Itmod.generate(4n, "foo");
        expect([...itmod]).toEqual(["foo", "foo", "foo", "foo"]);
    });
    test("number count of callback item", () => {
        const itmod = Itmod.generate(4, (i) => i + 1);
        expect([...itmod]).toEqual([1, 2, 3, 4]);
    });
    test("bigint count of callback item", () => {
        const itmod = Itmod.generate(4n, (i) => i + 1n);
        expect([...itmod]).toEqual([1n, 2n, 3n, 4n]);
    });
});

describe("range", () => {
    describe("bigint start, end, step", () => {
        describe("positive step", () => {
            test("start less than end", () => {
                const itmod = Itmod.range(-4n, 6n, 2n);
                expect([...itmod]).toEqual([-4n, -2n, 0n, 2n, 4n]);
            });
            test("end less than start to be empty", () => {
                const itmod = Itmod.range(4n, -6n, 2n);
                expect([...itmod]).toEqual([]);
                expect(itmod.count()).toBe(0);
            });
        });
        describe("negative step", () => {
            test("end less than start", () => {
                const itmod = Itmod.range(4n, -6n, -2n);
                expect([...itmod]).toEqual([4n, 2n, 0n, -2n, -4n]);
            });
            test("start less than end to be empty", () => {
                const itmod = Itmod.range(-4n, 6n, -2n);
                expect([...itmod]).toEqual([]);
                expect(itmod.count()).toBe(0);
            });
        });
    });
    describe("bigint start, end", () => {
        test("start less than end", () => {
            const itmod = Itmod.range(-2n, 3n);
            expect([...itmod]).toEqual([-2n, -1n, 0n, 1n, 2n]);
        });
        test("end less than start to be empty", () => {
            const itmod = Itmod.range(2n, -3n);
            expect([...itmod]).toEqual([]);
            expect(itmod.count()).toBe(0);
        });
    });
    describe("bigint end", () => {
        test("5n end to not be empty", () => {
            const itmod = Itmod.range(5n);
            expect([...itmod]).toEqual([0n, 1n, 2n, 3n, 4n]);
        });
        test("0n end to be empty", () => {
            const itmod = Itmod.range(0n);
            expect([...itmod]).toEqual([]);
            expect(itmod.count()).toBe(0);
        });
    });
    describe("start, end, step", () => {
        describe("positive step", () => {
            test("start less than end", () => {
                const itmod = Itmod.range(-4, 6, 2);
                expect([...itmod]).toEqual([-4, -2, 0, 2, 4]);
            });
            test("end less than start to be empty", () => {
                const itmod = Itmod.range(4, -6, 2);
                expect([...itmod]).toEqual([]);
                expect(itmod.count()).toBe(0);
            });
        });
        describe("negative step", () => {
            test("end less than start", () => {
                const itmod = Itmod.range(4, -6, -2);
                expect([...itmod]).toEqual([4, 2, 0, -2, -4]);
            });
            test("start less than end to be empty", () => {
                const itmod = Itmod.range(-4, 6, -2);
                expect([...itmod]).toEqual([]);
                expect(itmod.count()).toBe(0);
            });
        });
    });
    describe("start, end", () => {
        test("start less than end", () => {
            const itmod = Itmod.range(-2, 3);
            expect([...itmod]).toEqual([-2, -1, 0, 1, 2]);
        });
        test("end less than start to be empty", () => {
            const itmod = Itmod.range(2n, -3n);
            expect([...itmod]).toEqual([]);
            expect(itmod.count()).toBe(0);
        });
    });
    describe("end", () => {
        test("5 end to not be empty", () => {
            const itmod = Itmod.range(5);
            expect([...itmod]).toEqual([0, 1, 2, 3, 4]);
        });
        test("0 end to be empty", () => {
            const itmod = Itmod.range(0);
            expect([...itmod]).toEqual([]);
            expect(itmod.count()).toBe(0);
        });
    });
});

describe("forEach", () => {
    test("on itmod of length n, does n things", () => {
        const itmod = Itmod.of(1, 2, 3, 42);
        let array = [] as number[];
        let count = 0;

        itmod.forEach((item) => {
            array.push(item * 2);
            count++;
        });
        expect(count).toBe(4);
        expect(array).toEqual([2, 4, 6, 84]);
    });
    test("on empty itmod does nothing", () => {
        const itmod = Itmod.empty<number>();
        let array = [] as number[];
        let count = 0;

        itmod.forEach((item) => {
            array.push(item * 2);
            count++;
        });
        expect(count).toBe(0);
        expect(array).toEqual([]);
    });
    test("break signal", () => {
        const itmod = Itmod.of(1, 2, 3, 42);
        let array = [] as number[];
        let count = 0;

        itmod.forEach((item) => {
            if (item > 2) return breakSignal;
            array.push(item * 2);
            count++;
        });
        expect(count).toBe(2);
        expect(array).toEqual([2, 4]);
    });
    test("index", () => {
        const itmod = Itmod.of(1, 2, 3, 42);
        let array = [] as number[];
        let count = 0;

        itmod.forEach((_item, index) => {
            array.push(index * 2);
            count++;
        });
        expect(count).toBe(4);
        expect(array).toEqual([0, 2, 4, 6]);
    });
});

describe("map", () => {
    test("mapping of 4 numbers", () => {
        const itmod = Itmod.of(1, 2, 3, 42);
        const mapped = itmod.map((item) => item * 2);
        expect([...mapped]).toEqual([2, 4, 6, 84]);
        expect(mapped.count()).toBe(4);
    });
    test("mapping of empty is empty", () => {
        const itmod = Itmod.empty<number>();
        const mapped = itmod.map((item) => item * 2);
        expect([...mapped]).toEqual([]);
        expect(mapped.count()).toBe(0);
    });
    test("index", () => {
        const itmod = Itmod.of(1, 2, 3, 42);
        const mapped = itmod.map((_item, index) => index * 2);
        expect([...mapped]).toEqual([0, 2, 4, 6]);
        expect(mapped.count()).toBe(4);
    });
});

describe("filter", () => {
    test("out of 10 numbers", () => {
        const itmod = Itmod.of(1, 2, 3, 42, 5, 6, 7, 8, 69);
        const filtered = itmod.filter((n) => n % 2 === 0);
        expect([...filtered]).toEqual([2, 42, 6, 8]);
        expect(filtered.count()).toBe(4);
    });
    test("out of empty is emtpy", () => {
        const itmod = Itmod.empty<number>();
        const filtered = itmod.filter((n) => n % 2 === 0);
        expect([...filtered]).toEqual([]);
        expect(filtered.count()).toBe(0);
    });
    test("index", () => {
        const itmod = Itmod.of(1, 2, 3, 42, 5, 6, 7, 8, 69);
        const filtered = itmod.filter((_, i) => i % 2 === 0);
        expect([...filtered]).toEqual([1, 3, 5, 7, 69]);
        expect(filtered.count()).toBe(5);
    });
});

describe("reduce", () => {
    test("without finalize", () => {
        const itmod = Itmod.of(5, 7, 3, 8, 1, 9);
        const total = itmod.reduce((acc, n) => acc + n);
        expect(total).toBe(33);
    });
    test("with finalize", () => {
        const itmod = Itmod.of(5, 7, 3, 8, 1, 6);
        const mean = itmod.reduce(
            (acc, n) => acc + n,
            (total, count) => total! / count
        );
        expect(mean).toBe(5);
    });
    test("empty", () => {
        const itmod = Itmod.empty<number>();
        const total = itmod.reduce((acc, n) => acc + n);
        expect(total).toBe(undefined);
    });
    test("index", () => {
        const itmod = Itmod.of(5, 7, 3, 8, 1, 9);
        const total = itmod.reduce((acc, _, i) => acc + i);
        expect(total).toBe(20);
    });
});

describe("fold", () => {
    test("without finalize", () => {
        const itmod = Itmod.of(5, 7, 3, 8, 1, 9);
        const total = itmod.fold(3, (acc, n) => acc + n);
        expect(total).toBe(36);
    });
    test("with finalize", () => {
        const itmod = Itmod.of(5, 7, 3, 8, 1, 6);
        const mean = itmod.fold(
            0,
            (acc, n) => acc + n,
            (total, count) => total! / count
        );
        expect(mean).toBe(5);
    });
    test("empty", () => {
        const itmod = Itmod.empty<number>();
        const mean = itmod.fold(42, (acc, n) => acc + n);
        expect(mean).toBe(42);
    });
    test("index", () => {
        const itmod = Itmod.of(5, 7, 3, 8, 1, 9);
        const total = itmod.fold(3, (acc, _, i) => acc + i);
        expect(total).toBe(18);
    });
});

describe("concat", () => {
    test("empty to empty", () => {
        const concated = Itmod.empty<string>().concat("");
        expect(concated.toArray().join("")).toBe("");
    });
    test("nonEmpty to empty", () => {
        const concated = Itmod.from("Hello").concat("");
        expect(concated.toArray().join("")).toBe("Hello");
    });
    test("empty to nonEmpty", () => {
        const concated = Itmod.empty<string>().concat("World");
        expect(concated.toArray().join("")).toBe("World");
    });
    test("nonEmpty to nonEmpty", () => {
        const concated = Itmod.from("Hello").concat("World");
        expect(concated.toArray().join("")).toBe("HelloWorld");
    });
});

describe("preConcat", () => {
    test("empty to empty", () => {
        const concated = Itmod.empty<string>().preConcat("");
        expect(concated.toArray().join("")).toBe("");
    });
    test("nonEmpty to empty", () => {
        const concated = Itmod.from("Hello").preConcat("");
        expect(concated.toArray().join("")).toBe("Hello");
    });
    test("empty to nonEmpty", () => {
        const concated = Itmod.empty<string>().preConcat("World");
        expect(concated.toArray().join("")).toBe("World");
    });
    test("nonEmpty to nonEmpty", () => {
        const concated = Itmod.from("Hello").preConcat("World");
        expect(concated.toArray().join("")).toBe("WorldHello");
    });
});

describe("reverse", () => {
    test("empty", () => {
        const itmod = Itmod.empty<number>();
        const reversed = itmod.reverse();
        expect([...reversed]).toEqual([]);
    });
    test("of length 1", () => {
        const itmod = Itmod.of(42);
        const reversed = itmod.reverse();
        expect([...reversed]).toEqual([42]);
    });
    test("of length 10", () => {
        const itmod = Itmod.of(1, 3, 5, 6, 7, 42, 4, 5, 6, 7);
        const reversed = itmod.reverse();
        expect([...reversed]).toEqual([7, 6, 5, 4, 42, 7, 6, 5, 3, 1]);
    });
});

describe("repeat", () => {
    test("empty", () => {
        const itmod = Itmod.empty<number>();
        const reversed = itmod.reverse();
        expect([...reversed]).toEqual([]);
    });
    test("3 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(3);
        expect([...reversed]).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]);
    });
    test("2 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(2);
        expect([...reversed]).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    });
    test("1 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(1);
        expect([...reversed]).toEqual([1, 2, 3, 4]);
    });
    test("0 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(0);
        expect([...reversed]).toEqual([]);
    });
    test("-1 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(-1);
        expect([...reversed]).toEqual([4, 3, 2, 1]);
    });
    test("-2 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(-2);
        expect([...reversed]).toEqual([4, 3, 2, 1, 4, 3, 2, 1]);
    });
    test("-3 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(-3);
        expect([...reversed]).toEqual([4, 3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1]);
    });
    test("2n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(2n);
        expect([...reversed]).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    });
    test("1n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(1n);
        expect([...reversed]).toEqual([1, 2, 3, 4]);
    });
    test("0n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(0n);
        expect([...reversed]).toEqual([]);
    });
    test("-1n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(-1n);
        expect([...reversed]).toEqual([4, 3, 2, 1]);
    });
    test("-2n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(-2n);
        expect([...reversed]).toEqual([4, 3, 2, 1, 4, 3, 2, 1]);
    });
});

// TODO bigint tests
describe("take", () => {
    test("4 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.take(4);
        expect([...taken]).toEqual([0, 1, 2, 3]);
    });
    test("4 from 4", () => {
        const itmod = Itmod.range(0, 4);
        const taken = itmod.take(4);
        expect([...taken]).toEqual([0, 1, 2, 3]);
    });
    test("4 from 2", () => {
        const itmod = Itmod.range(0, 2);
        const taken = itmod.take(4);
        expect([...taken]).toEqual([0, 1]);
    });
    test("4 from 2", () => {
        const itmod = Itmod.empty();
        const taken = itmod.take(4);
        expect([...taken]).toEqual([]);
    });
    test("0 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.take(0);
        expect([...taken]).toEqual([]);
    });
    test("inf from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.take(Infinity);
        expect([...taken]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
});

describe("skip", () => {
    test("4 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skip(4);
        expect([...taken]).toEqual([4, 5, 6, 7, 8, 9]);
    });
    test("4 from 4", () => {
        const itmod = Itmod.range(0, 4);
        const taken = itmod.skip(4);
        expect([...taken]).toEqual([]);
    });
    test("4 from 2", () => {
        const itmod = Itmod.range(0, 2);
        const taken = itmod.skip(4);
        expect([...taken]).toEqual([]);
    });
    test("4 from 0", () => {
        const itmod = Itmod.empty();
        const taken = itmod.skip(4);
        expect([...taken]).toEqual([]);
    });
    test("0 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skip(0);
        expect([...taken]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    test("inf from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skip(Infinity);
        expect([...taken]).toEqual([]);
    });
});

describe("takeFinal", () => {
    test("4 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.takeFinal(4);
        expect([...taken]).toEqual([6, 7, 8, 9]);
    });
    test("4 from 4", () => {
        const itmod = Itmod.range(0, 4);
        const taken = itmod.takeFinal(4);
        expect([...taken]).toEqual([0, 1, 2, 3]);
    });
    test("4 from 2", () => {
        const itmod = Itmod.range(0, 2);
        const taken = itmod.takeFinal(4);
        expect([...taken]).toEqual([0, 1]);
    });
    test("4 from 0", () => {
        const itmod = Itmod.empty();
        const taken = itmod.takeFinal(4);
        expect([...taken]).toEqual([]);
    });
    test("0 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.takeFinal(0);
        expect([...taken]).toEqual([]);
    });
    test("inf from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.takeFinal(Infinity);
        expect([...taken]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
});

describe("skipFinal", () => {
    test("4 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skipFinal(4);
        expect([...taken]).toEqual([0, 1, 2, 3, 4, 5]);
    });
    test("4 from 4", () => {
        const itmod = Itmod.range(0, 4).collapse();
        const taken = itmod.skipFinal(4);
        expect([...taken]).toEqual([]);
    });
    test("4 from 2", () => {
        const itmod = Itmod.range(0, 2);
        const taken = itmod.skipFinal(4);
        expect([...taken]).toEqual([]);
    });
    test("4 from 0", () => {
        const itmod = Itmod.empty();
        const taken = itmod.skipFinal(4);
        expect([...taken]).toEqual([]);
    });
    test("0 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skipFinal(0);
        expect([...taken]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
    test("inf from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skipFinal(Infinity);
        expect([...taken]).toEqual([]);
    });
});

describe("takeEveryNth", () => {
    test("1 of 10", () => {
        expect(Itmod.range(1, 11).takeEveryNth(1).toArray()).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
    });
    test("2 of 10", () => {
        expect(Itmod.range(1, 11).takeEveryNth(2).toArray()).toEqual([
            2, 4, 6, 8, 10,
        ]);
    });
    test("3 of 10", () => {
        expect(Itmod.range(1, 11).takeEveryNth(3).toArray()).toEqual([3, 6, 9]);
    });
    test("4 of 10", () => {
        expect(Itmod.range(1, 11).takeEveryNth(4).toArray()).toEqual([4, 8]);
    });
    test("5 of 10", () => {
        expect(Itmod.range(1, 11).takeEveryNth(5).toArray()).toEqual([5, 10]);
    });
    test("10 0f 10", () => {
        expect(Itmod.range(1, 11).takeEveryNth(10).toArray()).toEqual([10]);
    });
    test("11 of 10", () => {
        expect(Itmod.range(1, 11).takeEveryNth(11).toArray()).toEqual([]);
    });
    test("inf of 10", () => {
        expect(Itmod.range(1, 11).takeEveryNth(Infinity).toArray()).toEqual([]);
    });
});

describe("skipEveryNth", () => {
    test("1 of 10", () => {
        expect(Itmod.range(1, 11).skipEveryNth(1).toArray()).toEqual([]);
    });
    test("2 of 10", () => {
        expect(Itmod.range(1, 11).skipEveryNth(2).toArray()).toEqual([
            1, 3, 5, 7, 9,
        ]);
    });
    test("3 of 10", () => {
        expect(Itmod.range(1, 11).skipEveryNth(3).toArray()).toEqual([
            1, 2, 4, 5, 7, 8, 10,
        ]);
    });
    test("4 of 10", () => {
        expect(Itmod.range(1, 11).skipEveryNth(4).toArray()).toEqual([
            1, 2, 3, 5, 6, 7, 9, 10,
        ]);
    });
    test("5 of 10", () => {
        expect(Itmod.range(1, 11).skipEveryNth(5).toArray()).toEqual([
            1, 2, 3, 4, 6, 7, 8, 9,
        ]);
    });
    test("10 0f 10", () => {
        expect(Itmod.range(1, 11).skipEveryNth(10).toArray()).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);
    });
    test("11 of 10", () => {
        expect(Itmod.range(1, 11).skipEveryNth(11).toArray()).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
    });
    test("inf of 10", () => {
        expect(Itmod.range(1, 11).skipEveryNth(Infinity).toArray()).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
    });
});

describe("takeWhile", () => {
    test("always true", () => {
        expect(
            Itmod.range(1, 11)
                .takeWhile(() => true)
                .toArray()
        ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
    test("always false", () => {
        expect(
            Itmod.range(1, 11)
                .takeWhile(() => false)
                .toArray()
        ).toEqual([]);
    });
    test("true until 4", () => {
        expect(
            Itmod.range(1, 11)
                .takeWhile((n) => n !== 4)
                .toArray()
        ).toEqual([1, 2, 3]);
    });
    test("true until index 4", () => {
        expect(
            Itmod.range(1, 11)
                .takeWhile((_, i) => i !== 4)
                .toArray()
        ).toEqual([1, 2, 3, 4]);
    });
});

describe("skipWhile", () => {
    test("always true", () => {
        expect(
            Itmod.range(1, 11)
                .skipWhile(() => true)
                .toArray()
        ).toEqual([]);
    });
    test("always false", () => {
        expect(
            Itmod.range(1, 11)
                .skipWhile(() => false)
                .toArray()
        ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
    test("true until 4", () => {
        expect(
            Itmod.range(1, 11)
                .skipWhile((n) => n !== 4)
                .toArray()
        ).toEqual([4, 5, 6, 7, 8, 9, 10]);
    });
    test("true until index 4", () => {
        expect(
            Itmod.range(1, 11)
                .skipWhile((_, i) => i !== 4)
                .toArray()
        ).toEqual([5, 6, 7, 8, 9, 10]);
    });
});

describe("takeRandom", () => {
    test("0 from 10", () => {
        expect(Itmod.range(1, 11).shuffle().take(0).toArray()).toEqual([]);
    });
    test("4 from 10", () => {
        expect(Itmod.range(1, 11).shuffle().take(4).count()).toBe(4);
    });
    test("5 from 10", () => {
        expect(Itmod.range(1, 11).shuffle().take(5).count()).toBe(5);
    });
    test("15 from 10", () => {
        expect(Itmod.range(1, 11).shuffle().take(15).count()).toBe(10);
    });
    test("results are unique", () => {
        expect(Itmod.range(1, 11).shuffle().take(5).distinct().count()).toBe(5);
    });
});

describe("skipRandom", () => {
    test("0 from 10", () => {
        expect(Itmod.range(1, 11).skipRandom(0).toArray()).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
    });
    test("4 from 10", () => {
        expect(Itmod.range(1, 11).skipRandom(4).count()).toBe(6);
    });
    test("5 from 10", () => {
        expect(Itmod.range(1, 11).skipRandom(5).count()).toBe(5);
    });
    test("15 from 10", () => {
        expect(Itmod.range(1, 11).skipRandom(15).count()).toBe(0);
    });
    test("results are unique", () => {
        expect(Itmod.range(1, 11).skipRandom(5).distinct().count()).toBe(5);
    });
});

describe("nonIteratedCountOrUndefined", () => {
    test("from Array", () => {
        const itmod = Itmod.from([1, 2, 3]);
        expect(itmod.nonIteratedCountOrUndefined()).toBe(3);
    });
    test("from Set", () => {
        const itmod = Itmod.from(new Set([1, 2, 3]));
        expect(itmod.nonIteratedCountOrUndefined()).toBe(3);
    });
    test("from Map", () => {
        const itmod = Itmod.from(
            new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ])
        );
        expect(itmod.nonIteratedCountOrUndefined()).toBe(3);
    });
    test("from LinkedList", () => {
        const itmod = Itmod.from(new LinkedList([1, 2, 3]));
        expect(itmod.nonIteratedCountOrUndefined()).toBe(3);
    });
    test("from generator", () => {
        const itmod = Itmod.from(function* () {
            throw new Error(
                "source was iterated by nonIteratedCountOrUndefined"
            );
        });
        expect(itmod.nonIteratedCountOrUndefined()).toBe(undefined);
    });
    test("from expensive", () => {
        const itmod = Itmod.from(
            () => {
                throw new Error(
                    "expensive getSource was run by nonIteratedCountOrUndefined"
                );
            },
            { expensive: true }
        );
        expect(itmod.nonIteratedCountOrUndefined()).toBe(undefined);
    });
});

describe("count", () => {
    test("from Array", () => {
        const itmod = Itmod.from([1, 2, 3]);
        expect(itmod.count()).toBe(3);
    });
    test("from Set", () => {
        const itmod = Itmod.from(new Set([1, 2, 3]));
        expect(itmod.count()).toBe(3);
    });
    test("from Map", () => {
        const itmod = Itmod.from(
            new Map([
                [1, 1],
                [2, 2],
                [3, 3],
            ])
        );
        expect(itmod.count()).toBe(3);
    });
    test("from LinkedList", () => {
        const itmod = Itmod.from(new LinkedList([1, 2, 3]));
        expect(itmod.count()).toBe(3);
    });
    test("from generator", () => {
        const itmod = Itmod.from(function* () {
            yield 1;
            yield 2;
            yield 3;
        });
        expect(itmod.count()).toBe(3);
    });
});

describe("min", () => {
    test("4 of 10", () => {
        const itmod = Itmod.of(
            "00",
            "20",
            "40",
            "41",
            "21",
            "70",
            "50",
            "90",
            "10",
            "51"
        );
        const min = itmod.min(4, (n: string) => n.charAt(0));
        expect([...min]).toEqual(["00", "10", "20", "21"]);
    });
    test("4 of 2", () => {
        const itmod = Itmod.of(1, 0);
        const min = itmod.min(4);
        expect([...min]).toEqual([0, 1]);
    });
    test("4 of 0", () => {
        const itmod = Itmod.empty<number>();
        const min = itmod.min(4);
        expect([...min]).toEqual([]);
    });
    test("0 of 10", () => {
        const itmod = Itmod.of(
            "00",
            "20",
            "40",
            "41",
            "21",
            "70",
            "50",
            "90",
            "10",
            "51"
        );
        const min = itmod.min(0);
        expect([...min]).toEqual([]);
    });

    test("4n of 10", () => {
        const itmod = Itmod.of(
            "00",
            "20",
            "40",
            "41",
            "21",
            "70",
            "50",
            "90",
            "10",
            "51"
        );
        const min = itmod.min(4n, (n: string) => n.charAt(0));
        expect([...min]).toEqual(["00", "10", "20", "21"]);
    });
    test("4n of 2", () => {
        const itmod = Itmod.of(1, 0);
        const min = itmod.min(4n);
        expect([...min]).toEqual([0, 1]);
    });
    test("4n of 0", () => {
        const itmod = Itmod.empty<number>();
        const min = itmod.min(4n);
        expect([...min]).toEqual([]);
    });
    test("0n of 10", () => {
        const itmod = Itmod.of(
            "00",
            "20",
            "40",
            "41",
            "21",
            "70",
            "50",
            "90",
            "10",
            "51"
        );
        const min = itmod.min(0n);
        expect([...min]).toEqual([]);
    });
});

describe("max", () => {
    test("4 of 10", () => {
        const itmod = Itmod.of(
            "00",
            "20",
            "40",
            "41",
            "21",
            "70",
            "50",
            "90",
            "10",
            "51"
        );
        const max = itmod.max(4, (n: string) => n.charAt(0));
        expect([...max]).toEqual(["50", "51", "70", "90"]);
    });
    test("4 of 2", () => {
        const itmod = Itmod.of(1, 0);
        const max = itmod.max(4);
        expect([...max]).toEqual([0, 1]);
    });
    test("4 of 0", () => {
        const itmod = Itmod.empty<number>();
        const max = itmod.max(4);
        expect([...max]).toEqual([]);
    });
    test("0 of 10", () => {
        const itmod = Itmod.of(
            "00",
            "20",
            "40",
            "41",
            "21",
            "70",
            "50",
            "90",
            "10",
            "51"
        );
        const max = itmod.max(0);
        expect([...max]).toEqual([]);
    });

    test("4n of 10", () => {
        const itmod = Itmod.of(
            "00",
            "20",
            "40",
            "41",
            "21",
            "70",
            "50",
            "90",
            "10",
            "51"
        );
        const max = itmod.max(4n, (n: string) => n.charAt(0));
        expect([...max]).toEqual(["50", "51", "70", "90"]);
    });
    test("4n of 2", () => {
        const itmod = Itmod.of(1, 0);
        const max = itmod.max(4n);
        expect([...max]).toEqual([0, 1]);
    });
    test("4n of 0", () => {
        const itmod = Itmod.empty<number>();
        const max = itmod.max(4n);
        expect([...max]).toEqual([]);
    });
    test("0n of 10", () => {
        const itmod = Itmod.of(
            "00",
            "20",
            "40",
            "41",
            "21",
            "70",
            "50",
            "90",
            "10",
            "51"
        );
        const max = itmod.max(0n);
        expect([...max]).toEqual([]);
    });
});

describe("groupBy", () => {
    const itmod = Itmod.of(
        { state: "mt", name: "phillip" },
        { state: "wa", name: "james" },
        { state: "mt", name: "susan" },
        { state: "fl", name: "samantha" },
        { state: "mt", name: "john" },
        { state: "mt", name: "arnold" },
        { state: "wa", name: "steve" },
        { state: "wa", name: "charlie" },
        { state: "wa", name: "florida" }
    );
    describe("without Group selector", () => {
        // The types in this group of tests are completely and utterly discombobulated for no ascertainable reason within the limits of my observation and my comprehension!
        const grouped = itmod.groupBy((foo) => foo.state);

        test("correct order of keys", () => {
            expect([...grouped.map((g) => g[0])]).toEqual(["mt", "wa", "fl"]);
        });
        test("correct order in groups", () => {
            const map = grouped.toMap();

            expect(map.get("mt")!.map((c) => c.name)).toEqual([
                "phillip",
                "susan",
                "john",
                "arnold",
            ]);

            expect(map.get("wa")!.map((c) => c.name)).toEqual([
                "james",
                "steve",
                "charlie",
                "florida",
            ]);

            expect(map.get("fl")!.map((c) => c.name)).toEqual(["samantha"]);
        });
    });
    // TODO with multiple key selectors and with a group selectors
    // describe("with group selector", () => {
    //     const grouped = itmod.groupBy(
    //         (foo) => foo.state,
    //         // @ts-ignore
    //         (group) => group.map((c) => c.name).join()
    //     );
    //     test("correct order of keys", () => {
    //         expect([...grouped.map((g) => g[0])]).toEqual(["mt", "wa", "fl"]);
    //     });
    //     test("correct order in groups", () => {
    //         const map = grouped.toMap();
    //         expect(map.get("mt")).toBe("phillip,susan,john,arnold");
    //         expect(map.get("wa")).toBe("james,steve,charlie,florida");
    //         expect(map.get("fl")).toBe("samantha");
    //     });
    // });
});

describe("toArray", () => {
    test("finite items doesn't throw an error", () => {
        expect(() => {
            const itmod = Itmod.of(1, 3, 4, 5, 42, 5, 76, 7);
            expect(itmod.toArray()).toEqual([1, 3, 4, 5, 42, 5, 76, 7]);
        });
    });
});

describe("toSet", () => {
    test("finite items doesn't throw an error", () => {
        expect(() => {
            const itmod = Itmod.of(1, 3, 4, 5, 42, 5, 76, 7);
            expect([...itmod.toSet()]).toEqual(
                expect.arrayContaining([1, 3, 4, 5, 42, 5, 76, 7])
            );
            expect(itmod.toSet().size).toBe(8);
        });
    });
});

describe("toMap", () => {
    const itmod = Itmod.of(
        [5, "five", "V"],
        { 0: 23, 1: "twenty three", 2: "XXIII" },
        [0, "zero", ""],
        [1, "one", "I"]
    );
    test("default", () => {
        const map = itmod.toMap();
        expect([...map].map((e) => e[0])).toEqual([5, 23, 0, 1]);
        expect([...map].map((e) => e[1])).toEqual([
            "five",
            "twenty three",
            "zero",
            "one",
        ]);
    });
    test("with keySelector", () => {
        const map = itmod.toMap((e) => e[2]);
        expect([...map].map((e) => e[0])).toEqual(["V", "XXIII", "", "I"]);
        expect([...map].map((e) => e[1])).toEqual([
            "five",
            "twenty three",
            "zero",
            "one",
        ]);
    });
    test("with valueSelector", () => {
        const map = itmod.toMap(undefined, (e) => e[2]);
        expect([...map].map((e) => e[0])).toEqual([5, 23, 0, 1]);
        expect([...map].map((e) => e[1])).toEqual(["V", "XXIII", "", "I"]);
    });
    test("with keySelector and valueSelector", () => {
        const map = itmod.toMap(undefined, (e) => e[2]);
        expect([...map].map((e) => e[0])).toEqual([5, 23, 0, 1]);
        expect([...map].map((e) => e[1])).toEqual(["V", "XXIII", "", "I"]);
    });
});

describe("toObject", () => {
    const itmod = Itmod.of(
        [5, "five", "V"],
        { 0: 23, 1: "twenty three", 2: "XXIII" },
        [0, "zero", ""],
        [1, "one", "I"]
    );
    test("default", () => {
        const object = itmod.toObject();
        expect([...Object.entries(object)].map((e) => e[0])).toEqual(
            expect.arrayContaining(["5", "23", "0", "1"])
        );
        expect([...Object.entries(object)].map((e) => e[1])).toEqual(
            expect.arrayContaining(["five", "twenty three", "zero", "one"])
        );
    });
    test("with keySelector", () => {
        const object = itmod.toObject((e) => e[2]);
        expect([...Object.entries(object)].map((e) => e[0])).toEqual(
            expect.arrayContaining(["V", "XXIII", "", "I"])
        );
        expect([...Object.entries(object)].map((e) => e[1])).toEqual(
            expect.arrayContaining(["five", "twenty three", "zero", "one"])
        );
    });
    test("with valueSelector", () => {
        const object = itmod.toObject(undefined, (e) => e[2]);
        expect([...Object.entries(object)].map((e) => e[0])).toEqual(
            expect.arrayContaining(["5", "23", "0", "1"])
        );
        expect([...Object.entries(object)].map((e) => e[1])).toEqual(
            expect.arrayContaining(["V", "XXIII", "", "I"])
        );
    });
    test("with keySelector and valueSelector", () => {
        const object = itmod.toObject(
            (e) => e[1],
            (e) => e[2]
        );
        expect([...Object.entries(object)].map((e) => e[0])).toEqual(
            expect.arrayContaining(["five", "twenty three", "zero", "one"])
        );
        expect([...Object.entries(object)].map((e) => e[1])).toEqual(
            expect.arrayContaining(["V", "XXIII", "", "I"])
        );
    });
});

describe("asArray", () => {
    test("finite items doesn't throw an error", () => {
        expect(() => {
            const itmod = Itmod.of(1, 3, 4, 5, 42, 5, 76, 7);
            expect(itmod.toArray()).toEqual([1, 3, 4, 5, 42, 5, 76, 7]);
        });
    });
});

describe("asSet", () => {
    test("finite items doesn't throw an error", () => {
        expect(() => {
            const itmod = Itmod.of(1, 3, 4, 5, 42, 5, 76, 7);
            expect([...itmod.asSet()]).toEqual(
                expect.arrayContaining([1, 3, 4, 5, 42, 5, 76, 7])
            );
            expect(itmod.asSet().size).toBe(8);
        });
    });
});

describe("asMap", () => {
    const itmod = Itmod.of(
        [5, "five", "V"],
        { 0: 23, 1: "twenty three", 2: "XXIII" },
        [0, "zero", ""],
        [1, "one", "I"]
    );
    test("default", () => {
        const map = itmod.asMap();
        expect([...map].map((e) => e[0])).toEqual([5, 23, 0, 1]);
        expect([...map].map((e) => e[1])).toEqual([
            "five",
            "twenty three",
            "zero",
            "one",
        ]);
    });
    test("with keySelector", () => {
        const map = itmod.asMap((e) => e[2]);
        expect([...map].map((e) => e[0])).toEqual(["V", "XXIII", "", "I"]);
        expect([...map].map((e) => e[1])).toEqual([
            "five",
            "twenty three",
            "zero",
            "one",
        ]);
    });
    test("with valueSelector", () => {
        const map = itmod.asMap(undefined, (e) => e[2]);
        expect([...map].map((e) => e[0])).toEqual([5, 23, 0, 1]);
        expect([...map].map((e) => e[1])).toEqual(["V", "XXIII", "", "I"]);
    });
    test("with keySelector and valueSelector", () => {
        const map = itmod.asMap(undefined, (e) => e[2]);
        expect([...map].map((e) => e[0])).toEqual([5, 23, 0, 1]);
        expect([...map].map((e) => e[1])).toEqual(["V", "XXIII", "", "I"]);
    });
});

describe("asObject", () => {
    const itmod = Itmod.of(
        [5, "five", "V"],
        { 0: 23, 1: "twenty three", 2: "XXIII" },
        [0, "zero", ""],
        [1, "one", "I"]
    );
    test("default", () => {
        const object = itmod.asObject();
        expect([...Object.entries(object)].map((e) => e[0])).toEqual(
            expect.arrayContaining(["5", "23", "0", "1"])
        );
        expect([...Object.entries(object)].map((e) => e[1])).toEqual(
            expect.arrayContaining(["five", "twenty three", "zero", "one"])
        );
    });
    test("with keySelector", () => {
        const object = itmod.asObject((e) => e[2]);
        expect([...Object.entries(object)].map((e) => e[0])).toEqual(
            expect.arrayContaining(["V", "XXIII", "", "I"])
        );
        expect([...Object.entries(object)].map((e) => e[1])).toEqual(
            expect.arrayContaining(["five", "twenty three", "zero", "one"])
        );
    });
    test("with valueSelector", () => {
        const object = itmod.asObject(undefined, (e) => e[2]);
        expect([...Object.entries(object)].map((e) => e[0])).toEqual(
            expect.arrayContaining(["5", "23", "0", "1"])
        );
        expect([...Object.entries(object)].map((e) => e[1])).toEqual(
            expect.arrayContaining(["V", "XXIII", "", "I"])
        );
    });
    test("with keySelector and valueSelector", () => {
        const object = itmod.asObject(
            (e) => e[1],
            (e) => e[2]
        );
        expect([...Object.entries(object)].map((e) => e[0])).toEqual(
            expect.arrayContaining(["five", "twenty three", "zero", "one"])
        );
        expect([...Object.entries(object)].map((e) => e[1])).toEqual(
            expect.arrayContaining(["V", "XXIII", "", "I"])
        );
    });
});

describe("sort", () => {
    const itmod = Itmod.of(
        "23",
        "12",
        "54",
        "65",
        "67",
        "8",
        "17",
        "20",
        "20",
        "31",
        "45",
        "23",
        "75",
        "65",
        "62",
        "68",
        "90",
        "23",
        "12",
        "13",
        "15",
        "21",
        "5",
        "3",
        "4",
        "5",
        "8",
        "2",
        "7",
        "43",
        "5"
    );

    test("with default comparator", () => {
        const sorted = itmod.sort();
        expect([...sorted]).toEqual([
            "12",
            "12",
            "13",
            "15",
            "17",
            "2",
            "20",
            "20",
            "21",
            "23",
            "23",
            "23",
            "3",
            "31",
            "4",
            "43",
            "45",
            "5",
            "5",
            "5",
            "54",
            "62",
            "65",
            "65",
            "67",
            "68",
            "7",
            "75",
            "8",
            "8",
            "90",
        ]);
    });
    test("with custom comparator", () => {
        const sorted = itmod.sort((n) => parseInt(n));
        expect([...sorted]).toEqual([
            "2",
            "3",
            "4",
            "5",
            "5",
            "5",
            "7",
            "8",
            "8",
            "12",
            "12",
            "13",
            "15",
            "17",
            "20",
            "20",
            "21",
            "23",
            "23",
            "23",
            "31",
            "43",
            "45",
            "54",
            "62",
            "65",
            "65",
            "67",
            "68",
            "75",
            "90",
        ]);
    });
    test("with multiple custom comparators", () => {
        const itmod = Itmod.of(
            { state: "mt", firstName: "phillip", lastName: "grass", age: 5 },
            { state: "wa", firstName: "james", lastName: "bond", age: 10 },
            { state: "mt", firstName: "susan", lastName: "anthony", age: 40 },
            { state: "fl", firstName: "samantha", lastName: "jones", age: 12 },
            { state: "mt", firstName: "john", lastName: "john", age: 90 },
            {
                state: "mt",
                firstName: "arnold",
                lastName: "terminator",
                age: 90,
            },
            { state: "wa", firstName: "steve", lastName: "grand", age: 20 },
            { state: "wa", firstName: "charlie", lastName: "brown", age: 30 },
            { state: "wa", firstName: "florida", lastName: "man", age: 40 }
        );

        const sorted = itmod.sort(
            (a: any, b: any) => autoComparator(a.state, b.state),
            (c: any) => c.firstName,
            (c: any) => c.lastName,
            (c: any) => c.age
        );
        expect(sorted.map((c) => c.state).toArray()).toEqual([
            "fl",
            "mt",
            "mt",
            "mt",
            "mt",
            "wa",
            "wa",
            "wa",
            "wa",
        ]);
        expect(sorted.map((c) => c.firstName).toArray()).toEqual([
            "samantha",
            "arnold",
            "john",
            "phillip",
            "susan",
            "charlie",
            "florida",
            "james",
            "steve",
        ]);
        expect(sorted.map((c) => c.lastName).toArray()).toEqual([
            "jones",
            "terminator",
            "john",
            "grass",
            "anthony",
            "brown",
            "man",
            "bond",
            "grand",
        ]);
        expect(sorted.map((c) => c.age).toArray()).toEqual([
            12, 90, 90, 5, 40, 30, 40, 10, 20,
        ]);
    });
});

describe("sortDescending", () => {
    const itmod = Itmod.of(
        "23",
        "12",
        "54",
        "65",
        "67",
        "8",
        "17",
        "20",
        "20",
        "31",
        "45",
        "23",
        "75",
        "65",
        "62",
        "68",
        "90",
        "23",
        "12",
        "13",
        "15",
        "21",
        "5",
        "3",
        "4",
        "5",
        "8",
        "2",
        "7",
        "43",
        "5"
    );

    test("with default comparator", () => {
        const sorted = itmod.sortDescending().reverse();
        expect([...sorted]).toEqual([
            "12",
            "12",
            "13",
            "15",
            "17",
            "2",
            "20",
            "20",
            "21",
            "23",
            "23",
            "23",
            "3",
            "31",
            "4",
            "43",
            "45",
            "5",
            "5",
            "5",
            "54",
            "62",
            "65",
            "65",
            "67",
            "68",
            "7",
            "75",
            "8",
            "8",
            "90",
        ]);
    });
    test("with custom comparator", () => {
        const sorted = itmod.sortDescending((n) => parseInt(n)).reverse();
        expect([...sorted]).toEqual([
            "2",
            "3",
            "4",
            "5",
            "5",
            "5",
            "7",
            "8",
            "8",
            "12",
            "12",
            "13",
            "15",
            "17",
            "20",
            "20",
            "21",
            "23",
            "23",
            "23",
            "31",
            "43",
            "45",
            "54",
            "62",
            "65",
            "65",
            "67",
            "68",
            "75",
            "90",
        ]);
    });
    test("with multiple custom comparators", () => {
        const itmod = Itmod.of(
            { state: "mt", firstName: "phillip", lastName: "grass", age: 5 },
            { state: "wa", firstName: "james", lastName: "bond", age: 10 },
            { state: "mt", firstName: "susan", lastName: "anthony", age: 40 },
            { state: "fl", firstName: "samantha", lastName: "jones", age: 12 },
            { state: "mt", firstName: "john", lastName: "john", age: 90 },
            {
                state: "mt",
                firstName: "arnold",
                lastName: "terminator",
                age: 90,
            },
            { state: "wa", firstName: "steve", lastName: "grand", age: 20 },
            { state: "wa", firstName: "charlie", lastName: "brown", age: 30 },
            { state: "wa", firstName: "florida", lastName: "man", age: 40 }
        );

        const sorted = itmod
            .sortDescending(
                (a: any, b: any) => autoComparator(a.state, b.state),
                (c: any) => c.firstName,
                (c: any) => c.lastName,
                (c: any) => c.age
            )
            .reverse();
        expect(sorted.map((c) => c.state).toArray()).toEqual([
            "fl",
            "mt",
            "mt",
            "mt",
            "mt",
            "wa",
            "wa",
            "wa",
            "wa",
        ]);
        expect(sorted.map((c) => c.firstName).toArray()).toEqual([
            "samantha",
            "arnold",
            "john",
            "phillip",
            "susan",
            "charlie",
            "florida",
            "james",
            "steve",
        ]);
        expect(sorted.map((c) => c.lastName).toArray()).toEqual([
            "jones",
            "terminator",
            "john",
            "grass",
            "anthony",
            "brown",
            "man",
            "bond",
            "grand",
        ]);
        expect(sorted.map((c) => c.age).toArray()).toEqual([
            12, 90, 90, 5, 40, 30, 40, 10, 20,
        ]);
    });
});

test("shuffle", () => {
    // not really any guarantied way to test shuffle.
    expect(Itmod.of(1, 2, 3).shuffle().count()).toBe(3);
    expect(Itmod.of(1, 2, 3).shuffle().toArray()).toEqual(
        expect.arrayContaining([1, 2, 3])
    );
});

test("collapse", () => {
    let i = 0;
    const itmod = Itmod.generate(3, () => i++).collapse();
    expect(itmod.toArray()).toEqual([0, 1, 2]);
    expect(itmod.toArray()).toEqual([0, 1, 2]);
});

describe("sequenceEqual", () => {
    describe("default is function", () => {
        test("equal", () => {
            expect(
                Itmod.of(1, 4, 5, 5, 6, 7, 8).sequenceEquals([
                    1, 4, 5, 5, 6, 7, 8,
                ])
            ).toBe(true);
        });
        test("notEqual", () => {
            expect(
                Itmod.of(1, 4, 5, 5, 6, 7, 8).sequenceEquals([1, 3, 6, 8, 6, 7])
            ).toBe(false);
        });
    });
    describe("custom is function", () => {
        test("equal", () => {
            expect(
                Itmod.of(
                    "12",
                    "46",
                    "54",
                    "53",
                    "64",
                    "74",
                    "85"
                ).sequenceEquals(
                    ["12", "46", "54", "33", "64", "24", "85"],
                    (a, b) => a[1] === b[1]
                )
            ).toBe(true);
        });
        test("notEqual", () => {
            expect(
                Itmod.of(
                    "12",
                    "46",
                    "54",
                    "53",
                    "64",
                    "74",
                    "85"
                ).sequenceEquals(
                    ["14", "46", "54", "33", "64", "24"],
                    (a, b) => a[1] === b[1]
                )
            ).toBe(false);
        });
    });
});

describe("includes", () => {
    const fromIterable = Itmod.from<number>(function* () {
        yield 1;
        yield 2;
        yield 3;
    });
    const fromSet = Itmod.from<number>(new Set([1, 2, 3]));
    describe("does include", () => {
        test("iterable", () => {
            expect(fromIterable.includes(1)).toBe(true);
            expect(fromIterable.includes(2)).toBe(true);
            expect(fromIterable.includes(3)).toBe(true);
        });
        test("set", () => {
            expect(fromSet.includes(1)).toBe(true);
            expect(fromSet.includes(2)).toBe(true);
            expect(fromSet.includes(3)).toBe(true);
        });
    });

    describe("doesn't include", () => {
        test("iterable", () => {
            expect(fromIterable.includes(0)).toBe(false);
            expect(fromIterable.includes(4)).toBe(false);
        });
        test("set", () => {
            expect(fromSet.includes(0)).toBe(false);
            expect(fromSet.includes(4)).toBe(false);
        });
    });
});

describe("some", () => {
    test("outputs true", () => {
        expect(of(0, 1, 2.5, 3).some((n, i) => n !== i)).toBe(true);
        expect(of(0, 1, 2, 3.5).some((n, i) => n !== i)).toBe(true);
        expect(of(0, 1, 2, 3.5).some((n, i) => n === i)).toBe(true);
    });
    test("outputs false", () => {
        expect(of(0, 1, 2, 3).some((n, i) => n !== i)).toBe(false);
        expect(of(0.7, 1.1, 2.1, 3.5).some((n, i) => n === i)).toBe(false);
    });
});

describe("none", () => {
    test("outputs true", () => {
        expect(of(0, 1, 2, 3).none((n, i) => n !== i)).toBe(true);
        expect(of(0.7, 1.1, 2.1, 3.5).none((n, i) => n === i)).toBe(true);
    });
    test("outputs false", () => {
        expect(of(0, 1, 2.5, 3).none((n, i) => n !== i)).toBe(false);
        expect(of(0, 1, 2, 3.5).none((n, i) => n !== i)).toBe(false);
        expect(of(0, 1, 2, 3.5).none((n, i) => n === i)).toBe(false);
    });
});

describe("every", () => {
    test("outputs true", () => {
        expect(of(0, 1, 2, 3).every((n, i) => n === i)).toBe(true);
        expect(of(0.7, 1.1, 2.1, 3.5).every((n, i) => n !== i)).toBe(true);
    });
    test("outputs false", () => {
        expect(of(0, 1.2, 2.4, 3).every((n, i) => n === i)).toBe(false);
        expect(of(0.7, 1.1, 2, 3.5).every((n, i) => n !== i)).toBe(false);
    });
});

describe("distinct", () => {
    test("already distinct results in the same thing", () => {
        expect(of(0, 1, 2, 3).distinct().sequenceEquals([0, 1, 2, 3])).toBe(
            true
        );
    });
    test("non distinct results in something different that is distinct", () => {
        expect(
            of(0, 1, 0, 2, 3, 1).distinct().sequenceEquals([0, 1, 2, 3])
        ).toBe(true);
    });
});

describe.each([
    { name: "from string", itmod: from("abcdefg") },
    { name: "from char array", itmod: from(["x", "y", "z"]) },
    { name: "numbers", itmod: range(10) },
])("makeString", ({ name, itmod }) => {
    test("no args -- " + name, () => {
        expect(itmod.makeString()).toBe(itmod.toArray().join(""));
    });
    test('makeString("*") -- ' + name, () => {
        expect(itmod.makeString("*")).toBe(itmod.toArray().join("*"));
    });
    test('makeString("@", "*") -- ' + name, () => {
        expect(itmod.makeString("@", "*")).toBe(
            "@" + itmod.toArray().join("*")
        );
    });
    test('makeString("@", "*", "@") -- ' + name, () => {
        expect(itmod.makeString("@", "*", "@")).toBe(
            "@" + itmod.toArray().join("*") + "@"
        );
    });
    test('makeString("", "*", "@") -- ' + name, () => {
        expect(itmod.makeString("", "*", "@")).toBe(
            itmod.toArray().join("*") + "@"
        );
    });
    test('makeString("@", "", "@") -- ' + name, () => {
        expect(itmod.makeString("@", "", "@")).toBe(
            "@" + itmod.toArray().join("") + "@"
        );
    });
    test('makeString("@", "*", "") -- ' + name, () => {
        expect(itmod.makeString("@", "*", "")).toBe(
            "@" + itmod.toArray().join("*")
        );
    });
    test('makeString("", "", "@") -- ' + name, () => {
        expect(itmod.makeString("", "", "@")).toBe(
            itmod.toArray().join("") + "@"
        );
    });
    test('makeString("", "*", "") -- ' + name, () => {
        expect(itmod.makeString("", "*", "")).toBe(itmod.toArray().join("*"));
    });
    test('makeString("@", "", "") -- ' + name, () => {
        expect(itmod.makeString("@", "", "")).toBe(
            "@" + itmod.toArray().join("")
        );
    });
    test('makeString("", "", "") -- ' + name, () => {
        expect(itmod.makeString("", "", "")).toBe(itmod.toArray().join(""));
    });
});

// TODO tests for defined, notNull, zip, including, flat, split, partitionBySize, append, prepend, min without count and max without count, groupJoin, join, innerGroupJoin, innerJoin, union, intersection, difference, replaceWhenEmpty
// TODO test for every method in itmod and its children

// TODO big list of Itmods made in special ways to test

/*
 * TODO list of special cases to test
 * - take from fresh array
 * - takeWhile from fresh array
 * - groupBy then toMap
 * - partitionBySize with infinity, with fresh array and without
 * - sort,sortDescending then toArray
 * - sort,sortDescending then thenBy,thenByDescending
 * - takeFinal then toArray,asArray
 * - from various collections then toArray,asArray
 * - from array then asArray
 * - map and then skip,skipFinal,skipEveryNth,skipRandom,takeFinal,takeEveryNth,takeRandom with multiple combinations
 * -
 *
 *
 * TODO find other special cases to test
 *
 */

// really bad implementation of consistency tests
// TODO do better

// did reveal a bug in partitionBySize though

// and a bug in prepend which was causing it to iterate the source twice, which broke on generators which can only be iterated once.

/** bunch of itmods for doing consistency tests */
const itmods = {
    empty: () =>
        [
            () => empty(),
            () => of(),
            () => from([]),
            () => from(function* () {}),
            () => fromIterator(function* () {}),
            () => from((function* () {})()),
            () => fromIterator([][Symbol.iterator]()),
            () => fromObject({}),
            () => generate(0, (i) => i + 1),
            () => new Itmod({ fresh: true }, () => []),
            () => new Itmod({ fresh: true, expensive: true }, () => []),
            ...from(itmods.oneThroughTen()).map(
                (itmod) => () => itmod().take(0)
            ),
            ...from(itmods.oneThroughTen()).map(
                (itmod) => () => itmod().filter(() => false)
            ),
            ...from(itmods.oneThroughTen()).map(
                (itmod) => () => itmod().takeWhile(() => false)
            ),
            ...from(itmods.oneThroughTen()).map(
                (itmod) => () => itmod().takeFinal(0)
            ),
            ...from(itmods.oneThroughTen()).map(
                (itmod) => () => itmod().min(0)
            ),
            ...from(itmods.oneThroughTen()).map(
                (itmod) => () => itmod().max(0)
            ),
            ...from(itmods.oneThroughTen()).map(
                (itmod) => () => itmod().takeRandom(0)
            ),
        ] as (() => Itmod<number>)[],
    oneThroughTen: () =>
        [
            () =>
                from(() => {
                    const cb = new CircularBuffer(10);
                    for (const n of range(1, 11)) cb.push(n);
                    return cb;
                }),
            () => from(new LinkedList(range(1, 11))),
            () => from(() => new LinkedList(range(1, 11)), { fresh: true }),
            () => range(1, 100).shuffle().min(10),
            () => range(-100, 11).shuffle().max(10),
            () => range(1, 100).shuffle().collapse().min(10),
            () => range(-100, 11).shuffle().collapse().max(10),
            () => of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
            () => from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
            () => from(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
            () => from(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { fresh: true }),
            () =>
                from(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
                    expensive: true,
                }),
            () =>
                from(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
                    fresh: true,
                    expensive: true,
                }),
            () =>
                from(function* () {
                    for (let i = 1; i <= 10; i++) yield i;
                }),
            () =>
                fromIterator(function* () {
                    for (let i = 1; i <= 10; i++) yield i;
                }),
            () =>
                from(
                    (function* () {
                        for (let i = 1; i <= 10; i++) yield i;
                    })()
                ),
            () =>
                fromIterator(
                    (function* () {
                        for (let i = 1; i <= 10; i++) yield i;
                    })()
                ),
            () =>
                fromIterator(
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10][Symbol.iterator]()
                ),
            () => range(1, 11),
            () => generate(10, (i) => i + 1),
            () => range(1, 11).shuffle().sort(),
        ] as (() => Itmod<number>)[],
    one: () => [
        () => of(1),
        () => from([1]),
        () =>
            from(function* () {
                yield 1;
            }),
        () =>
            fromIterator(function* () {
                yield 1;
            }),
        () =>
            from(
                (function* () {
                    yield 1;
                })()
            ),
        () =>
            fromIterator(
                (function* () {
                    yield 1;
                })()
            ),
        ...itmods.oneThroughTen().map((itmod) => () => itmod().take(1)),
        ...itmods.oneThroughTen().map((itmod) => () => itmod().skipFinal(9)),
        ...itmods.oneThroughTen().map((itmod) => () => itmod().min(1)),
    ],
};

const numberItmodToItmodTests: ((itmod: Itmod<number>) => Itmod<any>)[] = [
    (itmod) => itmod.map(identity),
    (itmod) => itmod.map((t) => t),
    (itmod) => itmod.append(1),
    (itmod) => itmod.collapse(),
    (itmod) => itmod.concat([1, 2]),
    (itmod) => itmod.copyWithin(1, 0, 1),
    (itmod) => itmod.distinct(),
    (itmod) => itmod.filter((n) => n > 5),
    (itmod) => itmod.filter((n) => n >= 5),
    (itmod) => itmod.filter((n) => n < 5),
    (itmod) => itmod.filter((n) => n === 5),
    (itmod) => itmod.flat(),
    (itmod) => itmod.groupBy((n) => n % 2),
    (itmod) => itmod.groupBy((n) => n % 2 === 0),
    (itmod) => itmod.indexBy((n) => n % 2),
    (itmod) => itmod.indexBy((n) => n % 2 === 0),
    (itmod) => itmod.indexBy((n) => n % 4),
    (itmod) => itmod.max(10),
    (itmod) => itmod.max(20),
    (itmod) => itmod.min(2),
    (itmod) => itmod.min(1),
    (itmod) => itmod.min(0),
    (itmod) => itmod.max(20),
    (itmod) => itmod.max(10),
    (itmod) => itmod.max(2),
    (itmod) => itmod.max(1),
    (itmod) => itmod.max(0),
    (itmod) => itmod.map((n) => n * 2),
    (itmod) => itmod.map((n, i) => n + i),
    (itmod) => itmod.map((n, i) => n * i),
    (itmod) => itmod.concat([null, undefined]).notNull(),
    (itmod) => itmod.concat([null, undefined]).defined(),
    (itmod) => itmod.concat([null, undefined]).notNull().defined(),
    (itmod) => itmod.concat([null, undefined]).notNullish(),
    (itmod) => itmod.union([1, 2, 6, 8, 10, 11, 13, 14]),
    (itmod) => itmod.union([1, 2, 6]),
    (itmod) => itmod.union([11111, 2, 6]),
    (itmod) => itmod.union([1, 1, 1, 1, 1, 2, 6]),
    (itmod) => itmod.partitionBySize(1),
    (itmod) => itmod.partitionBySize(2),
    (itmod) => itmod.partitionBySize(5),
    (itmod) => itmod.partitionBySize(10),
    (itmod) => itmod.partitionBySize(11),
    (itmod) => itmod.partitionBySize(9),
    (itmod) => itmod.partitionBySize(Infinity),
    (itmod) => itmod.preConcat([1, 2, 3]),
    (itmod) => itmod.append(1),
    (itmod) => itmod.prepend(1),
    (itmod) => itmod.repeat(2),
    (itmod) => itmod.repeat(1),
    (itmod) => itmod.repeat(0),
    (itmod) => itmod.repeat(-1),
    (itmod) => itmod.repeat(-2),
    (itmod) => itmod.replaceEmptyWith([1, 2, 3]),
    (itmod) => itmod.take(1),
    (itmod) => itmod.take(0),
    (itmod) => itmod.take(5),
    (itmod) => itmod.take(10),
    (itmod) => itmod.take(11),
    (itmod) => itmod.take(Infinity),
    (itmod) => itmod.take(9),
    (itmod) => itmod.skip(0),
    (itmod) => itmod.skip(9),
    (itmod) => itmod.skip(10),
    (itmod) => itmod.skip(Infinity),
    (itmod) => itmod.skip(11),
    (itmod) => itmod.skipFinal(0),
    (itmod) => itmod.skipFinal(1),
    (itmod) => itmod.skipFinal(5),
    (itmod) => itmod.skipFinal(9),
    (itmod) => itmod.skipFinal(10),
    (itmod) => itmod.skipFinal(11),
    (itmod) => itmod.skipFinal(Infinity),
    (itmod) => itmod.skipEveryNth(1),
    (itmod) => itmod.skipEveryNth(2),
    (itmod) => itmod.skipEveryNth(3),
    (itmod) => itmod.skipEveryNth(5),
    (itmod) => itmod.skipEveryNth(9),
    (itmod) => itmod.skipEveryNth(10),
    (itmod) => itmod.skipEveryNth(11),
    (itmod) => itmod.skipEveryNth(Infinity),
    (itmod) => itmod.skipWhile((n) => n < 2),
    (itmod) => itmod.skipWhile((n) => n > 2),
    (itmod) => itmod.skipWhile((n) => n <= 2),
    (itmod) => itmod.skipWhile((n) => n >= 2),
    (itmod) => itmod.takeFinal(0),
    (itmod) => itmod.takeFinal(1),
    (itmod) => itmod.takeFinal(2),
    (itmod) => itmod.takeFinal(5),
    (itmod) => itmod.takeFinal(9),
    (itmod) => itmod.takeFinal(10),
    (itmod) => itmod.takeFinal(11),
    (itmod) => itmod.takeFinal(Infinity),
    (itmod) => itmod.takeEveryNth(1),
    (itmod) => itmod.takeEveryNth(2),
    (itmod) => itmod.takeEveryNth(3),
    (itmod) => itmod.takeEveryNth(5),
    (itmod) => itmod.takeEveryNth(9),
    (itmod) => itmod.takeEveryNth(10),
    (itmod) => itmod.takeEveryNth(11),
    (itmod) => itmod.takeEveryNth(Infinity),
    (itmod) => itmod.takeWhile((n) => n < 2),
    (itmod) => itmod.takeWhile((n) => n > 2),
    (itmod) => itmod.takeWhile((n) => n >= 2),
    (itmod) => itmod.takeWhile((n) => n <= 2),
    (itmod) => itmod.reverse(),
    (itmod) => itmod.shuffle().sort(),
    (itmods) => itmods.partitionBySize(2).flat(),
    (itmods) => itmods.preConcat([1, 2, 3]),
    (itmods) => itmods.prepend(1),
    (itmods) => itmods.collapse(),
    (itmod) => itmod.takeRandom(4, () => 0),
    (itmod) => itmod.skipRandom(4, () => 0),
    (itmod) => itmod.takeRandom(1, () => 0).shuffle(() => 0),
    (itmod) => itmod.skipRandom(1, () => 0).shuffle(() => 0),
    (itmod) =>
        itmod.zip([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12], {
            loose: true,
        }),
    (itmod) =>
        itmod.zip([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10], { loose: true }),
    (itmod) => itmod.zip([-1, -2, -3, -4, -5, -6, -7, -8, -9], { loose: true }),
    (itmod) =>
        itmod.zip([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12], {
            loose: false,
        }),
    (itmod) =>
        itmod.zip([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10], { loose: false }),
    (itmod) =>
        itmod.zip([-1, -2, -3, -4, -5, -6, -7, -8, -9], { loose: false }),
    (itmod) =>
        itmod.groupJoin(
            range(100),
            (s) => s.toString().charAt(0),
            (o) => o.toString().charAt(o.toString().length - 1),
            (s, o) =>
                of(s)
                    .concat(o)
                    .reduce((a, b) => a * b)
        ),
];

const numberItmodToAnyTests: ((itmod: Itmod<number>) => unknown)[] = [
    (itmod) => itmod.every((n) => n >= 1),
    (itmod) => itmod.every((n) => n > 1),
    (itmod) => itmod.every((n) => n === 1),
    (itmod) => itmod.every((n) => n === 0),
    (itmod) => itmod.some((n) => n >= 1),
    (itmod) => itmod.some((n) => n > 1),
    (itmod) => itmod.some((n) => n === 1),
    (itmod) => itmod.some((n) => n === 0),
    (itmod) => itmod.none((n) => n >= 1),
    (itmod) => itmod.none((n) => n > 1),
    (itmod) => itmod.none((n) => n === 1),
    (itmod) => itmod.none((n) => n === 0),
    (itmod) => itmod.first(),
    (itmod) => itmod.final(),
    (itmod) => itmod.fold(-5, (a, b) => a + b),
    (itmod) => itmod.fold(0, (a, b) => a + b),
    (itmod) => itmod.fold(5, (a, b) => a + b),
    (itmod) =>
        itmod.fold(
            -5,
            (a, b) => a + b,
            (t, c) => t / c
        ),
    (itmod) =>
        itmod.fold(
            0,
            (a, b) => a + b,
            (t, c) => t / c
        ),
    (itmod) =>
        itmod.fold(
            5,
            (a, b) => a + b,
            (t, c) => t / c
        ),

    (itmod) => itmod.fold(5, Math.max),
    (itmod) => itmod.fold(5, Math.max, (max, count) => max + count),
    (itmod) => itmod.reduce<number>((a, b) => a + b),
    (itmod) =>
        itmod.reduce(
            (a, b) => a + b,
            (t, c) => t / c
        ),
    (itmod) => itmod.reduce(Math.max),
    (itmod) => itmod.reduce(Math.max, (max, count) => max + count),
    (itmod) => [...itmod.getSource()],
    (itmod) => itmod.includes(0),
    (itmod) => itmod.includes(1),
    (itmod) => itmod.includes(4),
    (itmod) => itmod.includes(9),
    (itmod) => itmod.includes(10),
    (itmod) => itmod.includes(11),
    (itmod) => itmod.toArray(),
    (itmod) => itmod.max(),
    (itmod) => itmod.min(),
    (itmod) => itmod.sequenceEquals([]),
    (itmod) => itmod.sequenceEquals([1, 2, 3, 4, 5]),
    (itmod) => itmod.sequenceEquals([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    (itmod) => itmod.count(),
    (itmod) => itmod.groupBy((n) => n % 2 === 0).toObject(),
    (itmod) => itmod.indexBy((n) => n % 2).toObject(),
    (itmod) => itmod.indexBy((n) => n % 3).toObject(),
    (itmod) => itmod.indexBy((n) => n % 4).toObject(),
    (itmod) => itmod.makeString(),
    (itmod) => itmod.makeString(","),
    (itmod) => itmod.makeString("[", ","),
    (itmod) => itmod.makeString("[", ",", "]"),
    (itmod) => itmod.makeString("", ",", "]"),
    (itmod) => itmod.makeString("", "", "]"),
    (itmod) => itmod.makeString("", "", ""),
    ...from(numberItmodToItmodTests).map(
        (t) => (itmod: Itmod<number>) => t(itmod).toArray()
    ),
    ...from(numberItmodToItmodTests).map((t) => (itmod: Itmod<number>) => [
        ...t(itmod),
    ]),
];

describe("consistency tests", () => {
    test("empty", () => {
        for (const t of numberItmodToAnyTests) {
            let output: string | undefined = undefined;
            for (const empty of itmods.empty()) {
                if (output === undefined) {
                    output = JSON.stringify(t(empty()));
                } else {
                    expect(
                        JSON.stringify(t(empty())),
                        t.toString() + " | " + empty.toString()
                    ).toBe(output);
                }
            }
        }
    });
    test("one", () => {
        for (const t of numberItmodToAnyTests) {
            let output: string | undefined = undefined;
            for (const empty of itmods.one()) {
                if (output === undefined) {
                    output = JSON.stringify(t(empty()));
                } else {
                    expect(
                        JSON.stringify(t(empty())),
                        t.toString() + " | " + empty.toString()
                    ).toBe(output);
                }
            }
        }
        for (const t of numberItmodToItmodTests) {
            let output: string | undefined = undefined;
            for (const one of itmods.one()) {
                if (output === undefined) {
                    output = JSON.stringify(t(one()).toArray());
                } else {
                    expect(
                        JSON.stringify(t(one()).toArray()),
                        t.toString() +
                            " | " +
                            one.toString() +
                            " | " +
                            one().makeString(", ") +
                            " | " +
                            t(one()).makeString(", ")
                    ).toBe(output);
                }
            }
        }
    });
    test("one through ten", () => {
        for (const t of numberItmodToAnyTests) {
            let output: string | undefined = undefined;
            for (const empty of itmods.oneThroughTen()) {
                if (output === undefined) {
                    output = JSON.stringify(t(empty()));
                } else {
                    expect(
                        JSON.stringify(t(empty())),
                        t.toString() + " | " + empty.toString()
                    ).toBe(output);
                }
            }
        }
    });
});
