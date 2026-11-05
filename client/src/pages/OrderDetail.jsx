import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';
import { StatusPill, payLabel } from './Orders.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/orders/${id}`).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!order) return <p className="muted">Loading…</p>;

  return (
    <div>
      {state?.justPlaced && (
        <div className="success-banner">
          <h2>✓ Thank you! Your order has been placed.</h2>
          <p>
            {order.payment.method === 'cod'
              ? `Please keep ${money(order.totalCents)} ready for the courier.`
              : `Simulated card payment approved (ref ${order.payment.reference}).`}
          </p>
        </div>
      )}
      <section className="card">
        <div className="toolbar">
          <h2>Order #{String(order.id).padStart(5, '0')}</h2>
          <StatusPill status={order.status} />
        </div>
        <p className="muted">Placed on {formatDate(order.createdAt)}</p>
        <div className="two-col tight">
          <div>
            <h4>Shipping to</h4>
            <p>{order.shipName}<br />{order.shipAddress}<br />{order.shipCity}<br />{order.shipPhone}</p>
          </div>
          <div>
            <h4>Payment</h4>
            <p>
              {payLabel(order.payment.method)}
              {order.payment.cardLast4 && <> · card ending {order.payment.cardLast4}</>}
              <br />Status: {order.payment.status}
            </p>
          </div>
        </div>
        <table className="table">
          <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th className="right">Total</th></tr></thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.productId}>
                <td className="with-thumb">{i.imageUrl && <img src={i.imageUrl} alt="" />} {i.slug ? <Link to={`/product/${i.slug}`}>{i.name}</Link> : i.name}</td>
                <td>{money(i.unitPriceCents)}</td>
                <td>{i.quantity}</td>
                <td className="right">{money(i.unitPriceCents * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan="3">Subtotal</td><td className="right">{money(order.subtotalCents)}</td></tr>
            <tr><td colSpan="3">Shipping</td><td className="right">{order.shippingCents ? money(order.shippingCents) : 'Free'}</td></tr>
            <tr><td colSpan="3">Tax</td><td className="right">{money(order.taxCents)}</td></tr>
            <tr className="total"><td colSpan="3">Total</td><td className="right">{money(order.totalCents)}</td></tr>
          </tfoot>
        </table>
        <Link to="/orders">← Back to my orders</Link>
      </section>
    </div>
  );
}
