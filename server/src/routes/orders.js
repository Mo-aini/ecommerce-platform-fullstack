const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { notFound } = require('../utils/HttpError');

const checkoutSchema = z.object({
  shipping: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
    address: z.string().trim().min(5).max(200),
    city: z.string().trim().min(2).max(60),
  }),
  payment: z.discriminatedUnion('method', [
    z.object({ method: z.literal('cod') }),
    z.object({
      method: z.literal('card_simulated'),
      cardNumber: z.string().min(12).max(23),
      expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Use MM/YY'),
      cvc: z.string().regex(/^\d{3,4}$/, 'CVC must be 3-4 digits'),
    }),
  ]),
});

module.exports = function orderRoutes({ db, tokens, checkout }) {
  const router = express.Router();
  router.use(authenticate(tokens));

  router.post('/', validate(checkoutSchema), (req, res, next) => {
    try {
      const orderId = checkout.placeOrder(req.user.id, req.body.shipping, req.body.payment);
      res.status(201).json({ order: checkout.getOrder(orderId) });
    } catch (e) {
      next(e);
    }
  });

  router.get('/', (req, res) => {
    const rows = db
      .prepare(
        `SELECT o.id, o.status, o.total_cents AS totalCents, o.created_at AS createdAt,
                (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS itemCount,
                pay.method AS paymentMethod, pay.status AS paymentStatus
         FROM orders o LEFT JOIN payments pay ON pay.order_id = o.id
         WHERE o.customer_id = ? ORDER BY o.created_at DESC, o.id DESC`
      )
      .all(req.user.id);
    res.json({ data: rows });
  });

  router.get('/:id', (req, res, next) => {
    const order = checkout.getOrder(Number(req.params.id));
    if (!order || (order.customerId !== req.user.id && req.user.role !== 'admin')) return next(notFound('Order not found'));
    return res.json({ order });
  });

  return router;
};
