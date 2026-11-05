import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import Stars from './Stars.jsx';

export default function ProductCard({ product }) {
  const { add } = useCart();
  return (
    <article className="card product-card">
      <Link to={`/product/${product.slug}`} className="product-img">
        <img src={product.imageUrl} alt={product.name} loading="lazy" />
        {product.stock <= 5 && product.stock > 0 && <span className="tag tag-warn">Only {product.stock} left</span>}
        {product.stock === 0 && <span className="tag tag-off">Sold out</span>}
      </Link>
      <div className="product-body">
        <span className="muted small">{product.category}</span>
        <Link to={`/product/${product.slug}`} className="product-name">{product.name}</Link>
        <Stars value={product.rating} count={product.reviewCount} />
        <div className="product-foot">
          <strong className="price">{money(product.priceCents)}</strong>
          <button className="btn btn-sm" disabled={product.stock === 0} onClick={() => add(product)}>
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
}
