/** @returns The value given or its result if it's a function. */
export function resultOf<T>(itemOrGetter: T | (() => T)): T {
    if (itemOrGetter instanceof Function) {
        return itemOrGetter();
    } else {
        return itemOrGetter;
    }
}

/** Does nothing. */
export function doNothing(): void {
    // doing nothing...
}

/** @returns The given item. */
export function identity<T>(item: T): T {
    return item;
}

/** @returns A function that returns the given item. */
export function returns<T>(item: T): () => T {
    return () => item;
}

/** @throws The given {@link Error}. */
export function throwError<E>(error: E): void {
    throw error;
}

/** @throws The {@link Error} of type E. */
type ThrowError<E> = () => void;

/** @returns A function that throws the given {@link Error}. */
export function throws<E>(error: E): ThrowError<E> {
    return () => {
        throw error;
    };
}
