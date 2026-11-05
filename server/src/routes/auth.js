const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { unauthorized, conflict } = require('../utils/HttpError');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .max(72)
    .regex(/[A-Za-z]/, 'Must contain a letter')
    .regex(/[0-9]/, 'Must contain a number'),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
const refreshSchema = z.object({ refreshToken: z.string().min(20) });

module.exports = function authRoutes({ db, tokens, config }) {
  const router = express.Router();
  const publicCols = 'id, name, email, phone, role, created_at AS createdAt';
  const findById = (id) => db.prepare(`SELECT ${publicCols} FROM customers WHERE id = ?`).get(id);
  const dummyHash = bcrypt.hashSync('dummy-password', config.bcryptRounds);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.loginRateLimit || 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { status: 429, message: 'Too many login attempts, try again later' } },
  });

  router.post('/register', validate(registerSchema), async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      if (db.prepare('SELECT 1 FROM customers WHERE email = ?').get(email)) throw conflict('Email already registered');
      const hash = await bcrypt.hash(password, config.bcryptRounds);
      const { lastInsertRowid } = db
        .prepare('INSERT INTO customers (name, email, password_hash) VALUES (?, ?, ?)')
        .run(name, email, hash);
      const customer = findById(lastInsertRowid);
      res.status(201).json({ user: customer, ...tokens.issue(customer) });
    } catch (e) {
      next(e);
    }
  });

  router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
    try {
      const row = db.prepare('SELECT * FROM customers WHERE email = ?').get(req.body.email);
      const ok = await bcrypt.compare(req.body.password, row ? row.password_hash : dummyHash);
      if (!row || !ok) throw unauthorized('Invalid email or password');
      const customer = findById(row.id);
      res.json({ user: customer, ...tokens.issue(customer) });
    } catch (e) {
      next(e);
    }
  });

  router.post('/refresh', validate(refreshSchema), (req, res, next) => {
    try {
      const r = tokens.rotate(req.body.refreshToken, findById);
      res.json({ user: r.customer, accessToken: r.accessToken, refreshToken: r.refreshToken });
    } catch (e) {
      next(e);
    }
  });

  router.post('/logout', validate(refreshSchema), (req, res) => {
    tokens.revoke(req.body.refreshToken);
    res.status(204).end();
  });

  router.get('/me', authenticate(tokens), (req, res) => res.json({ user: findById(req.user.id) }));

  return router;
};
