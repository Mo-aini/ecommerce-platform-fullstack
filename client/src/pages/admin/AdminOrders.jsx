import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, money } from '../../api.js';
import { StatusPill, payLabel } from '../Orders.jsx';

const NEXT = { pending: ['paid', 'shipped', 'cancelled'], paid: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const load = () => api(`/admin/orders${status ? `?status=${status}` : ''}`).then((d) => setOrders(d.data));
  useEffect(() => {
    load();
  }, [status]);

  const change = async (id, next) => {
    try {
      await api(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status: next } });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="card">
      <div className="toolbar">
        <h2>Orders</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.keys(NEXT).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>City</th><th>Payment</th><th>Total</th><th>Status</th><th>Update</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><Link to={`/orders/${o.id}`}>#{String(o.id).padStart(5, '0')}</Link></td>
              <td>{formatDate(o.createdAt)}</td>
              <td>{o.customer}</td>
              <td>{o.city}</td>
              <td>{payLabel(o.paymentMethod)} <span className="muted small">({o.paymentStatus})</span></td>
              <td>{money(o.totalCents)}</td>
              <td><StatusPill status={o.status} /></td>
              <td>
                {NEXT[o.status].length > 0 ? (
                  <select value="" onChange={(e) => change(o.id, e.target.value)} aria-label="Change status">
                    <option value="">Move to…</option>
                    {NEXT[o.status].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className="muted small">final</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
