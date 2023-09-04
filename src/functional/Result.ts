export default class Result<T> {
    public readonly value?: T;
    public readonly error?: any;
    public readonly isError: boolean;

    public get notError(): boolean {
        return !this.isError;
    }

    private constructor(isError: boolean, value?: T, error?: any) {
        if (isError) {
            this.error = error;
        } else {
            this.value = value;
        }
        this.isError = isError;
    }

    public static of<T>(value: T): Result<T> {
        return new Result(false, value);
    }

    public static error<T = any>(error: any): Result<T> {
        return new Result<T>(true, undefined, error);
    }

    public static from<T>(action: () => T): Result<T> {
        try {
            return Result.of(action());
        } catch (e) {
            return Result.error<T>(e);
        }
    }

    public static async ofPromise<T>(promise: Promise<T>): Promise<Result<T>> {
        try {
            return Result.of(await promise);
        } catch (e) {
            return Result.error(e);
        }
    }

    /**
     * @returns The value.
     * @throws The error if there is one.
     */
    public extract(): T {
        if (this.isError) {
            throw this.error;
        } else {
            return this.value as T;
        }
    }

    public catch<R>(catcher: (error: any) => R): Result<R | T> {
        if (this.isError) {
            try {
                return Result.of(catcher(this.error));
            } catch (e) {
                return Result.error<R>(e);
            }
        } else {
            return this as any;
        }
    }

    public then<R>(
        action: (value: T) => R,
        handleError?: (error: any) => R
    ): Result<R> {
        if (this.isError) {
            if (handleError !== undefined) {
                try {
                    return Result.of(handleError(this.error));
                } catch (e) {
                    return Result.error<R>(e);
                }
            } else {
                return this as any;
            }
        } else {
            try {
                return Result.of(action(this.value as T));
            } catch (e) {
                if (handleError !== undefined) {
                    try {
                        return Result.of(handleError(e));
                    } catch (e) {
                        return Result.error<R>(e);
                    }
                } else {
                    return Result.error<R>(e);
                }
            }
        }
    }

    public finally(action: () => any): Result<T> {
        try {
            action();
            return this;
        } catch (e) {
            return Result.error<T>(e);
        }
    }

    public asPromise(): Promise<T> {
        if (this.isError) {
            return Promise.reject(this.error);
        } else {
            return Promise.resolve(this.value as T);
        }
    }
}
