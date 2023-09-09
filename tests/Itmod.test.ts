import Itmod from "../src/Itmod";
import LinkedList from "../src/collections/LinkedList";
import NeverEndingOperationError from "../src/errors/NeverEndingOperationError";
import { breakSignal } from "../src/signals";

test("iterator", () => {
    const itmod = Itmod.of(1, 2, 3, 4);
    const array = [] as number[];

    for (const n of itmod) {
        array.push(n);
    }

    expect(array).toEqual(expect.arrayContaining([1, 2, 3, 4]));
});

test("constructor", () => {
    const itmod = new Itmod({}, () => [1, 2, 3, 4]);
    expect([...itmod]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
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
        expect([...itmod]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    });
    test("iterator", () => {
        const itmod = Itmod.from([1, 2, 3, 4][Symbol.iterator]());
        expect([...itmod]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    });
    test("iterableGetter", () => {
        const itmod = Itmod.from(() => ({
            *[Symbol.iterator]() {
                for (const n of [1, 2, 3, 4]) {
                    yield n;
                }
            },
        }));
        expect([...itmod]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    });
    test("iteratorGetter", () => {
        const itmod = Itmod.from(() => [1, 2, 3, 4][Symbol.iterator]());
        expect([...itmod]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    });
});

test("of", () => {
    const itmod = Itmod.of(1, 2, 3, 4);
    expect([...itmod]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
});

test("empty", () => {
    const itmod = Itmod.empty();
    expect(itmod.count()).toBe(0);
    expect([...itmod]).toEqual(expect.arrayContaining([]));
});

describe("fromObject", () => {
    test("string keys only", () => {
        const foo = Symbol("foo");
        const itmod = Itmod.fromObject(
            { [foo]: 1, bar: 2 },
            { includeStringKeys: true, includeSymbolKeys: false }
        );
        const array = [...itmod];
        expect(array.map((entry) => entry[0])).toEqual(
            expect.arrayContaining(["bar"])
        );
    });
    test("symbol keys only", () => {
        const foo = Symbol("foo");
        const itmod = Itmod.fromObject(
            { [foo]: 1, bar: 2 },
            { includeStringKeys: false, includeSymbolKeys: true }
        );
        const array = [...itmod];
        expect(array.map((entry) => entry[0])).toEqual(
            expect.arrayContaining([foo])
        );
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
        expect([...itmod]).toEqual(
            expect.arrayContaining(["foo", "foo", "foo", "foo"])
        );
    });
    test("bigint count of fixed item", () => {
        const itmod = Itmod.generate(4n, "foo");
        expect([...itmod]).toEqual(
            expect.arrayContaining(["foo", "foo", "foo", "foo"])
        );
    });
    test("number count of callback item", () => {
        const itmod = Itmod.generate(4, (i) => i + 1);
        expect([...itmod]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    });
    test("bigint count of callback item", () => {
        const itmod = Itmod.generate(4n, (i) => i + 1n);
        expect([...itmod]).toEqual(expect.arrayContaining([1n, 2n, 3n, 4n]));
    });
});

describe("range", () => {
    describe("bigint start, end, step", () => {
        describe("positive step", () => {
            test("start less than end", () => {
                const itmod = Itmod.range(-4n, 6n, 2n);
                expect([...itmod]).toEqual(
                    expect.arrayContaining([-4n, -2n, 0n, 2n, 4n])
                );
            });
            test("end less than start to be empty", () => {
                const itmod = Itmod.range(4n, -6n, 2n);
                expect([...itmod]).toEqual(expect.arrayContaining([]));
                expect(itmod.count()).toBe(0);
            });
        });
        describe("negative step", () => {
            test("end less than start", () => {
                const itmod = Itmod.range(4n, -6n, -2n);
                expect([...itmod]).toEqual(
                    expect.arrayContaining([4n, 2n, 0n, -2n, -4n])
                );
            });
            test("start less than end to be empty", () => {
                const itmod = Itmod.range(-4n, 6n, -2n);
                expect([...itmod]).toEqual(expect.arrayContaining([]));
                expect(itmod.count()).toBe(0);
            });
        });
    });
    describe("bigint start, end", () => {
        test("start less than end", () => {
            const itmod = Itmod.range(-2n, 3n);
            expect([...itmod]).toEqual(
                expect.arrayContaining([-2n, -1n, 0n, 1n, 2n])
            );
        });
        test("end less than start to be empty", () => {
            const itmod = Itmod.range(2n, -3n);
            expect([...itmod]).toEqual(expect.arrayContaining([]));
            expect(itmod.count()).toBe(0);
        });
    });
    describe("bigint end", () => {
        test("5n end to not be empty", () => {
            const itmod = Itmod.range(5n);
            expect([...itmod]).toEqual(
                expect.arrayContaining([0n, 1n, 2n, 3n, 4n])
            );
        });
        test("0n end to be empty", () => {
            const itmod = Itmod.range(0n);
            expect([...itmod]).toEqual(expect.arrayContaining([]));
            expect(itmod.count()).toBe(0);
        });
    });
    describe("start, end, step", () => {
        describe("positive step", () => {
            test("start less than end", () => {
                const itmod = Itmod.range(-4, 6, 2);
                expect([...itmod]).toEqual(
                    expect.arrayContaining([-4, -2, 0, 2, 4])
                );
            });
            test("end less than start to be empty", () => {
                const itmod = Itmod.range(4, -6, 2);
                expect([...itmod]).toEqual(expect.arrayContaining([]));
                expect(itmod.count()).toBe(0);
            });
        });
        describe("negative step", () => {
            test("end less than start", () => {
                const itmod = Itmod.range(4, -6, -2);
                expect([...itmod]).toEqual(
                    expect.arrayContaining([4, 2, 0, -2, -4])
                );
            });
            test("start less than end to be empty", () => {
                const itmod = Itmod.range(-4, 6, -2);
                expect([...itmod]).toEqual(expect.arrayContaining([]));
                expect(itmod.count()).toBe(0);
            });
        });
    });
    describe("start, end", () => {
        test("start less than end", () => {
            const itmod = Itmod.range(-2, 3);
            expect([...itmod]).toEqual(
                expect.arrayContaining([-2, -1, 0, 1, 2])
            );
        });
        test("end less than start to be empty", () => {
            const itmod = Itmod.range(2n, -3n);
            expect([...itmod]).toEqual(expect.arrayContaining([]));
            expect(itmod.count()).toBe(0);
        });
    });
    describe("end", () => {
        test("5 end to not be empty", () => {
            const itmod = Itmod.range(5);
            expect([...itmod]).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]));
        });
        test("0 end to be empty", () => {
            const itmod = Itmod.range(0);
            expect([...itmod]).toEqual(expect.arrayContaining([]));
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
        expect(array).toEqual(expect.arrayContaining([2, 4, 6, 84]));
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
        expect(array).toEqual(expect.arrayContaining([]));
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
        expect(array).toEqual(expect.arrayContaining([2, 4]));
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
        expect(array).toEqual(expect.arrayContaining([0, 2, 4, 6]));
    });
});

describe("map", () => {
    test("mapping of 4 numbers", () => {
        const itmod = Itmod.of(1, 2, 3, 42);
        const mapped = itmod.map((item) => item * 2);
        expect([...mapped]).toEqual(expect.arrayContaining([2, 4, 6, 84]));
        expect(mapped.count()).toBe(4);
    });
    test("mapping of empty is empty", () => {
        const itmod = Itmod.empty<number>();
        const mapped = itmod.map((item) => item * 2);
        expect([...mapped]).toEqual(expect.arrayContaining([]));
        expect(mapped.count()).toBe(0);
    });
    test("index", () => {
        const itmod = Itmod.of(1, 2, 3, 42);
        const mapped = itmod.map((_item, index) => index * 2);
        expect([...mapped]).toEqual(expect.arrayContaining([0, 2, 4, 6]));
        expect(mapped.count()).toBe(4);
    });
});

describe("filter", () => {
    test("out of 10 numbers", () => {
        const itmod = Itmod.of(1, 2, 3, 42, 5, 6, 7, 8, 69);
        const filtered = itmod.filter((n) => n % 2 === 0);
        expect([...filtered]).toEqual(expect.arrayContaining([2, 42, 6, 8]));
        expect(filtered.count()).toBe(4);
    });
    test("out of empty is emtpy", () => {
        const itmod = Itmod.empty<number>();
        const filtered = itmod.filter((n) => n % 2 === 0);
        expect([...filtered]).toEqual(expect.arrayContaining([]));
        expect(filtered.count()).toBe(0);
    });
    test("index", () => {
        const itmod = Itmod.of(1, 2, 3, 42, 5, 6, 7, 8, 69);
        const filtered = itmod.filter((_, i) => i % 2 === 0);
        expect([...filtered]).toEqual(expect.arrayContaining([1, 3, 5, 7, 69]));
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
        expect([...reversed]).toEqual(expect.arrayContaining([]));
    });
    test("of length 1", () => {
        const itmod = Itmod.of(42);
        const reversed = itmod.reverse();
        expect([...reversed]).toEqual(expect.arrayContaining([42]));
    });
    test("of length 10", () => {
        const itmod = Itmod.of(1, 3, 5, 6, 7, 42, 4, 5, 6, 7);
        const reversed = itmod.reverse();
        expect([...reversed]).toEqual(
            expect.arrayContaining([7, 6, 5, 4, 42, 7, 6, 5, 3, 1])
        );
    });
});

describe("repeat", () => {
    test("empty", () => {
        const itmod = Itmod.empty<number>();
        const reversed = itmod.reverse();
        expect([...reversed]).toEqual(expect.arrayContaining([]));
    });
    test("3 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(2);
        expect([...reversed]).toEqual(
            expect.arrayContaining([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4])
        );
    });
    test("2 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(2);
        expect([...reversed]).toEqual(
            expect.arrayContaining([1, 2, 3, 4, 1, 2, 3, 4])
        );
    });
    test("1 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(1);
        expect([...reversed]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    });
    test("0 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(0);
        expect([...reversed]).toEqual(expect.arrayContaining([]));
    });
    test("-1 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(1);
        expect([...reversed]).toEqual(expect.arrayContaining([4, 3, 2, 1]));
    });
    test("-2 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(2);
        expect([...reversed]).toEqual(
            expect.arrayContaining([4, 3, 2, 1, 4, 3, 2, 1])
        );
    });
    test("-3 times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(2);
        expect([...reversed]).toEqual(
            expect.arrayContaining([4, 3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1])
        );
    });
    test("2n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(2);
        expect([...reversed]).toEqual(
            expect.arrayContaining([1, 2, 3, 4, 1, 2, 3, 4])
        );
    });
    test("1n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(1);
        expect([...reversed]).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    });
    test("0n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(0);
        expect([...reversed]).toEqual(expect.arrayContaining([]));
    });
    test("-1n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(1);
        expect([...reversed]).toEqual(expect.arrayContaining([4, 3, 2, 1]));
    });
    test("-2n times", () => {
        const itmod = Itmod.of(1, 2, 3, 4);
        const reversed = itmod.repeat(2);
        expect([...reversed]).toEqual(
            expect.arrayContaining([4, 3, 2, 1, 4, 3, 2, 1])
        );
    });
});

