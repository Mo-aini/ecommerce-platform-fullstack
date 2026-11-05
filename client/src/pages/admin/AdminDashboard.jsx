import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../../api.js';

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api('/admin/stats').then(setS);
  }, []);
  if (!s) return <p className="muted">Loading…</p>;

  const cards = [
    ['Revenue', money(s.revenueCents)],
    ['Orders', s.orders],
    ['Pending orders', s.pendingOrders],
    ['Customers', s.customers],
  ];
  return (
    <div>
      <div className="stats">
        {cards.map(([label, value]) => (
          <div key={label} className="card stat">
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="two-col even">
        <section className="card">
          <h3>Top selling products</h3>
          <table className="table">
            <thead><tr><th>Product</th><th>Sold</th><th className="right">Revenue</th></tr></thead>
            <tbody>
              {s.topProducts.map((p) => (
                <tr key={p.name}><td>{p.name}</td><td>{p.sold}</td><td className="right">{money(p.revenueCents)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h3>Low stock (≤ 5)</h3>
          <table className="table">
            <thead><tr><th>Product</th><th className="right">Stock</th></tr></thead>
            <tbody>
              {s.lowStock.map((p) => (
                <tr key={p.id}><td>{p.name}</td><td className="right"><span className="pill pill-pending">{p.stock}</span></td></tr>
              ))}
            </tbody>
          </table>
          <Link to="/admin/products">Manage products →</Link>
        </section>
      </div>
    </div>
  );
}
