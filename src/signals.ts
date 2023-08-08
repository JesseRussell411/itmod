export type BreakSignal = symbol;

/** Signal to break out of a loop. */
export const breakSignal: BreakSignal = Symbol("break");
