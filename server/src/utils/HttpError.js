class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
const badRequest = (m, d) => new HttpError(400, m, d);
const unauthorized = (m = 'Please log in') => new HttpError(401, m);
const forbidden = (m = 'Admins only') => new HttpError(403, m);
const notFound = (m = 'Not found') => new HttpError(404, m);
const conflict = (m) => new HttpError(409, m);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
