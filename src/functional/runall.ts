/** Runs all of the given functions, even if some throw errors. */
export default function runall<T>(): undefined;

/** Runs all of the given functions, even if some throw errors. */
export default function runall<T>(
    firstAction: (() => T) | undefined,
    ...followingActions: (
        | ((
              /** The result of the previous action that didn't throw an error */
              result: T | undefined,
              /** The error thrown by the previous action if it did throw an error. */
              error: any,
              /** Whether the previous action threw an error. */
              errorWasThrown: boolean,
              /** All errors thrown so far. */
              errors: readonly any[]
          ) => T)
        | undefined
    )[]
): T | undefined;

export default function runall<T>(
    firstAction?: (() => T) | undefined,
    ...followingActions: (
        | ((
              result: T | undefined,
              error: any,
              errorWasThrown: boolean,
              errors: readonly any[]
          ) => T)
        | undefined
    )[]
): T | undefined {
    const errors = [] as any[];

    let result = undefined as T | undefined;
    let errorWasThrown = false;
    let error: any = undefined;

    // run the first actions and get it's result or error
    try {
        result = firstAction?.();
    } catch (e) {
        result = undefined;
        errors.push(e);
        error = e;
        errorWasThrown = true;
    }

    // run all the other actions, carrying each result over to the next
    for (const action of followingActions) {
        if (action === undefined) continue;
        try {
            result = action(result, error, errorWasThrown, errors);
            error = undefined;
            errorWasThrown = false;
        } catch (e) {
            result = undefined;
            errors.push(e);
            error = e;
            errorWasThrown = true;
        }
    }

    // throw any errors
    if (errors.length === 1) {
        throw errors[0];
    } else if (errors.length !== 0) {
        throw new AggregateError(errors);
    }

    return result;
}
