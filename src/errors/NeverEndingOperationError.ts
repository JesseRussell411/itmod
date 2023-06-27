export default class NeverEndingOperationError extends Error {
    public constructor(message?: string) {
        super(message);
    }
}
