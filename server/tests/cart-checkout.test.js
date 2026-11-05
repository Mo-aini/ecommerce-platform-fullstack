const request = require('supertest');
const { setup, registerCustomer, shipping } = require('./helpers');

describe('cart and checkout', () => {
  let ctx, token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeEach(async () => {
    ctx = setup();
    token = await registerCustomer(ctx.app);
  });
  afterEach(() => ctx.db.close());

  const addToCart = (id, quantity) => auth(request(ctx.app).put(`/api/cart/items/${id}`)).send({ quantity });

  test('the cart requires login', async () => {
    expect((await request(ctx.app).get('/api/cart')).status).toBe(401);
  });

  test('adds, updates and removes cart items', async () => {
    await addToCart(ctx.products.headphones, 1);
    let res = await addToCart(ctx.products.headphones, 3);
    expect(res.body.count).toBe(3);
    expect(res.body.subtotalCents).toBe(3 * 8999);
    res = await addToCart(ctx.products.headphones, 0);
    expect(res.body.items).toHaveLength(0);
  });

  test('cannot add more than the stock', async () => {
    const res = await addToCart(ctx.products.mouse, 3);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Only 2 left in stock');
  });

  test('merges the guest cart after login (capped by stock)', async () => {
    await addToCart(ctx.products.mouse, 1);
    const res = await auth(request(ctx.app).post('/api/cart/merge')).send({
      items: [{ productId: ctx.products.mouse, quantity: 5 }, { productId: ctx.products.book, quantity: 2 }],
    });
    const qty = Object.fromEntries(res.body.items.map((i) => [i.productId, i.quantity]));
    expect(qty[ctx.products.mouse]).toBe(2);
    expect(qty[ctx.products.book]).toBe(2);
  });

  test('checkout with cash on delivery creates a pending order, decrements stock and empties the cart', async () => {
    await addToCart(ctx.products.headphones, 2);
    const res = await auth(request(ctx.app).post('/api/orders')).send({ shipping, payment: { method: 'cod' } });
    expect(res.status).toBe(201);
    const { order } = res.body;
    expect(order.status).toBe('pending');
    expect(order.payment).toMatchObject({ method: 'cod', status: 'pending' });
    expect(order.subtotalCents).toBe(17998);
    expect(order.shippingCents).toBe(0); // free shipping over $100
    expect(order.totalCents).toBe(17998 + Math.round(17998 * 0.05));
    expect(ctx.db.prepare('SELECT stock FROM products WHERE id = ?').get(ctx.products.headphones).stock).toBe(3);
    expect((await auth(request(ctx.app).get('/api/cart'))).body.items).toHaveLength(0);
  });

  test('checkout with a simulated card marks the order paid and stores only the last 4 digits', async () => {
    await addToCart(ctx.products.book, 1);
    const res = await auth(request(ctx.app).post('/api/orders')).send({
      shipping,
      payment: { method: 'card_simulated', cardNumber: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' },
    });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.order.payment.cardLast4).toBe('4242');
    expect(res.body.order.shippingCents).toBe(500);
    const row = ctx.db.prepare('SELECT * FROM payments').get();
    expect(JSON.stringify(row)).not.toContain('4242424242424242');
  });

  test('a declined simulated card rolls the whole order back', async () => {
    await addToCart(ctx.products.book, 1);
    const res = await auth(request(ctx.app).post('/api/orders')).send({
      shipping,
      payment: { method: 'card_simulated', cardNumber: '4000000000000002', expiry: '12/30', cvc: '123' },
    });
    expect(res.status).toBe(402);
    expect(ctx.db.prepare('SELECT COUNT(*) AS n FROM orders').get().n).toBe(0);
    expect(ctx.db.prepare('SELECT stock FROM products WHERE id = ?').get(ctx.products.book).stock).toBe(10);
    expect((await auth(request(ctx.app).get('/api/cart'))).body.items).toHaveLength(1);
  });

  test('rejects an invalid card number and bad shipping data', async () => {
    await addToCart(ctx.products.book, 1);
    const badCard = await auth(request(ctx.app).post('/api/orders')).send({
      shipping,
      payment: { method: 'card_simulated', cardNumber: '1234 5678 9012 3456', expiry: '12/30', cvc: '123' },
    });
    expect(badCard.status).toBe(400);
    const badShip = await auth(request(ctx.app).post('/api/orders')).send({ shipping: { name: 'A' }, payment: { method: 'cod' } });
    expect(badShip.status).toBe(400);
  });

  test('fails if stock ran out after the item was added', async () => {
    await addToCart(ctx.products.mouse, 2);
    ctx.db.prepare('UPDATE products SET stock = 1 WHERE id = ?').run(ctx.products.mouse);
    const res = await auth(request(ctx.app).post('/api/orders')).send({ shipping, payment: { method: 'cod' } });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Not enough stock/);
  });

  test('order history shows only my orders', async () => {
    await addToCart(ctx.products.book, 1);
    const placed = await auth(request(ctx.app).post('/api/orders')).send({ shipping, payment: { method: 'cod' } });
    const other = await registerCustomer(ctx.app, 'other@test.dev');
    const mine = await auth(request(ctx.app).get('/api/orders'));
    expect(mine.body.data).toHaveLength(1);
    const theirs = await request(ctx.app).get(`/api/orders/${placed.body.order.id}`).set('Authorization', `Bearer ${other}`);
    expect(theirs.status).toBe(404);
  });

  test('only customers who ordered a product can review it', async () => {
    const before = await auth(request(ctx.app).post(`/api/products/${ctx.products.book}/reviews`)).send({ rating: 5 });
    expect(before.status).toBe(400);
    await addToCart(ctx.products.book, 1);
    await auth(request(ctx.app).post('/api/orders')).send({ shipping, payment: { method: 'cod' } });
    const after = await auth(request(ctx.app).post(`/api/products/${ctx.products.book}/reviews`)).send({ rating: 5, comment: 'Great' });
    expect(after.status).toBe(201);
    const page = await request(ctx.app).get('/api/products/clean-code');
    expect(page.body.product.rating).toBe(5);
    expect(page.body.reviews[0].author).toBe('Sara');
  });
});
