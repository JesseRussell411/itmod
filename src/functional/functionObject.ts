/**
 * @returns The given function with the enumerable own properties of the given object copied onto it.
 */
function functionObject<F extends Function, O extends {}>(
    fun: F,
    obj: O
): F & O {
    const result = (...args: any) => fun(...args);
    Object.assign(result, obj);
    return result as any;
}
