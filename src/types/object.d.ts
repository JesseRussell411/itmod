/** The reverse of {@link Readonly}. Removes the readonly flag from every field in the given object. */
export type Writable<T> = {
    -readonly [P in keyof T]: T[P];
};
