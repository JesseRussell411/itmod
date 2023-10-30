import Itmod from "../Itmod";
import Collection from "./Collection";

/**
 * @returns The given collection copied into an {@link Array}.
 */
export function toArray<T>(collection: Iterable<T> | undefined): T[] {
    if (collection instanceof Collection || collection instanceof Itmod) {
        return collection.toArray();
    } else if (collection === undefined) {
        return [];
    } else {
        return [...collection];
    }
}

/**
 * @returns The given collection copied into a {@link Set}.
 */
export function toSet<T>(collection: Iterable<T> | undefined): Set<T> {
    if (collection instanceof Itmod) {
        return collection.toSet();
    } else {
        return new Set(collection);
    }
}
