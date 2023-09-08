import Itmod from "../src/Itmod";

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

//TODO test for every method in itmod and its children
