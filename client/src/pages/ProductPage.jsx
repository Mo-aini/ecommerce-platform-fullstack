import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Stars from '../components/Stars.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function ProductPage() {
  const { slug } = useParams();
  const { add } = useCart();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [reviewMsg, setReviewMsg] = useState('');

  const load = () => api(`/products/${slug}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    setQty(1);
    load();
  }, [slug]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const { product, reviews, related } = data;

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api(`/products/${product.id}/reviews`, { method: 'POST', body: review });
      setReviewMsg('Thanks for your review!');
      load();
    } catch (err) {
      setReviewMsg(err.message);
    }
  };

  return (
    <div>
      <nav className="crumbs">
        <Link to="/">Shop</Link> / <Link to={`/?category=${product.categorySlug}`}>{product.category}</Link> / {product.name}
      </nav>
      <section className="product-detail card">
        <img src={product.imageUrl} alt={product.name} />
        <div>
          <h1>{product.name}</h1>
          <Stars value={product.rating} count={product.reviewCount} />
          <p className="big-price">{money(product.priceCents)}</p>
          <p>{product.description}</p>
          <p className={product.stock > 5 ? 'ok' : 'warn'}>
            {product.stock === 0 ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left in stock` : 'In stock'}
          </p>
          <div className="buy-row">
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock, qty + 1))} aria-label="Increase">+</button>
            </div>
            <button className="btn" disabled={product.stock === 0} onClick={() => add(product, qty)}>
              Add to cart
            </button>
          </div>
          <ul className="perks">
            <li>Free shipping on orders over $100</li>
            <li>Cash on delivery available</li>
          </ul>
        </div>
      </section>

      <section className="card reviews">
        <h2>Customer reviews</h2>
        {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="review">
            <Stars value={r.rating} /> <strong>{r.author}</strong> <span className="muted small">{formatDate(r.createdAt)}</span>
            {r.comment && <p>{r.comment}</p>}
          </div>
        ))}
        {user && (
          <form className="review-form" onSubmit={submitReview}>
            <select value={review.rating} onChange={(e) => setReview({ ...review, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
            </select>
            <input placeholder="Share your experience (only for products you ordered)" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} />
            <button className="btn btn-sm">Post review</button>
            {reviewMsg && <span className="muted small">{reviewMsg}</span>}
          </form>
        )}
      </section>

      {related.length > 0 && (
        <section>
          <h2>You may also like</h2>
          <div className="grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
