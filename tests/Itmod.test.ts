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
