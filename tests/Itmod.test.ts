import Itmod from "../src/Itmod";
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

//TODO test for every method in itmod and its children
