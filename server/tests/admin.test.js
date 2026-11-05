const request = require('supertest');
const { setup, login, registerCustomer, shipping } = require('./helpers');

describe('admin', () => {
  let ctx, admin;
  const asAdmin = (r) => r.set('Authorization', `Bearer ${admin}`);
  const product = (over = {}) => ({ name: 'USB-C Hub', description: '7-in-1 hub', price: 25.5, stock: 12, categoryId: ctx.categories.electronics, ...over });

  beforeEach(async () => {
    ctx = setup();
    admin = await login(ctx.app);
  });
  afterEach(() => ctx.db.close());

  test('customers cannot use admin routes', async () => {
    const customer = await registerCustomer(ctx.app);
    const res = await request(ctx.app).get('/api/admin/products').set('Authorization', `Bearer ${customer}`);
    expect(res.status).toBe(403);
  });

  test('creates a product with a unique slug and price in cents', async () => {
    const a = await asAdmin(request(ctx.app).post('/api/admin/products')).send(product());
    const b = await asAdmin(request(ctx.app).post('/api/admin/products')).send(product());
    expect(a.status).toBe(201);
    expect(a.body.product).toMatchObject({ slug: 'usb-c-hub', price_cents: 2550 });
    expect(b.body.product.slug).toBe('usb-c-hub-2');
  });

  test('validates product input', async () => {
    const res = await asAdmin(request(ctx.app).post('/api/admin/products')).send(product({ price: -1, categoryId: 999 }));
    expect(res.status).toBe(400);
  });

  test('updates a product', async () => {
    const res = await asAdmin(request(ctx.app).put(`/api/admin/products/${ctx.products.mouse}`)).send(product({ name: 'Gaming Mouse Pro', price: 39 }));
    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({ name: 'Gaming Mouse Pro', price_cents: 3900 });
  });

  test('deletes an unordered product but only hides an ordered one', async () => {
    const del = await asAdmin(request(ctx.app).delete(`/api/admin/products/${ctx.products.mouse}`));
    expect(del.body).toEqual({ deleted: true, hidden: false });

    const customer = await registerCustomer(ctx.app);
    await request(ctx.app).put(`/api/cart/items/${ctx.products.book}`).set('Authorization', `Bearer ${customer}`).send({ quantity: 1 });
    await request(ctx.app).post('/api/orders').set('Authorization', `Bearer ${customer}`).send({ shipping, payment: { method: 'cod' } });
    const hide = await asAdmin(request(ctx.app).delete(`/api/admin/products/${ctx.products.book}`));
    expect(hide.body).toEqual({ deleted: false, hidden: true });
    expect((await request(ctx.app).get('/api/products/clean-code')).status).toBe(404);
  });

  test('lists orders, moves status forward and restocks on cancel', async () => {
    const customer = await registerCustomer(ctx.app);
    await request(ctx.app).put(`/api/cart/items/${ctx.products.headphones}`).set('Authorization', `Bearer ${customer}`).send({ quantity: 2 });
    const { order } = (await request(ctx.app).post('/api/orders').set('Authorization', `Bearer ${customer}`).send({ shipping, payment: { method: 'cod' } })).body;

    const list = await asAdmin(request(ctx.app).get('/api/admin/orders?status=pending'));
    expect(list.body.data).toHaveLength(1);

    const bad = await asAdmin(request(ctx.app).patch(`/api/admin/orders/${order.id}/status`)).send({ status: 'delivered' });
    expect(bad.status).toBe(400);

    const cancelled = await asAdmin(request(ctx.app).patch(`/api/admin/orders/${order.id}/status`)).send({ status: 'cancelled' });
    expect(cancelled.body.order.status).toBe('cancelled');
    expect(ctx.db.prepare('SELECT stock FROM products WHERE id = ?').get(ctx.products.headphones).stock).toBe(5);
  });

  test('cash on delivery is marked paid when the order is delivered', async () => {
    const customer = await registerCustomer(ctx.app);
    await request(ctx.app).put(`/api/cart/items/${ctx.products.book}`).set('Authorization', `Bearer ${customer}`).send({ quantity: 1 });
    const { order } = (await request(ctx.app).post('/api/orders').set('Authorization', `Bearer ${customer}`).send({ shipping, payment: { method: 'cod' } })).body;
    await asAdmin(request(ctx.app).patch(`/api/admin/orders/${order.id}/status`)).send({ status: 'shipped' });
    const done = await asAdmin(request(ctx.app).patch(`/api/admin/orders/${order.id}/status`)).send({ status: 'delivered' });
    expect(done.body.order.payment.status).toBe('paid');
  });

  test('stats include revenue, low stock and top products', async () => {
    const res = await asAdmin(request(ctx.app).get('/api/admin/stats'));
    expect(res.status).toBe(200);
    expect(res.body.lowStock.map((p) => p.name)).toEqual(['Gaming Mouse', 'Wireless Headphones']);
    expect(res.body).toHaveProperty('revenueCents', 0);
  });
});
