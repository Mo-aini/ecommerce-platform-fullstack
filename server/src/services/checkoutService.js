const crypto = require('crypto');
const { calculateTotals, luhnValid } = require('../utils/money');
const { badRequest, HttpError } = require('../utils/HttpError');

/**
 * Creates an order from the customer's saved cart inside ONE transaction:
 * check stock -> insert order + items (price snapshot) -> decrement stock ->
 * record the payment -> empty the cart. Any failure rolls everything back.
 *
 * Payments are NOT real: "cod" is cash on delivery, "card_simulated" checks the
 * card format (Luhn + expiry) and stores only the last 4 digits.
 */
module.exports = function checkoutService(db, config) {
  function simulateCard({ cardNumber, expiry }) {
    const digits = String(cardNumber).replace(/\D/g, '');
    if (!luhnValid(digits)) throw badRequest('Card number is not valid');
    const [mm, yy] = String(expiry).split('/').map(Number);
    const expiryEnd = new Date(2000 + yy, mm, 1); // first day after the expiry month
    if (!mm || mm > 12 || expiryEnd <= new Date()) throw badRequest('Card has expired');
    // test card that always declines, like payment sandboxes have
    if (digits === '4000000000000002') throw new HttpError(402, 'Card declined (simulated)');
    return { last4: digits.slice(-4), reference: `SIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}` };
  }

  const placeOrder = db.transaction((customerId, shipping, payment) => {
    const items = db
      .prepare(
        `SELECT ci.product_id, ci.quantity, p.name, p.price_cents, p.stock
         FROM cart_items ci JOIN products p ON p.id = ci.product_id
         WHERE ci.customer_id = ? AND p.is_active = 1`
      )
      .all(customerId);
    if (items.length === 0) throw badRequest('Your cart is empty');

    const short = items.find((i) => i.quantity > i.stock);
    if (short) throw badRequest(`Not enough stock for "${short.name}" (only ${short.stock} left)`);

    const card = payment.method === 'card_simulated' ? simulateCard(payment) : null;
    const totals = calculateTotals(items.reduce((s, i) => s + i.price_cents * i.quantity, 0), config);

    const { lastInsertRowid: orderId } = db
      .prepare(
        `INSERT INTO orders (customer_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents,
                             ship_name, ship_phone, ship_address, ship_city)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(customerId, card ? 'paid' : 'pending', totals.subtotal, totals.shipping, totals.tax, totals.total,
        shipping.name, shipping.phone, shipping.address, shipping.city);

    const addItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?)'
    );
    const takeStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    for (const i of items) {
      addItem.run(orderId, i.product_id, i.name, i.price_cents, i.quantity);
      if (takeStock.run(i.quantity, i.product_id, i.quantity).changes !== 1) throw badRequest('Stock changed, try again');
    }

    db.prepare(
      `INSERT INTO payments (order_id, method, status, amount_cents, card_last4, reference, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(orderId, payment.method, card ? 'paid' : 'pending', totals.total, card?.last4 ?? null,
      card?.reference ?? null, card ? new Date().toISOString() : null);

    db.prepare('DELETE FROM cart_items WHERE customer_id = ?').run(customerId);
    return orderId;
  });

  function getOrder(orderId) {
    const order = db
      .prepare(
        `SELECT o.id, o.customer_id AS customerId, cu.name AS customerName, cu.email AS customerEmail, o.status,
                o.subtotal_cents AS subtotalCents, o.shipping_cents AS shippingCents, o.tax_cents AS taxCents,
                o.total_cents AS totalCents, o.ship_name AS shipName, o.ship_phone AS shipPhone,
                o.ship_address AS shipAddress, o.ship_city AS shipCity, o.created_at AS createdAt
         FROM orders o JOIN customers cu ON cu.id = o.customer_id WHERE o.id = ?`
      )
      .get(orderId);
    if (!order) return null;
    order.items = db
      .prepare(
        `SELECT oi.product_id AS productId, oi.product_name AS name, oi.unit_price_cents AS unitPriceCents,
                oi.quantity, p.slug, p.image_url AS imageUrl
         FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`
      )
      .all(orderId);
    order.payment = db
      .prepare('SELECT method, status, amount_cents AS amountCents, card_last4 AS cardLast4, reference, paid_at AS paidAt FROM payments WHERE order_id = ?')
      .get(orderId);
    return order;
  }

  return { placeOrder, getOrder };
};
