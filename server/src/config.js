require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT) || 4000,
  env: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || './data/shop.db',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-only-secret',
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  },
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7,
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  shippingFlatCents: 500,
  freeShippingOverCents: 10000,
  taxRate: 0.05,
};
