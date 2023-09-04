/** The reverse of {@link Readonly}. Removes the readonly flag from every field in the given object. */
export type Writable<T> = {
    -readonly [P in keyof T]: T[P];
};
/**
 * From T, pick a set of properties whose keys are not in the union K.
 */
export type Unpick<T, K extends keyof T> = Pick<T, Difference<keyof T, K>>;
