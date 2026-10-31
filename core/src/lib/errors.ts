export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 410 | 411 | 413 | 415 | 422 | 429 | 500,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export const badRequest = (message: string, code = 'BAD_REQUEST') => new HttpError(400, code, message);
export const unauthorized = (message = 'Please sign in to continue') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You are not allowed to do this') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (what = 'That') => new HttpError(404, 'NOT_FOUND', `${what} was not found`);
export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message);
export const tooMany = (message = 'Too many attempts. Please wait a little and try again.') =>
  new HttpError(429, 'RATE_LIMITED', message);
