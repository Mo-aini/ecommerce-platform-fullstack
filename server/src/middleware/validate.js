const { badRequest } = require('../utils/HttpError');

/** validate(schema) parses req.body with a zod schema and replaces it with the parsed value. */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(badRequest('Validation failed', details));
  }
  if (source === 'body') req.body = result.data;
  else req.validated = result.data;
  return next();
};

module.exports = validate;
