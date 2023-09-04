import Result from "./Result";
import runall from "./runall";

/** Tries all of the given functions, even if some throw errors. */
export function tryall<T>(): Result<undefined>;

/**
 * Tries all of the given functions, even if some throw errors.
 *
 * @returns The result
 */
export function tryall<T>(
    firstAction: () => T,
    ...followingActions: ((
        /** The result of the previous action that didn't throw an error */
        result: T | undefined,
        /** The error thrown by the previous action if it did throw an error. */
        error: any,
        /** Whether the previous action threw an error. */
        errorWasThrown: boolean,
        /** All errors thrown so far. */
        errors: readonly any[]
    ) => T)[]
): Result<T>;

export function tryall<T>(
    firstAction?: () => T,
    ...followingActions: ((
        result: T | undefined,
        error: any,
        errorWasThrown: boolean,
        errors: readonly any[]
    ) => T)[]
): Result<T> {
    try {
        return Result.of(runall<T>(firstAction, ...followingActions) as T);
    } catch (e) {
        return Result.error(e);
    }
}
