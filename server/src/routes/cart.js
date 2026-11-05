const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { notFound, badRequest } = require('../utils/HttpError');

const qtySchema = z.object({ quantity: z.coerce.number().int().min(0).max(99) });
const mergeSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) })).max(100),
});

module.exports = function cartRoutes({ db, tokens }) {
  const router = express.Router();
  router.use(authenticate(tokens));

  const getCart = (customerId) => {
    const items = db
      .prepare(
        `SELECT ci.product_id AS productId, ci.quantity, p.name, p.slug, p.price_cents AS priceCents,
                p.stock, p.image_url AS imageUrl
         FROM cart_items ci JOIN products p ON p.id = ci.product_id
         WHERE ci.customer_id = ? AND p.is_active = 1 ORDER BY ci.added_at, p.name`
      )
      .all(customerId);
    const subtotalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    return { items, subtotalCents, count: items.reduce((s, i) => s + i.quantity, 0) };
  };

  const product = (id) => db.prepare('SELECT id, stock FROM products WHERE id = ? AND is_active = 1').get(id);
  const upsert = db.prepare(
    `INSERT INTO cart_items (customer_id, product_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT (customer_id, product_id) DO UPDATE SET quantity = excluded.quantity`
  );

  router.get('/', (req, res) => res.json(getCart(req.user.id)));

  router.put('/items/:productId', validate(qtySchema), (req, res, next) => {
    const p = product(Number(req.params.productId));
    if (!p) return next(notFound('Product not found'));
    const { quantity } = req.body;
    if (quantity === 0) {
      db.prepare('DELETE FROM cart_items WHERE customer_id = ? AND product_id = ?').run(req.user.id, p.id);
    } else {
      if (quantity > p.stock) return next(badRequest(`Only ${p.stock} left in stock`));
      upsert.run(req.user.id, p.id, quantity);
    }
    return res.json(getCart(req.user.id));
  });

  router.delete('/items/:productId', (req, res) => {
    db.prepare('DELETE FROM cart_items WHERE customer_id = ? AND product_id = ?').run(req.user.id, Number(req.params.productId));
    res.json(getCart(req.user.id));
  });

  router.delete('/', (req, res) => {
    db.prepare('DELETE FROM cart_items WHERE customer_id = ?').run(req.user.id);
    res.json(getCart(req.user.id));
  });

  /** Called after login: adds the guest (localStorage) cart into the saved cart. */
  router.post('/merge', validate(mergeSchema), (req, res) => {
    const existing = db.prepare('SELECT quantity FROM cart_items WHERE customer_id = ? AND product_id = ?');
    db.transaction(() => {
      for (const item of req.body.items) {
        const p = product(item.productId);
        if (!p || p.stock === 0) continue;
        const current = existing.get(req.user.id, p.id)?.quantity || 0;
        upsert.run(req.user.id, p.id, Math.min(p.stock, current + item.quantity));
      }
    })();
    res.json(getCart(req.user.id));
  });

  return router;
};
