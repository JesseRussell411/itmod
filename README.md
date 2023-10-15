# itmod
Stands for Iterator Modifier. Linq for typescript.

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
console.log("meeeeeeeeeeeeean:", mean);
```
