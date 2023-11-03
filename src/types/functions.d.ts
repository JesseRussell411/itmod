/** Maps the tuple of functions to a tuple of their respective return types. */
type ReturnTypes<Functions extends readonly ((...args: any[]) => any)[]> =
    Functions extends readonly [(...args: any[]) => infer R, ...infer Rest]
        ? [
              R,
              ...ReturnTypes<
                  Rest extends readonly ((...args: any[]) => any)[] ? Rest : []
              >
          ]
        : [];
