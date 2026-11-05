const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { notFound, badRequest } = require('../utils/HttpError');

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating', 'name']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(''),
});

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price_cents ASC',
  price_desc: 'p.price_cents DESC',
  rating: 'rating DESC, review_count DESC',
  name: 'p.name COLLATE NOCASE ASC',
};

const PRODUCT_SELECT = `
  SELECT p.id, p.name, p.slug, p.description, p.price_cents AS priceCents, p.stock, p.image_url AS imageUrl,
         c.name AS category, c.slug AS categorySlug,
         ROUND(COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = p.id), 0), 1) AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
  FROM products p JOIN categories c ON c.id = p.category_id`;

module.exports = function catalogRoutes({ db, tokens }) {
  const router = express.Router();

  router.get('/categories', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description, COUNT(p.id) AS productCount
         FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
         GROUP BY c.id ORDER BY c.name`
      )
      .all();
    res.json({ data: rows });
  });

  router.get('/products', validate(listQuery, 'query'), (req, res) => {
    const { q, category, minPrice, maxPrice, sort, page, limit } = req.validated;
    const where = ['p.is_active = 1'];
    const params = {};
    if (q) {
      where.push('(p.name LIKE @q OR p.description LIKE @q)');
      params.q = `%${q}%`;
    }
    if (category) {
      where.push('c.slug = @category');
      params.category = category;
    }
    if (minPrice !== undefined) {
      where.push('p.price_cents >= @min');
      params.min = Math.round(minPrice * 100);
    }
    if (maxPrice !== undefined) {
      where.push('p.price_cents <= @max');
      params.max = Math.round(maxPrice * 100);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id ${whereSql}`)
      .get(params).n;
    const data = db
      .prepare(`${PRODUCT_SELECT} ${whereSql} ORDER BY ${SORTS[sort]} LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset: (page - 1) * limit })
      .map(({ review_count: reviewCount, ...p }) => ({ ...p, reviewCount }));
    res.json({ data, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });
  });

  router.get('/products/:slug', (req, res, next) => {
    const row = db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.is_active = 1`).get(req.params.slug);
    if (!row) return next(notFound('Product not found'));
    const { review_count: reviewCount, ...product } = row;
    const reviews = db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, cu.name AS author
         FROM reviews r JOIN customers cu ON cu.id = r.customer_id
         WHERE r.product_id = ? ORDER BY r.created_at DESC, r.id DESC`
      )
      .all(product.id);
    const related = db
      .prepare(`${PRODUCT_SELECT} WHERE p.category_id = (SELECT category_id FROM products WHERE id = ?) AND p.id != ? AND p.is_active = 1 LIMIT 4`)
      .all(product.id, product.id)
      .map(({ review_count: rc, ...p }) => ({ ...p, reviewCount: rc }));
    return res.json({ product: { ...product, reviewCount }, reviews, related });
  });

  router.post('/products/:id/reviews', authenticate(tokens), validate(reviewSchema), (req, res, next) => {
    const productId = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) return next(notFound('Product not found'));
    const bought = db
      .prepare(
        `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.customer_id = ? AND oi.product_id = ? AND o.status != 'cancelled' LIMIT 1`
      )
      .get(req.user.id, productId);
    if (!bought) return next(badRequest('You can only review products you have ordered'));
    const { lastInsertRowid } = db
      .prepare('INSERT INTO reviews (product_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)')
      .run(productId, req.user.id, req.body.rating, req.body.comment);
    return res.status(201).json({ review: db.prepare('SELECT * FROM reviews WHERE id = ?').get(lastInsertRowid) });
  });

  return router;
};
