/**
 * The general form of the given literal type.
 * @example General<4> === number
 * General<"foobar"> === string
 * General<3n> === bigint
 */
export type General<T> = T extends string
    ? string
    : T extends number
    ? number
    : T extends bigint
    ? bigint
    : T extends true
    ? true | false
    : T extends false
    ? true | false
    : T;
