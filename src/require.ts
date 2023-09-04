/**
 * Ensures that the number is not {@link NaN}.
 * **note** Every other number-related function in this file implicitly includes this one.
 * @throws If the number is {@link NaN}.
 */
export function requireNonNaN<N extends number | bigint>(number: N): N {
    if (typeof number === "bigint") return number;
    if (isNaN(number)) throw new Error("expected a number but got NaN");
    return number;
}

/**
 * Ensures that the number is finite.
 * @throws If the number is positive or negative infinity or NaN.
 */
export function requireFinite<N extends number | bigint>(number: N): N {
    requireNonNaN(number);
    if (typeof number === "bigint") return number;
    if (Number.isFinite(number)) return number;
    throw new Error("expected a finite number but got " + number);
}

/**
 * Ensures that the number is a whole number.
 * @throws If the number has a value to the right of the decimal point. If the number is not an integer. If the number is not finite. If the number is {@link NaN}.
 */
export function requireInteger<N extends number | bigint>(number: N): N {
    requireNonNaN(number);
    if (typeof number === "bigint") return number;
    if (number % 1 === 0) return number;
    throw new Error("expected an integer but got: " + number);
}
/**
 * Ensures that the number is a whole number or that it is infinity or negative infinity.
 * @throws If the number has a value to the right of the decimal point. If the number is not an integer. If the number is {@link NaN}.
 */
export function requireIntegerOrInfinity<N extends number | bigint>(
    number: N
): N {
    requireNonNaN(number);
    if (typeof number === "bigint") return number;
    if (number === Infinity || number === -Infinity) return number;
    if (number % 1 === 0) return number;
    throw new Error("expected an integer or infinity but got: " + number);
}

/**
 * Ensures that the number is zero or greater.
 *
 * This function is not called "requirePositive" because 0 might not be considered positive by some, which would cause confusion.
 *
 * 0, mathematically speaking, is neither positive nor negative.
 *
 * @throws If the number is negative. If the number is {@link NaN}.
 */
export function requireNonNegative<N extends number | bigint>(number: N): N {
    requireNonNaN(number);
    if (number < 0) {
        throw new Error("expected a non-negative number but got " + number);
    }

    return number;
}

/**
 * Ensures that the number is less than zero.
 *
 * @throws If the number is non-negative. If the number is {@link NaN}.
 */
export function requireNegative<N extends number | bigint>(number: N): N {
    requireNonNaN(number);
    if (number >= 0) {
        throw new Error("expected a negative number but got " + number);
    }

    return number;
}

/**
 * Ensures that the number is greater than zero (positive, mathematically speaking).
 *
 * This function is not called "requirePositive" because 0 might be considered positive by some, which would cause confusion.
 * @throws If the number is zero or less. If the number is {@link NaN}.
 */
export function requireGreaterThanZero<N extends number | bigint>(
    number: N
): N {
    requireNonNaN(number);
    if (number > 0) return number;
    throw new Error("expected a number greater than zero but got " + number);
}

/**
 * Ensures that the number is not zero.
 * @throws If the number is zero. If the number is {@link NaN}.
 */
export function requireNonZero<N extends number | bigint>(number: N): N {
    requireNonNaN(number);
    if (number !== 0 && number !== 0n) {
        return number;
    }
    throw new Error("expected non zero but got " + number);
}

/**
 * Ensures that the number is greater than or equal to {@link Number.MIN_SAFE_INTEGER}
 * and less than or equal to {@link Number.MAX_SAFE_INTEGER}.
 * @throws If the number is too big or too small to be safe. If the number is {@link NaN}.
 */
export function requireSafeNumber<N extends number | bigint>(number: N): N {
    requireNonNaN(number);

    if (number < Number.MIN_SAFE_INTEGER) {
        throw new Error(
            `${number} is less than the smallest safe integer: ${Number.MIN_SAFE_INTEGER}`
        );
    }
    if (number > Number.MAX_SAFE_INTEGER) {
        throw new Error(
            `${number} is greater than the largest safe integer: ${Number.MAX_SAFE_INTEGER}`
        );
    }

    return number;
}

