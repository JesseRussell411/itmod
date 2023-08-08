/** The requested operation will not halt. */
export default class NeverEndingOperationError extends Error {
    public constructor(message?: string) {
        super(message);
    }
}
