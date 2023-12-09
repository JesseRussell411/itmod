# itmod
Stands for Iterator Modifier. Linq for typescript.

Allows the use of array operations like map, filter, or reduce on any Iterable (anything with a [Symbol.Iterator] method) with lazy execution.

To install:

`npm install iterator-modifier`

To use:

```
import Itmod from "iterator-modifier";

/** The mean of 2 and 4 */
const mean = Itmod.from([1, 2, 3])
    .map((n) => n + 1)
    .filter((n) => n % 2 === 0)
    .reduce(
        (t, n) => t + n,
        (total, numCount) => total / numCount
    );
console.log("mean:", mean);
```

## Some nice features.

### Lazy execution, above all else.

### Sorting with default behavior that makes sense.

`Itmod.of(1,10, 2, 20, 7, 90, 3).sort().toArray()` => `[1, 2, 3, 7, 10, 20, 90]`

`[1,10, 2, 20, 7, 90, 3].sort()` => `[1, 10, 2, 20, 3, 7, 90]`

### Converting to and from objects.

`Itmod.fromObject({one: 1, two: 2, three: 3}).append(["four", 4]).toObject()` => `{one: 1, two: 2, three: 3, four: 4}`

### Takes any Iterable (or function that returns an Iterable).
### Writen in modern-style typescript.
### Infinite sequences.
### high level optimizations.
### declarative programming.

# Itmod's methods

### forEach

### map

### flat

### filter

### defined

### notNull

### notNullish

### zip

### reduce

### fold

### concat

### preConcat

### append

### prepend

### reverse

### repeat

### first

### final

### distinct

### union

### intersection

### difference

### take

### takeFinal

### takeEveryNth

### takeWhile

### skip

### skipFinal

### skipEveryNth

### skipWhile

### copyWithin

### indexed

### includes

### some

### none

### every

### nonIteratedCountOrUndefined

### count

### min

### max

### groupBy

### split

### partitionBySize

### groupJoin

### innerGroupJoin

### join

### innerJoin

### toArray

### toSet

### toMap

### indexBy

### toObject

### asArray

### asSet

### asMap

### asObject

### sort

### sortDescending

### shuffle

### collapse

### sequenceEquals

### makeString

# SortedItmod's methods

### thenBy

### thenByDescending

# GroupedItmod's methods

### mapGroups
