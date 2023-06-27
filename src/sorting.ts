/**
 * A comparator which returns a number representing the comparison of its two arguemtents.
 * @returns  - positive: first > second
 *  - negative: first < second
 *  - 0: first = second
 */
export type Comparator<T> = (a: T, b: T) => number;
/**
 * A mapping function that returns the value to compare the argument by.
 */
export type FieldSelector<T> = (t: T) => unknown;
/**
 * A field by which to compare values of type T by.
 */
export type Field<T> = keyof T;
/**
 * Represents an ordering of values of type T.
 */
export type Order<T> = Comparator<T> | FieldSelector<T> | Field<T>;

/**
 * @returns Whether the given {@link Order} is represented by a {@link Comparator}.
 */
export function isComparator<T>(order: Order<T>): order is Comparator<T> {
    return order instanceof Function && order.length > 1;
}

/**
 * @returns Whether the given {@link Order} is represented by a {@link FieldSelector}.
 */
export function isFieldSelector<T>(order: Order<T>): order is FieldSelector<T> {
    return order instanceof Function && order.length === 1;
}

/**
 * @returns Whether the given {@link Order} is represented by a {@link Field}.
 */
export function isField<T>(order: Order<T>): order is Field<T> {
    return !(order instanceof Function);
}

/**
 * @returns The given {@link Order} represented by a {@link Comparator}.
 */
export function asComparator<T>(order: Order<T>): Comparator<T> {
    if (order instanceof Function) {
        if (order.length === 1) {
            return (a: T, b: T) =>
                autoComparator(
                    (order as FieldSelector<T>)(a),
                    (order as FieldSelector<T>)(b)
                );
        } else {
            return order as Comparator<T>;
        }
    } else {
        return (a: T, b: T) => autoComparator(a[order], b[order]);
    }
}

/**
 * Automatically compares values in sensical ways.
 *
 * Compares by type first. The types in ascending order are:
 *  - undefined*
 *  - null
 *  - boolean, Boolean
 *  - number, bigint, Number, BigInt
 *  - string, String
 *  - symbol
 *  - {@link Date}
 *  - {@link Array}
 *  - object
 *  - function
 *
 * Compares by value second:
 *  - boolean, Boolean: false comes before true
 *  - number, bigint, Number, BigInt: lower values come before higher values
 *  - string, String: the result of {@link String.localeCompare}
 *  - {@link Date}: earlier {@link Date}s come before later {@link Date}s
 *  - the rest: not compared, 0 is returned
 *
 *  \*{@link Array.sort} always moves undefined values to the end of the {@link Array} regardless of the {@link Comparator};
 */
export const autoComparator: Comparator<unknown> = (
    a: unknown,
    b: unknown
): number => {
    // TODO! add wrapper class support (Number, Boolean, etc.)

    // TYPE RATINGS:

    // undefined* -- 0
    // null       -- 1
    // boolean,Boolean    -- 2

    // number,Number    -- 3
    // bigint,Bigine     -- 3

    // string,String     -- 4
    // symbol,Symbol     -- 5
    // date       -- 6
    // array      -- 7
    // object     -- 8
    // function   -- 9

    // * -- Array.sort ignores undefined items and just puts them
    // all at the end regardless of the comparator, making this rating
    // effectively "for completeness" but otherwise pointless.

    // type
    const typeRatingA = rateType(a);
    const typeRatingB = rateType(b);

    // sort by type first
    if (typeRatingA !== typeRatingB) return typeRatingA - typeRatingB;

    // value
    switch (typeRatingA) {
        // undefined
        case 0:
            // pointless for reason stated above
            return 0;

        // null
        case 1:
            return 0;

        // boolean
        case 2: {
            const A = (a as boolean | Boolean).valueOf();
            const B = (b as boolean | Boolean).valueOf();
            if (A.valueOf() === B.valueOf()) {
                return 0;
            } else if (A.valueOf() === true) {
                return 1;
            } else {
                return -1;
            }
        }

        // number or bigint
        case 3: {
            const A = (a as number | Number | bigint | BigInt).valueOf();
            const B = (b as number | Number | bigint | BigInt).valueOf();
            if (typeof A === "bigint" && typeof B === "bigint") {
                return Number(A - B);
            } else {
                return Number(A) - Number(B);
            }
        }

        // string
        case 4:
            const A = (a as string | String).valueOf();
            const B = (b as string | String).valueOf();
            return A.localeCompare(B);

        // symbol
        case 5:
            // don't sort symbols
            return 0;

        // date
        case 6:
            return (a as Date).getTime() - (b as Date).getTime();

        // array
        case 7:
            // don't sort arrays
            return 0;

        // object
        case 8:
            // don't sort objects
            return 0;

        // function
        case 9:
            // don't sort functions
            return 0;
    }

    function rateType(item: any) {
        // TODO? move outside of parent function if better performance
        // TODO? replace switch with Map or object if better performance

        switch (typeof item) {
            // this case will actually be ignored by javascript
            // Array.sort doesn't actually sort undefined values.
            // It just puts all the undefineds at the end of the array even if the comparator says otherwise.
            case "undefined":
                return 0;

            // null -- 1

            case "boolean":
                return 2;

            case "number":
            case "bigint":
                return 3;

            case "string":
                return 4;

            case "symbol":
                return 5;

            // date -- 7

            // array -- 6

            case "object":
                if (item === null) return 1;

                // TODO find more efficient way of doing this. Some way of getting base most prototype maybe?
                if (item instanceof Date) return 6;
                if (Array.isArray(item)) return 7;
                if (item instanceof Boolean) return 2;
                if (item instanceof Number) return 3;
                if (item instanceof BigInt) return 3;
                if (item instanceof String) return 4;
                return 8;

            case "function":
                return 9;
        }
    }
};
