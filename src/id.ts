/** Stores the IDs for all objects given to the function. Is a {@link WeakMap} so that is doesn't stop the object from being garbage collected. */
const IDs = new WeakMap<{}, symbol>();

/**
 * @param value
 * @returns A unique identifier for the given value. If the value is an object, a unique symbol is returned for that object, otherwise, the value itself is returned.
 */
export default function id<V>(value: V): V extends object ? Symbol : V {
    if (typeof value !== "object") return value as any;
    if (value === null) return value as any;

    const registeredID = IDs.get(value);
    if (registeredID !== undefined) {
        return registeredID as any;
    } else {
        const id = Symbol();
        IDs.set(value, id);
        return id as any;
    }
}