describe("take", () => {
    test("4 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.take(4);
        expect([...taken]).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    });
    test("4 from 4", () => {
        const itmod = Itmod.range(0, 4);
        const taken = itmod.take(4);
        expect([...taken]).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    });
    test("4 from 2", () => {
        const itmod = Itmod.range(0, 2);
        const taken = itmod.take(4);
        expect([...taken]).toEqual(expect.arrayContaining([0, 1]));
    });
    test("4 from 2", () => {
        const itmod = Itmod.empty();
        const taken = itmod.take(4);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("0 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.take(0);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("inf from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.take(Infinity);
        expect([...taken]).toEqual(
            expect.arrayContaining([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        );
    });
});

describe("skip", () => {
    test("4 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skip(4);
        expect([...taken]).toEqual(expect.arrayContaining([4, 5, 6, 7, 8, 9]));
    });
    test("4 from 4", () => {
        const itmod = Itmod.range(0, 4);
        const taken = itmod.skip(4);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("4 from 2", () => {
        const itmod = Itmod.range(0, 2);
        const taken = itmod.skip(4);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("4 from 0", () => {
        const itmod = Itmod.empty();
        const taken = itmod.skip(4);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("0 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skip(0);
        expect([...taken]).toEqual(
            expect.arrayContaining([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        );
    });
    test("inf from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skip(Infinity);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
});

describe("takeFinal", () => {
    test("4 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.takeFinal(4);
        expect([...taken]).toEqual(expect.arrayContaining([6, 7, 8, 9]));
    });
    test("4 from 4", () => {
        const itmod = Itmod.range(0, 4);
        const taken = itmod.takeFinal(4);
        expect([...taken]).toEqual(expect.arrayContaining([0, 1, 2, 3]));
    });
    test("4 from 2", () => {
        const itmod = Itmod.range(0, 2);
        const taken = itmod.takeFinal(4);
        expect([...taken]).toEqual(expect.arrayContaining([0, 1]));
    });
    test("4 from 0", () => {
        const itmod = Itmod.empty();
        const taken = itmod.takeFinal(4);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("0 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.takeFinal(0);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("inf from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.takeFinal(Infinity);
        expect([...taken]).toEqual(
            expect.arrayContaining([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        );
    });
});

describe("skipFinal", () => {
    test("4 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skipFinal(4);
        expect([...taken]).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5]));
    });
    test("4 from 4", () => {
        const itmod = Itmod.range(0, 4);
        const taken = itmod.skipFinal(4);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("4 from 2", () => {
        const itmod = Itmod.range(0, 2);
        const taken = itmod.skipFinal(4);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("4 from 0", () => {
        const itmod = Itmod.empty();
        const taken = itmod.skipFinal(4);
        expect([...taken]).toEqual(expect.arrayContaining([]));
    });
    test("0 from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skipFinal(0);
        expect([...taken]).toEqual(
            expect.arrayContaining([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        );
    });
    test("inf from 10", () => {
        const itmod = Itmod.range(0, 10);
        const taken = itmod.skipFinal(Infinity);
        expect([...taken]).toEqual(expect.arrayContaining([]));
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
            throw new Error(); // shouldn't be iterated
        });
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
        expect([...min]).toEqual(expect.arrayContaining([0, 1]));
    });
    test("4 of 0", () => {
        const itmod = Itmod.empty<number>();
        const min = itmod.min(4);
        expect([...min]).toEqual(expect.arrayContaining([]));
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
        expect([...min]).toEqual(expect.arrayContaining([]));
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
        expect([...min]).toEqual(expect.arrayContaining([0, 1]));
    });
    test("4n of 0", () => {
        const itmod = Itmod.empty<number>();
        const min = itmod.min(4n);
        expect([...min]).toEqual(expect.arrayContaining([]));
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
        expect([...min]).toEqual(expect.arrayContaining([]));
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
        expect([...max]).toEqual(expect.arrayContaining([0, 1]));
    });
    test("4 of 0", () => {
        const itmod = Itmod.empty<number>();
        const max = itmod.max(4);
        expect([...max]).toEqual(expect.arrayContaining([]));
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
        expect([...max]).toEqual(expect.arrayContaining([]));
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
        expect([...max]).toEqual(expect.arrayContaining([0, 1]));
    });
    test("4n of 0", () => {
        const itmod = Itmod.empty<number>();
        const max = itmod.max(4n);
        expect([...max]).toEqual(expect.arrayContaining([]));
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
        expect([...max]).toEqual(expect.arrayContaining([]));
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
        const grouped = itmod.groupBy((foo) => foo.state);
        test("correct order of keys", () => {
            expect([...grouped.map((g) => g[0])]).toEqual(
                expect.arrayContaining(["mt", "wa", "fl"])
            );
        });
        test("correct order in groups", () => {
            const map = grouped.toMap();
            expect(map.get("mt")!.map((c) => c.name)).toEqual(
                expect.arrayContaining(["phillip", "susan", "john", "arnold"])
            );
            expect(map.get("wa")!.map((c) => c.name)).toEqual(
                expect.arrayContaining(["james", "steve", "charlie", "florida"])
            );
            expect(map.get("fl")!.map((c) => c.name)).toEqual(
                expect.arrayContaining(["samantha"])
            );
        });
    });
    describe("with group selector", () => {
        const grouped = itmod.groupBy(
            (foo) => foo.state,
            (group) => group.map((c) => c.name).join()
        );
        test("correct order of keys", () => {
            expect([...grouped.map((g) => g[0])]).toEqual(
                expect.arrayContaining(["mt", "wa", "fl"])
            );
        });
        test("correct order in groups", () => {
            const map = grouped.toMap();
            expect(map.get("mt")).toBe("phillip,susan,john,arnold");
            expect(map.get("wa")).toBe("james,steve,charlie,florida");
            expect(map.get("fl")).toBe("samantha");
        });
    });
});

describe("toArray", () => {
    test("infinite items throws error", () => {
        expect(() => {
            Itmod.range(Infinity).toArray();
        }).toThrowError(NeverEndingOperationError);
    });
    test("finite items doesn't throw an error", () => {
        expect(() => {
            const itmod = Itmod.of(1, 3, 4, 5, 42, 5, 76, 7);
            expect(itmod.toArray()).toEqual(
                expect.arrayContaining([1, 3, 4, 5, 42, 5, 76, 7])
            );
        });
    });
});

describe("toSet", () => {
    test("infinite items throws error", () => {
        expect(() => {
            Itmod.range(Infinity).toSet();
        }).toThrowError(NeverEndingOperationError);
    });
    test("finite items doesn't throw an error", () => {
        expect(() => {
            const itmod = Itmod.of(1, 3, 4, 5, 42, 5, 76, 7);
            expect(itmod.toSet().size).toBe(8);
        });
    });
});

describe("asArray", () => {
    test("infinite items throws error", () => {
        expect(() => {
            Itmod.range(Infinity).asArray();
        }).toThrowError(NeverEndingOperationError);
    });
    test("finite items doesn't throw an error", () => {
        expect(() => {
            const itmod = Itmod.of(1, 3, 4, 5, 42, 5, 76, 7);
            expect(itmod.toArray()).toEqual(
                expect.arrayContaining([1, 3, 4, 5, 42, 5, 76, 7])
            );
        });
    });
});

describe("asSet", () => {
    test("infinite items throws error", () => {
        expect(() => {
            Itmod.range(Infinity).asSet();
        }).toThrowError(NeverEndingOperationError);
    });
    test("finite items doesn't throw an error", () => {
        expect(() => {
            const itmod = Itmod.of(1, 3, 4, 5, 42, 5, 76, 7);
            expect(itmod.asSet().size).toBe(8);
        });
    });
});

//TODO test for every method in itmod and its children
