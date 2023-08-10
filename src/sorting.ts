/**
 * A function which returns a number representing the comparison of its two arguments.
 * @returns  - positive: first > second
 *  - negative: first < second
 *  - 0: first = second
 *  - {@link NaN}: first = second
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
    return order instanceof Function && order.length < 2;
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
        if (order.length > 1) {
            return order as Comparator<T>;
        } else {
            return (a: T, b: T) =>
                autoComparator(
                    (order as FieldSelector<T>)(a),
                    (order as FieldSelector<T>)(b)
                );
        }
    } else {
        return (a: T, b: T) => autoComparator(a[order], b[order]);
    }
}

/**
 * Automatically compares values in sensible ways.
 *
 * Comparisons:
 *  - boolean/Boolean: false comes before true
 *  - number/{@link Number}, bigint/{@link BigInt}: Lower values come before higher values; additionally, number/{@link Number} and bigint/{@link BigInt} are mixed so that 2 comes before 4n and 4n comes before 5.5, etc.
 *  - string/{@link String}: The result of {@link String.localeCompare}.
 *  - {@link Date}: Earlier {@link Date}s come before later {@link Date}s.
 *  - everything else: Not compared. 0 is returned.
 */
export const autoComparator: Comparator<unknown> = (
    a: unknown,
    b: unknown
): number => {
    // TYPE IDs:

    // undefined* -- 0
    // null       -- 1
    // boolean,Boolean    -- 2

    // number,Number    -- 3
    // bigint,Bigint     -- 3

    // string,String     -- 4
    // symbol,Symbol     -- 5
    // Date       -- 6
    // Array      -- 7
    // object     -- 8
    // function   -- 9

    // type
    const typeIdA = idType(a);
    const typeIdB = idType(b);

    // sort by type first
    if (typeIdA !== typeIdB) return 0;

    const typeRating = typeIdA;

    // value
    switch (typeRating) {
        // undefined
        case 0:
            return 0;

        // null
        case 1:
            return 0;

        // boolean
        case 2: {
            const A = (a as boolean | Boolean).valueOf();
            const B = (b as boolean | Boolean).valueOf();
            if (A === B) {
                return 0;
            } else if (A === true) {
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

    function idType(item: any) {
        // TODO? move outside of parent function if better performance

        switch (typeof item) {
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

            // date -- 6

            // array -- 7

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

/**
 * Reverses the given order so that, in comparator form, a positive number is returned when a negative number would have been and vice versa.
 */
export function reverseOrder<T>(order: Order<T>): Order<T> {
    const comparator = asComparator(order);
    return (a: T, b: T) => comparator(b, a);
}
