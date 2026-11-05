const request = require('supertest');
const bcrypt = require('bcryptjs');
const { openDatabase } = require('../src/db');
const createApp = require('../src/app');
const baseConfig = require('../src/config');

function setup() {
  const config = { ...baseConfig, bcryptRounds: 4, jwt: { accessSecret: 'test', accessTtl: '15m' }, loginRateLimit: 1000 };
  const db = openDatabase(':memory:');
  const cat = db.prepare("INSERT INTO categories (name, slug) VALUES ('Electronics', 'electronics')").run().lastInsertRowid;
  const cat2 = db.prepare("INSERT INTO categories (name, slug) VALUES ('Books', 'books')").run().lastInsertRowid;
  const add = db.prepare('INSERT INTO products (category_id, name, slug, description, price_cents, stock) VALUES (?, ?, ?, ?, ?, ?)');
  const products = {
    headphones: add.run(cat, 'Wireless Headphones', 'wireless-headphones', 'Noise cancelling', 8999, 5).lastInsertRowid,
    mouse: add.run(cat, 'Gaming Mouse', 'gaming-mouse', 'RGB mouse', 2999, 2).lastInsertRowid,
    book: add.run(cat2, 'Clean Code', 'clean-code', 'A book about code', 3400, 10).lastInsertRowid,
  };
  db.prepare("INSERT INTO customers (name, email, password_hash, role) VALUES ('Admin', 'admin@test.dev', ?, 'admin')")
    .run(bcrypt.hashSync('Admin1234', 4));
  const app = createApp({ db, config });
  return { app, db, products, categories: { electronics: cat, books: cat2 } };
}

async function login(app, email = 'admin@test.dev', password = 'Admin1234') {
  return (await request(app).post('/api/auth/login').send({ email, password })).body.accessToken;
}

async function registerCustomer(app, email = 'sara@test.dev') {
  const res = await request(app).post('/api/auth/register').send({ name: 'Sara', email, password: 'Secret123' });
  return res.body.accessToken;
}

const shipping = { name: 'Sara Khan', phone: '+92 300 1112233', address: 'House 5, Street 2, Gulberg', city: 'Lahore' };

module.exports = { setup, login, registerCustomer, shipping };
