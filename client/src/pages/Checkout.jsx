import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, money } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Checkout() {
  const { user } = useAuth();
  const { items, subtotalCents, reload } = useCart();
  const navigate = useNavigate();
  const [shipping, setShipping] = useState({ name: user.name, phone: '', address: '', city: '' });
  const [method, setMethod] = useState('cod');
  const [card, setCard] = useState({ cardNumber: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (items.length === 0 && !busy) return <Navigate to="/cart" replace />;

  const ship = subtotalCents >= 10000 ? 0 : 500;
  const tax = Math.round(subtotalCents * 0.05);
  const field = (name, label, props = {}) => (
    <label className="field">
      {label}
      <input value={shipping[name]} onChange={(e) => setShipping({ ...shipping, [name]: e.target.value })} {...props} />
      {errors[`shipping.${name}`] && <small className="error">{errors[`shipping.${name}`]}</small>}
    </label>
  );

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage('');
    try {
      const payment = method === 'cod' ? { method } : { method, ...card };
      const { order } = await api('/orders', { method: 'POST', body: { shipping, payment } });
      await reload();
      navigate(`/orders/${order.id}`, { state: { justPlaced: true } });
    } catch (err) {
      setBusy(false);
      setMessage(err.message);
      if (err.details) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
    }
  };

  return (
    <form className="two-col" onSubmit={submit}>
      <section className="card">
        <h2>Shipping details</h2>
        <div className="form-grid">
          {field('name', 'Full name', { required: true })}
          {field('phone', 'Phone', { required: true, placeholder: '+92 300 1234567' })}
          {field('address', 'Address', { required: true, placeholder: 'House, street, area' })}
          {field('city', 'City', { required: true })}
        </div>

        <h2>Payment</h2>
        <p className="notice">This is a demo store: no real payment is taken.</p>
        <label className={`pay-option ${method === 'cod' ? 'selected' : ''}`}>
          <input type="radio" checked={method === 'cod'} onChange={() => setMethod('cod')} />
          <div><strong>Cash on delivery</strong><div className="muted small">Pay the courier when your order arrives</div></div>
        </label>
        <label className={`pay-option ${method === 'card_simulated' ? 'selected' : ''}`}>
          <input type="radio" checked={method === 'card_simulated'} onChange={() => setMethod('card_simulated')} />
          <div><strong>Card (simulated)</strong><div className="muted small">Test card 4242 4242 4242 4242 · 4000 0000 0000 0002 is always declined</div></div>
        </label>
        {method === 'card_simulated' && (
          <div className="form-grid">
            <label className="field span-2">Card number
              <input value={card.cardNumber} onChange={(e) => setCard({ ...card, cardNumber: e.target.value })} inputMode="numeric" />
            </label>
            <label className="field">Expiry (MM/YY)
              <input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} />
            </label>
            <label className="field">CVC
              <input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} />
            </label>
          </div>
        )}
        {message && <p className="error">{message}</p>}
      </section>

      <aside className="card summary">
        <h3>Your order</h3>
        {items.map((i) => (
          <div className="sum-row" key={i.productId}>
            <span>{i.quantity} × {i.name}</span>
            <span>{money(i.priceCents * i.quantity)}</span>
          </div>
        ))}
        <hr />
        <div className="sum-row"><span>Subtotal</span><span>{money(subtotalCents)}</span></div>
        <div className="sum-row"><span>Shipping</span><span>{ship ? money(ship) : 'Free'}</span></div>
        <div className="sum-row"><span>Tax (5%)</span><span>{money(tax)}</span></div>
        <div className="sum-row total"><span>Total</span><span>{money(subtotalCents + ship + tax)}</span></div>
        <button className="btn btn-block" disabled={busy}>{busy ? 'Placing order…' : 'Place order'}</button>
      </aside>
    </form>
  );
}
