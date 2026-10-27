/** A debug call's failure as one short word for the note line: the server's code when it sent one. */
export const describeFailure = (error: unknown) =>
	error instanceof Error && "code" in error ? String(error.code) : error instanceof Error ? error.message : "error";
