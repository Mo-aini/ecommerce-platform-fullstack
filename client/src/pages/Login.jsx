import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(form.email, form.password);
      navigate(state?.from || (user.role === 'admin' ? '/admin' : '/'));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card auth-card" onSubmit={submit}>
      <h2>Welcome back</h2>
      <label className="field">Email
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <label className="field">Password
        <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-block">Log in</button>
      <p className="muted small">Demo: ayesha@shop.test / Customer1 · admin@shop.test / Admin1234</p>
      <p>New here? <Link to="/register" state={state}>Create an account</Link></p>
    </form>
  );
}
