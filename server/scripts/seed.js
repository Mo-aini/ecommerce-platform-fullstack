/* Resets the database and fills it with demo data: 6 categories, 32 products,
 * an admin, 5 customers, a few orders (both payment types) and reviews. */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const { openDatabase } = require('../src/db');
const { calculateTotals } = require('../src/utils/money');
const slugify = require('../src/utils/slugify');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));
const db = openDatabase(config.dbPath);

const people = [
  { name: 'Store Admin', email: 'admin@shop.test', password: 'Admin1234', role: 'admin' },
  { name: 'Ayesha Malik', email: 'ayesha@shop.test', password: 'Customer1', city: 'Lahore' },
  { name: 'Bilal Ahmed', email: 'bilal@shop.test', password: 'Customer1', city: 'Karachi' },
  { name: 'Fatima Noor', email: 'fatima@shop.test', password: 'Customer1', city: 'Islamabad' },
  { name: 'Omar Farooq', email: 'omar@shop.test', password: 'Customer1', city: 'Lahore' },
  { name: 'Zainab Hussain', email: 'zainab@shop.test', password: 'Customer1', city: 'Multan' },
];

const reviewTexts = [
  [5, 'Excellent quality, exactly as described. Fast delivery too.'],
  [4, 'Very good for the price. Packaging could be better.'],
  [5, 'Using it every day, no complaints at all.'],
  [3, 'It is okay. Does the job but nothing special.'],
  [4, 'Solid build and works well. Would buy again.'],
];

db.transaction(() => {
  for (const t of ['reviews', 'payments', 'order_items', 'orders', 'cart_items', 'refresh_tokens', 'products', 'categories', 'customers']) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
  db.prepare('DELETE FROM sqlite_sequence').run();

  const catId = {};
  for (const c of data.categories) {
    catId[c.slug] = db.prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)').run(c.name, c.slug, c.description).lastInsertRowid;
  }

  const insertProduct = db.prepare(
    `INSERT INTO products (category_id, name, slug, description, price_cents, stock, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
  );
  data.products.forEach((p, i) => {
    insertProduct.run(catId[p.category], p.name, slugify(p.name), p.description, Math.round(p.price * 100), p.stock, p.image, `-${(i * 7) % data.products.length} hours`);
  });

  const ids = people.map((u) =>
    db.prepare('INSERT INTO customers (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(u.name, u.email, bcrypt.hashSync(u.password, config.bcryptRounds), u.role || 'customer', '+92 300 1234567').lastInsertRowid
  );

  // a few historical orders
  const products = db.prepare('SELECT id, name, price_cents FROM products').all();
  const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'delivered', 'paid', 'delivered', 'cancelled',
    'delivered', 'shipped', 'delivered', 'pending', 'delivered', 'paid', 'pending'];
  let r = 0;
  statuses.forEach((plannedStatus, n) => {
    const method = n % 2 === 0 ? 'card_simulated' : 'cod';
    // a simulated card is charged at checkout, cash is only collected on delivery
    let status = plannedStatus;
    if (method === 'card_simulated' && status === 'pending') status = 'paid';
    if (method === 'cod' && status === 'paid') status = 'pending';
    const customerIdx = 1 + (n % 5);
    const picks = [products[(n * 5) % products.length], products[(n * 3 + 1) % products.length]];
    const qty = [1 + (n % 2), 1];
    const subtotal = picks.reduce((s, p, k) => s + p.price_cents * qty[k], 0);
    const t = calculateTotals(subtotal, config);
    const ago = `-${(statuses.length - n) * 2} days`;
    const orderId = db
      .prepare(
        `INSERT INTO orders (customer_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents,
                             ship_name, ship_phone, ship_address, ship_city, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
      )
      .run(ids[customerIdx], status, t.subtotal, t.shipping, t.tax, t.total, people[customerIdx].name, '+92 300 1234567',
        `House ${10 + n}, Street ${n + 2}, Model Town`, people[customerIdx].city, ago).lastInsertRowid;
    picks.forEach((p, k) =>
      db.prepare('INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?)')
        .run(orderId, p.id, p.name, p.price_cents, qty[k])
    );
    const paid = method === 'card_simulated' ? status !== 'pending' : status === 'delivered';
    db.prepare(
      'INSERT INTO payments (order_id, method, status, amount_cents, card_last4, reference, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(orderId, method, status === 'cancelled' && paid ? 'refunded' : paid ? 'paid' : 'pending', t.total,
      method === 'card_simulated' ? '4242' : null, method === 'card_simulated' ? `SIM-SEED${n}` : null, paid ? new Date().toISOString() : null);

    if (status === 'delivered') {
      for (const p of picks) {
        const [rating, comment] = reviewTexts[r % reviewTexts.length];
        r += 1;
        db.prepare('INSERT OR IGNORE INTO reviews (product_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)')
          .run(p.id, ids[customerIdx], rating, comment);
      }
    }
  });
})();

const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(`Seeded ${count('categories')} categories, ${count('products')} products, ${count('customers')} customers, ${count('orders')} orders, ${count('reviews')} reviews`);
console.log('Admin login:    admin@shop.test / Admin1234');
console.log('Customer login: ayesha@shop.test / Customer1');
db.close();
