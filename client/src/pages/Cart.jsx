import { Link, useNavigate } from 'react-router-dom';
import { money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Cart() {
  const { items, subtotalCents, setQuantity } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const shipping = subtotalCents === 0 || subtotalCents >= 10000 ? 0 : 500;
  const tax = Math.round(subtotalCents * 0.05);

  if (items.length === 0) {
    return (
      <div className="card empty">
        <h2>Your cart is empty</h2>
        <Link to="/" className="btn">Continue shopping</Link>
      </div>
    );
  }

  return (
    <div className="two-col">
      <section className="card">
        <h2>Shopping cart</h2>
        {items.map((i) => (
          <div className="cart-row" key={i.productId}>
            <img src={i.imageUrl} alt="" />
            <div className="grow">
              <Link to={`/product/${i.slug}`}><strong>{i.name}</strong></Link>
              <div className="muted small">{money(i.priceCents)} each · {i.stock} in stock</div>
            </div>
            <div className="qty">
              <button onClick={() => setQuantity(i, i.quantity - 1)} aria-label="Decrease">−</button>
              <span>{i.quantity}</span>
              <button onClick={() => setQuantity(i, i.quantity + 1)} aria-label="Increase">+</button>
            </div>
            <strong className="line-total">{money(i.priceCents * i.quantity)}</strong>
            <button className="link-btn danger" onClick={() => setQuantity(i, 0)}>Remove</button>
          </div>
        ))}
      </section>
      <aside className="card summary">
        <h3>Order summary</h3>
        <div className="sum-row"><span>Subtotal</span><span>{money(subtotalCents)}</span></div>
        <div className="sum-row"><span>Shipping</span><span>{shipping ? money(shipping) : 'Free'}</span></div>
        <div className="sum-row"><span>Tax (5%)</span><span>{money(tax)}</span></div>
        <div className="sum-row total"><span>Total</span><span>{money(subtotalCents + shipping + tax)}</span></div>
        <button className="btn btn-block" onClick={() => navigate(user ? '/checkout' : '/login', { state: { from: '/checkout' } })}>
          {user ? 'Proceed to checkout' : 'Log in to check out'}
        </button>
        {!user && <p className="muted small">Your cart is saved in this browser and will be added to your account when you log in.</p>}
      </aside>
    </div>
  );
}
