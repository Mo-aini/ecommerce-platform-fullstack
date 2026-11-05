const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { notFound, badRequest } = require('../utils/HttpError');
const slugify = require('../utils/slugify');

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  price: z.coerce.number().min(0).max(100000),
  stock: z.coerce.number().int().min(0).max(100000),
  categoryId: z.coerce.number().int().positive(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const STATUS_FLOW = {
  pending: ['paid', 'shipped', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

module.exports = function adminRoutes({ db, tokens, checkout }) {
  const router = express.Router();
  router.use(authenticate(tokens), requireAdmin);

  router.get('/stats', (_req, res) => {
    const one = (sql) => db.prepare(sql).get();
    res.json({
      revenueCents: one("SELECT COALESCE(SUM(total_cents),0) AS v FROM orders WHERE status != 'cancelled'").v,
      orders: one('SELECT COUNT(*) AS v FROM orders').v,
      pendingOrders: one("SELECT COUNT(*) AS v FROM orders WHERE status = 'pending'").v,
      customers: one("SELECT COUNT(*) AS v FROM customers WHERE role = 'customer'").v,
      lowStock: db.prepare('SELECT id, name, stock FROM products WHERE is_active = 1 AND stock <= 5 ORDER BY stock').all(),
      topProducts: db
        .prepare(
          `SELECT oi.product_name AS name, SUM(oi.quantity) AS sold, SUM(oi.quantity * oi.unit_price_cents) AS revenueCents
           FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
           GROUP BY oi.product_id ORDER BY sold DESC LIMIT 5`
        )
        .all(),
    });
  });

  router.get('/products', (_req, res) => {
    res.json({
      data: db
        .prepare(
          `SELECT p.id, p.name, p.slug, p.price_cents AS priceCents, p.stock, p.is_active AS isActive,
                  p.image_url AS imageUrl, p.category_id AS categoryId, c.name AS category, p.description
           FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.id DESC`
        )
        .all(),
    });
  });

  const uniqueSlug = (name, ignoreId = 0) => {
    const base = slugify(name);
    let slug = base;
    for (let n = 2; db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(slug, ignoreId); n += 1) slug = `${base}-${n}`;
    return slug;
  };

  const checkCategory = (id) => {
    if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) throw badRequest('Unknown category');
  };

  router.post('/products', validate(productSchema), (req, res, next) => {
    try {
      const b = req.body;
      checkCategory(b.categoryId);
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO products (category_id, name, slug, description, price_cents, stock, image_url, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(b.categoryId, b.name, uniqueSlug(b.name), b.description, Math.round(b.price * 100), b.stock, b.imageUrl || null, b.isActive ? 1 : 0);
      res.status(201).json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(lastInsertRowid) });
    } catch (e) {
      next(e);
    }
  });

  router.put('/products/:id', validate(productSchema), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) throw notFound('Product not found');
      const b = req.body;
      checkCategory(b.categoryId);
      db.prepare(
        `UPDATE products SET category_id = ?, name = ?, slug = ?, description = ?, price_cents = ?, stock = ?,
                image_url = ?, is_active = ? WHERE id = ?`
      ).run(b.categoryId, b.name, uniqueSlug(b.name, id), b.description, Math.round(b.price * 100), b.stock, b.imageUrl || null, b.isActive ? 1 : 0, id);
      res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(id) });
    } catch (e) {
      next(e);
    }
  });

  /** Products that appear in orders are hidden (soft delete) instead of removed. */
  router.delete('/products/:id', (req, res, next) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) return next(notFound('Product not found'));
    const ordered = db.prepare('SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1').get(id);
    if (ordered) db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
    else db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return res.json({ deleted: !ordered, hidden: Boolean(ordered) });
  });

  router.get('/orders', (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const rows = db
      .prepare(
        `SELECT o.id, o.status, o.total_cents AS totalCents, o.created_at AS createdAt, cu.name AS customer,
                o.ship_city AS city, pay.method AS paymentMethod, pay.status AS paymentStatus,
                (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS itemCount
         FROM orders o JOIN customers cu ON cu.id = o.customer_id LEFT JOIN payments pay ON pay.order_id = o.id
         WHERE (@status IS NULL OR o.status = @status)
         ORDER BY o.created_at DESC, o.id DESC`
      )
      .all({ status });
    res.json({ data: rows });
  });

  router.patch('/orders/:id/status', validate(z.object({ status: z.enum(Object.keys(STATUS_FLOW)) })), (req, res, next) => {
    const order = checkout.getOrder(Number(req.params.id));
    if (!order) return next(notFound('Order not found'));
    const next_ = req.body.status;
    if (!STATUS_FLOW[order.status].includes(next_)) {
      return next(badRequest(`Cannot change status from ${order.status} to ${next_}`));
    }
    db.transaction(() => {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(next_, order.id);
      if (next_ === 'cancelled') {
        // put the items back in stock
        for (const item of order.items) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.productId);
        if (order.payment?.status === 'paid') db.prepare("UPDATE payments SET status = 'refunded' WHERE order_id = ?").run(order.id);
      }
      if (next_ === 'delivered' && order.payment?.method === 'cod') {
        // cash collected by the courier
        db.prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE order_id = ?").run(new Date().toISOString(), order.id);
      }
    })();
    return res.json({ order: checkout.getOrder(order.id) });
  });

  return router;
};
