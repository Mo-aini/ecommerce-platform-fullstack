import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, money } from '../api.js';

export const StatusPill = ({ status }) => <span className={`pill pill-${status}`}>{status}</span>;
export const payLabel = (m) => (m === 'cod' ? 'Cash on delivery' : 'Card (simulated)');

export default function Orders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    api('/orders').then((d) => setOrders(d.data));
  }, []);

  if (!orders) return <p className="muted">Loading…</p>;
  return (
    <section className="card">
      <h2>My orders</h2>
      {orders.length === 0 && <p className="muted">You have not placed any orders yet.</p>}
      {orders.length > 0 && (
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Date</th><th>Items</th><th>Payment</th><th>Status</th><th className="right">Total</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/orders/${o.id}`}>#{String(o.id).padStart(5, '0')}</Link></td>
                <td>{formatDate(o.createdAt)}</td>
                <td>{o.itemCount}</td>
                <td>{payLabel(o.paymentMethod)} <span className="muted small">({o.paymentStatus})</span></td>
                <td><StatusPill status={o.status} /></td>
                <td className="right">{money(o.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
