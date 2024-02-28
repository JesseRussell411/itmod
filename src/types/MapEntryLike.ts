type MapEntryLike<Key, Value> = {
    // TODO why are these optional?
    /** key */
    readonly 0?: Key;
    /** value */
    readonly 1?: Value;
};

export default MapEntryLike;
