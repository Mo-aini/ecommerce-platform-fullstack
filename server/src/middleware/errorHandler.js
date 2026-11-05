const { notFound: nf } = require('../utils/HttpError');

const notFound = (req, _res, next) => next(nf(`Route ${req.method} ${req.originalUrl} not found`));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { status: 400, message: 'Malformed JSON' } });
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: { status: 409, message: 'Already exists' } });
  const status = err.status || 500;
  if (status >= 500 && process.env.NODE_ENV !== 'test') console.error(err);
  const body = { error: { status, message: status >= 500 ? 'Internal server error' : err.message } };
  if (err.details) body.error.details = err.details;
  return res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
