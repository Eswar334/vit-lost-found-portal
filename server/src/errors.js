/** An error that maps directly to an HTTP response. */
export class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (msg, fields) => new HttpError(400, msg, fields);
export const unauthorized = (msg = 'Please log in to continue.') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have access to this.') => new HttpError(403, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);
export const conflict = (msg, fields) => new HttpError(409, msg, fields);

/** Wrap an async route handler so thrown errors reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, fields: err.fields } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body is not valid JSON.' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request is too large.' } });
  }
  console.error(err);
  return res
    .status(500)
    .json({ error: { message: 'Something went wrong on the server. Try again in a moment.' } });
}