/**
 * Ensures that the number is greater than or equal to {@link Number.MIN_SAFE_INTEGER}
 * and less than or equal to {@link Number.MAX_SAFE_INTEGER}.
 *
 * Also allows {@link Infinity} and -{@link Infinity}.
 *
 * @throws If the number is not in the range of safe integers, unless it is positive or negative {@link Infinity}. Also throws if number is NaN.
 */
export function requireSafeNumberOrInfinity<N extends number | bigint>(
    number: N
): N {
    requireNonNaN(number);
    if (number === Infinity || number === -Infinity) return number;
    return requireSafeNumber(number);
}

/**
 * Ensures that the number is an integer greater than or equal to {@link Number.MIN_SAFE_INTEGER},
 * and less than or equal to {@link Number.MAX_SAFE_INTEGER}.
 * @throws If the number is too big or too small to be safe or if it is not an integer. Will also throw for {@link NaN}.
 */
export function requireSafeInteger<N extends number | bigint>(number: N): N {
    requireNonNaN(number);
    return requireInteger(requireSafeNumber(number));
}

/**
 * Ensures that the number is an integer greater than or equal to {@link Number.MIN_SAFE_INTEGER}
 * and less than or equal to {@link Number.MAX_SAFE_INTEGER}.
 *
 * Also allows {@link Infinity} and -{@link Infinity}.
 *
 * @throws If the number is not in the range of safe integers, unless it is positive or negative {@link Infinity}. Also throws if number is NaN.
 */
export function requireSafeIntegerOrInfinity<N extends number | bigint>(
    number: N
): N {
    requireNonNaN(number);
    if (number === Infinity || number === -Infinity) return number;
    return requireSafeInteger(number);
}

type RequireNumber = {
    <N extends number | bigint>(n: N): N;
    finite: RequireNumber;
    nonNaN: RequireNumber;
    integer: RequireNumber;
    nonNegative: RequireNumber;
    greaterThanZero: RequireNumber;
    nonZero: RequireNumber;
    safeNumber: RequireNumber;
    safeInteger: RequireNumber;
};

export const requireNumberToBe: RequireNumber = ((n: any) => n) as any;
addStuff(requireNumberToBe);
function addStuff(object: any) {
    Object.defineProperties(object, {
        finite: {
            get() {
                const result = function finite(n: number | bigint) {
                    // @ts-ignore
                    return requireFinite(object(n));
                };
                addStuff(result);
                return result;
            },
        },
        nonNaN: {
            get() {
                const result = function nonNaN(n: number | bigint) {
                    // @ts-ignore
                    return requireNonNaN(object(n));
                };
                addStuff(result);
                return result;
            },
        },
        integer: {
            get() {
                const result = function integer(n: number | bigint) {
                    // @ts-ignore
                    return requireInteger(object(n));
                };
                addStuff(result);
                return result;
            },
        },
        nonNegative: {
            get() {
                const result = function nonNegative(n: number | bigint) {
                    // @ts-ignore
                    return requireNonNegative(object(n));
                };
                addStuff(result);
                return result;
            },
        },
        negative: {
            get() {
                const result = function negative(n: number | bigint) {
                    // @ts-ignore
                    return requireNegative(object(n));
                };
                addStuff(result);
                return result;
            },
        },
        greaterThanZero: {
            get() {
                const result = function greaterThanZero(n: number | bigint) {
                    // @ts-ignore
                    return requireGreaterThanZero(object(n));
                };
                addStuff(result);
                return result;
            },
        },
        nonZero: {
            get() {
                const result = function nonZero(n: number | bigint) {
                    // @ts-ignore
                    return requireNonZero(object(n));
                };
                addStuff(result);
                return result;
            },
        },
        safeNumber: {
            get() {
                const result = function safeNumber(n: number | bigint) {
                    // @ts-ignore
                    return requireSafeNumber(object(n));
                };
                addStuff(result);
                return result;
            },
        },
        safeInteger: {
            get() {
                const result = function safeInteger(n: number | bigint) {
                    // @ts-ignore
                    return requireSafeInteger(object(n));
                };
                addStuff(result);
                return result;
            },
        },
    });
}
