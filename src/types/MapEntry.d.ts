type MapEntry<Key, Value> = { 0: Key; 1: Value } & Iterable<Key | Value>;

export default MapEntry;
