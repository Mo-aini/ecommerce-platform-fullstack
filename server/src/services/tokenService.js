const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { unauthorized } = require('../utils/HttpError');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

/** Same pattern as my rest-api-auth-system: short JWT + single-use refresh tokens stored hashed. */
module.exports = function tokenService(db, config) {
  const insert = db.prepare('INSERT INTO refresh_tokens (customer_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)');
  const byHash = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?');
  const revoke = db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?");
  const revokeFamily = db.prepare("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE family_id = ?");

  const signAccessToken = (c) =>
    jwt.sign({ sub: String(c.id), role: c.role, name: c.name }, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessTtl,
      jwtid: crypto.randomUUID(),
    });

  function newRefreshToken(customerId, familyId = crypto.randomUUID()) {
    const token = crypto.randomBytes(48).toString('hex');
    const expires = new Date(Date.now() + config.refreshTokenTtlDays * 864e5).toISOString();
    insert.run(customerId, sha256(token), familyId, expires);
    return token;
  }

  const rotateTx = db.transaction((raw) => {
    const row = byHash.get(sha256(raw));
    if (!row) return { error: 'Invalid refresh token' };
    if (row.revoked_at) {
      revokeFamily.run(row.family_id);
      return { error: 'Refresh token reuse detected' };
    }
    if (new Date(row.expires_at) < new Date()) return { error: 'Refresh token expired' };
    revoke.run(row.id);
    return { customerId: row.customer_id, refreshToken: newRefreshToken(row.customer_id, row.family_id) };
  });

  return {
    verifyAccessToken: (t) => jwt.verify(t, config.jwt.accessSecret),
    issue: (c) => ({ accessToken: signAccessToken(c), refreshToken: newRefreshToken(c.id) }),
    rotate(raw, loadCustomer) {
      const r = rotateTx(raw);
      if (r.error) throw unauthorized(r.error);
      const customer = loadCustomer(r.customerId);
      return { customer, accessToken: signAccessToken(customer), refreshToken: r.refreshToken };
    },
    revoke(raw) {
      const row = byHash.get(sha256(raw));
      if (row) revoke.run(row.id);
    },
  };
};
