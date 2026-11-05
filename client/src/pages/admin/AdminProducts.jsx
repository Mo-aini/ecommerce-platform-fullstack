import { useEffect, useState } from 'react';
import { api, money } from '../../api.js';

const empty = { name: '', description: '', price: '', stock: '', categoryId: '', imageUrl: '', isActive: true };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id} = edit
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = () => api('/admin/products').then((d) => setProducts(d.data));
  useEffect(() => {
    load();
    api('/categories').then((d) => setCategories(d.data));
  }, []);

  const open = (p) => {
    setError('');
    setEditing(p || {});
    setForm(p ? { name: p.name, description: p.description, price: p.priceCents / 100, stock: p.stock, categoryId: p.categoryId, imageUrl: p.imageUrl || '', isActive: Boolean(p.isActive) } : { ...empty, categoryId: categories[0]?.id || '' });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing.id) await api(`/admin/products/${editing.id}`, { method: 'PUT', body: form });
      else await api('/admin/products', { method: 'POST', body: form });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.details ? err.details.map((d) => `${d.field}: ${d.message}`).join(', ') : err.message);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.name}”?`)) return;
    await api(`/admin/products/${p.id}`, { method: 'DELETE' });
    load();
  };

  const shown = products.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <section className="card">
      <div className="toolbar">
        <h2>Products ({products.length})</h2>
        <div className="row">
          <input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn" onClick={() => open(null)}>+ New product</button>
        </div>
      </div>
      <table className="table">
        <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id}>
              <td className="with-thumb"><img src={p.imageUrl} alt="" /> {p.name}</td>
              <td>{p.category}</td>
              <td>{money(p.priceCents)}</td>
              <td>{p.stock}</td>
              <td>{p.isActive ? <span className="pill pill-delivered">active</span> : <span className="pill pill-cancelled">hidden</span>}</td>
              <td className="right">
                <button className="link-btn" onClick={() => open(p)}>Edit</button>{' '}
                <button className="link-btn danger" onClick={() => remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="modal card" onSubmit={save} onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? 'Edit product' : 'New product'}</h3>
            <div className="form-grid">
              <label className="field span-2">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field">Price ($)<input type="number" step="0.01" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
              <label className="field">Stock<input type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>
              <label className="field">Category
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="field">Image URL<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="/images/products/…" /></label>
              <label className="field span-2">Description<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Visible in the shop</label>
            </div>
            {error && <p className="error">{error}</p>}
            <div className="row end">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn">Save</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
