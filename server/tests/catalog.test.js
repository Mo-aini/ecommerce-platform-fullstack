const request = require('supertest');
const { setup } = require('./helpers');

describe('catalog', () => {
  let ctx;
  beforeEach(() => (ctx = setup()));
  afterEach(() => ctx.db.close());

  test('lists categories with product counts', async () => {
    const res = await request(ctx.app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: 'electronics', productCount: 2 })])
    );
  });

  test('searches products by name or description', async () => {
    const res = await request(ctx.app).get('/api/products?q=mouse');
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('Gaming Mouse');
  });

  test('filters by category and sorts by price', async () => {
    const res = await request(ctx.app).get('/api/products?category=electronics&sort=price_asc');
    expect(res.body.data.map((p) => p.priceCents)).toEqual([2999, 8999]);
  });

  test('filters by price range (in dollars)', async () => {
    const res = await request(ctx.app).get('/api/products?minPrice=30&maxPrice=50');
    expect(res.body.data.map((p) => p.slug)).toEqual(['clean-code']);
  });

  test('paginates results', async () => {
    const res = await request(ctx.app).get('/api/products?limit=2&page=2');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pages).toBe(2);
  });

  test('rejects an invalid sort option', async () => {
    const res = await request(ctx.app).get('/api/products?sort=random');
    expect(res.status).toBe(400);
  });

  test('returns a product page by slug with reviews and related items', async () => {
    const res = await request(ctx.app).get('/api/products/wireless-headphones');
    expect(res.status).toBe(200);
    expect(res.body.product.category).toBe('Electronics');
    expect(res.body.related.map((p) => p.slug)).toEqual(['gaming-mouse']);
    expect(res.body.reviews).toEqual([]);
  });

  test('returns 404 for an unknown product', async () => {
    expect((await request(ctx.app).get('/api/products/nope')).status).toBe(404);
  });
});
