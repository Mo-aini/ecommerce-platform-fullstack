const { unauthorized, forbidden } = require('../utils/HttpError');

const authenticate = (tokens, { optional = false } = {}) => (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return optional ? next() : next(unauthorized());
  try {
    const p = tokens.verifyAccessToken(token);
    req.user = { id: Number(p.sub), role: p.role, name: p.name };
    return next();
  } catch (err) {
    return next(unauthorized(err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token'));
  }
};

const requireAdmin = (req, _res, next) => (req.user?.role === 'admin' ? next() : next(forbidden()));

module.exports = { authenticate, requireAdmin };
