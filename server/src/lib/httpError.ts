// An error with an HTTP status. Controllers throw it, and middleware/error.ts
// turns it into a JSON response, so handlers never build error responses by hand.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
