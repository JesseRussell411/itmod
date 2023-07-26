/**
 * Shuffles the given array in place.
 * @param array What to shuffle.
 * @param getRandomInt Returns a random integer that's greater than or equal to 0 and less than upperBound. Defaults to using {@link Math.random}, which is not cryptographically secure.
 */
export function shuffle(
    array: any[],
    getRandomInt: (upperBound: number) => number = defaultGetRandomInt
): void {
    // Fisher-Yates algorithm
    for (let i = array.length - 1; i > 0; i--) {
        const j = getRandomInt(i + 1);

        const temp = array[i]!;
        array[i] = array[j]!;
        array[j] = temp;
    }
}

function defaultGetRandomInt(upperBound: number) {
    return Math.trunc(Math.random() * upperBound);
}
