/**
 * Version of {@link Map} with no size constraint.
 */
export class BigMap<K, V> extends Map<K, V> {
    private static maxSize: number = 0;
    private readonly extraMaps: Map<K, V>[] = [];
    private itemsDeleted: boolean = false;

    public get size(): number {
        let result = super.size;
        for (const map of this.extraMaps) {
            result += map.size;
        }
        return result;
    }

    public *[Symbol.iterator]() {
        yield *super[Symbol.iterator]();
        for (const map of this.extraMaps){
            yield *map;
        }
        return undefined;
    }

    public get(key: K): V | undefined {
        if (super.has(key)) {
            return super.get(key);
        }

        for (const map of this.extraMaps) {
            if (map.has(key)) {
                return map.get(key);
            }
        }

        return undefined;
    }

    public has(key: K): boolean {
        if (super.has(key)) {
            return true;
        }
        for (const map of this.extraMaps) {
            if (map.has(key)) {
                return true;
            }
        }
        return false;
    }

    private tryset(map: Map<K, V>, key: K, value: V): boolean {
        if (BigMap.maxSize !== 0) {
            if (map === this) {
                if (super.size < BigMap.maxSize) {
                    super.set(key, value);
                    return true;
                }
            } else {
                if (map.size < BigMap.maxSize) {
                    map.set(key, value);
                    return true;
                }
            }
        } else {
            if (map === this) {
                try {
                    super.set(key, value);
                    return true;
                } catch (e) {
                    if (e instanceof RangeError) {
                        BigMap.maxSize = super.size;
                    } else throw e;
                }
            } else {
                try {
                    map.set(key, value);
                    return true;
                } catch (e) {
                    if (e instanceof RangeError) {
                        BigMap.maxSize = map.size;
                    } else throw e;
                }
            }
        }
        return false;
    }

    public set(key: K, value: V): this {
        if (this.extraMaps.length === 0) {
            // try self, no extra maps
            if (this.tryset(this, key, value)) {
                return this;
            }
        } else {
            // overwrite existing entry if found in self
            if (super.has(key)) {
                super.set(key, value); // overwrite
                return this;
            }

            const finalIndex = this.extraMaps.length - 1;

            // overwrite existing entry if found in any extra map, except the final one
            for (let i = 0; i < finalIndex; i++) {
                const map = this.extraMaps[i]!;
                if (map.has(key)) {
                    map.set(key, value); // overwrite
                    return this;
                }
            }

            const finalMap = this.extraMaps[finalIndex]!;

            // try all but final map if items deleted
            if (this.itemsDeleted) {
                // overwrite existing entry in final map if found
                if (finalMap.has(key)) {
                    finalMap.set(key, value);
                    return this;
                }

                if (this.tryset(this, key, value)) {
                    return this;
                }
                for (let i = 0; i < finalIndex; i++) {
                    const map = this.extraMaps[i]!;
                    if (this.tryset(map, key, value)) {
                        return this;
                    }
                }

                this.itemsDeleted = false;
            }

            // try final map
            if (this.tryset(finalMap, key, value)) {
                return this;
            }
        }

        // out of space. create another map
        const map = new Map<K, V>();
        map.set(key, value);
        this.extraMaps.push(map);

        return this;
    }

    public delete(key: K): boolean {
        let result = false;
        if (super.delete(key)) {
            this.itemsDeleted = true;
            result = true;
        } else {
            for (let i = 0; i < this.extraMaps.length; i++) {
                const map = this.extraMaps[i]!;
                if (map.delete(key)) {
                    // remove map if empty
                    if (map.size === 0) {
                        this.extraMaps.splice(i, 1);
                    } else {
                        this.itemsDeleted = true;
                    }
                    result = true;
                }
            }
        }

        return result;
    }

    public clear(): void {
        super.clear();
        this.extraMaps.length = 0;
        this.itemsDeleted = false;
    }

    public *entries() {
        yield* super.entries();
        for (const map of this.extraMaps) {
            yield* map.entries();
        }
        return undefined;
    }
    public *keys() {
        yield* super.keys();
        for (const map of this.extraMaps) {
            yield* map.keys();
        }
        return undefined;
    }
    public *values() {
        yield* super.values();
        for (const map of this.extraMaps) {
            yield* map.values();
        }
        return undefined;
    }

