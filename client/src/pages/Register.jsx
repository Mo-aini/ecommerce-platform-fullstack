import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    try {
      await register(form);
      navigate(state?.from || '/');
    } catch (err) {
      setError(err.details ? '' : err.message);
      if (err.details) setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
    }
  };

  const input = (name, label, type = 'text') => (
    <label className="field">{label}
      <input type={type} required value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      {errors[name] && <small className="error">{errors[name]}</small>}
    </label>
  );

  return (
    <form className="card auth-card" onSubmit={submit}>
      <h2>Create your account</h2>
      {input('name', 'Full name')}
      {input('email', 'Email', 'email')}
      {input('password', 'Password (8+ characters, a letter and a number)', 'password')}
      {error && <p className="error">{error}</p>}
      <button className="btn btn-block">Sign up</button>
      <p>Already have an account? <Link to="/login" state={state}>Log in</Link></p>
    </form>
  );
}
