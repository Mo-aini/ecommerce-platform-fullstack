import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    api('/categories').then((d) => setCategories(d.data));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams({ sort, page, limit: 12 });
    if (q) qs.set('q', q);
    if (category) qs.set('category', category);
    api(`/products?${qs}`)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, [q, category, sort, page]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const current = categories.find((c) => c.slug === category);

  return (
    <div className="shop">
      {!q && !category && (
        <section className="hero">
          <div>
            <h1>Everything you need, delivered.</h1>
            <p>Electronics, books, home essentials and more. Pay cash on delivery or with a test card.</p>
          </div>
        </section>
      )}
      <div className="shop-layout">
        <aside className="sidebar card">
          <h3>Categories</h3>
          <button className={`cat ${!category ? 'active' : ''}`} onClick={() => update({ category: '' })}>
            All products <span>{categories.reduce((s, c) => s + c.productCount, 0)}</span>
          </button>
          {categories.map((c) => (
            <button key={c.id} className={`cat ${category === c.slug ? 'active' : ''}`} onClick={() => update({ category: c.slug })}>
              {c.name} <span>{c.productCount}</span>
            </button>
          ))}
        </aside>
        <section>
          <div className="toolbar">
            <div>
              <h2>{q ? `Results for “${q}”` : current ? current.name : 'All products'}</h2>
              {result && <span className="muted">{result.total} products</span>}
            </div>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="rating">Top rated</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          {result && result.data.length === 0 && <p className="empty card">No products match your search.</p>}
          <div className="grid">
            {result?.data.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {result && result.pages > 1 && (
            <div className="pagination">
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={n === page ? 'active' : ''} onClick={() => update({ page: String(n) })}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