    public forEach(
        callbackfn: (value: V, key: K, map: Map<K, V>) => void,
        thisArg?: any
    ) {
        if (arguments.length > 1) {
            super.forEach(callbackfn, thisArg);
            for (const map of this.extraMaps) {
                map.forEach(callbackfn, thisArg);
            }
        } else {
            super.forEach(callbackfn);
            for (const map of this.extraMaps) {
                map.forEach(callbackfn);
            }
        }
    }
}

/**
 * Version of {@link Set} with no size constraint.
 */
export class BigSet<T> extends Set<T> {
    private static maxSize: number = 0;
    private readonly extraSets: Set<T>[] = [];
    private itemsDeleted: boolean = false;

    public get size() {
        let result = super.size;
        for (const set of this.extraSets) {
            result += set.size;
        }
        return result;
    }

    public *[Symbol.iterator]() {
        yield *super[Symbol.iterator]();
        for (const set of this.extraSets) {
            yield *set;
        }
        return undefined;
    }

    public has(value: T): boolean {
        if (super.has(value)) {
            return true;
        }
        for (const set of this.extraSets) {
            if (set.has(value)) return true;
        }
        return false;
    }

    private tryadd(set: Set<T>, value: T) {
        if (BigSet.maxSize !== 0) {
            if (set === this) {
                if (super.size < BigSet.maxSize) {
                    super.add(value);
                    return true;
                }
            } else {
                if (set.size < BigSet.maxSize) {
                    set.add(value);
                    return true;
                }
            }
        } else {
            if (set === this) {
                try {
                    super.add(value);
                    return true;
                } catch (e) {
                    if (e instanceof RangeError) {
                        BigSet.maxSize = super.size;
                    } else throw e;
                }
            } else {
                try {
                    set.add(value);
                    return true;
                } catch (e) {
                    if (e instanceof RangeError) {
                        BigSet.maxSize = set.size;
                    } else throw e;
                }
            }
        }
        return false;
    }

    public add(value: T): this {
        if (this.extraSets.length === 0) {
            // try self, no extra maps
            if (this.tryadd(this, value)) {
                return this;
            }
        } else {
            // overwrite existing entry if found in self
            if (super.has(value)) {
                super.add(value);
                return this;
            }

            const finalIndex = this.extraSets.length - 1;

            // overwrite existing entry if found in any extra set, except the final one
            for (let i = 0; i < finalIndex; i++) {
                const set = this.extraSets[i]!;
                if (set.has(value)) {
                    set.add(value);
                    return this;
                }
            }

            const finalSet = this.extraSets[finalIndex]!;

            // try all but final set if items deleted
            if (this.itemsDeleted) {
                // overwrite existing value in final set if found
                if (finalSet.has(value)) {
                    finalSet.add(value);
                    return this;
                }

                if (this.tryadd(this, value)) {
                    return this;
                }
                for (let i = 0; i < finalIndex; i++) {
                    const map = this.extraSets[i]!;
                    if (this.tryadd(map, value)) {
                        return this;
                    }
                }

                this.itemsDeleted = false;
            }

            // try final set
            if (this.tryadd(finalSet, value)) {
                return this;
            }
        }

        // out of space. create another set
        const set = new Set<T>();
        set.add(value);
        this.extraSets.push(set);
        return this;
    }

    public delete(value: T): boolean {
        if (super.delete(value)) {
            return true;
        }

        for (let i = 0; i < this.extraSets.length; i++) {
            const set = this.extraSets[i]!;
            if (set.delete(value)) {
                // remove set if empty
                if (set.size === 0) {
                    this.extraSets.splice(i, 1);
                } else {
                    this.itemsDeleted = true;
                }
                return true;
            }
        }
        return false;
    }

    public clear() {
        super.clear();
        this.extraSets.length = 0;
        this.itemsDeleted = false;
    }

    public *values() {
        yield* super.values();
        for (const set of this.extraSets) {
            yield* set.values();
        }
        return undefined;
    }
    public *keys() {
        yield* super.keys();
        for (const set of this.extraSets) {
            yield* set.keys();
        }
        return undefined;
    }
    public *entries() {
        yield* super.entries();
        for (const set of this.extraSets) {
            yield* set.entries();
        }
        return undefined;
    }

    public forEach(
        callbackfn: (value: T, value2: T, set: Set<T>) => void,
        thisArg?: any
    ) {
        if (arguments.length > 1) {
            super.forEach(callbackfn, thisArg);
            for (const map of this.extraSets) {
                map.forEach(callbackfn, thisArg);
            }
        } else {
            super.forEach(callbackfn);
            for (const map of this.extraSets) {
                map.forEach(callbackfn);
            }
        }
    }
}
