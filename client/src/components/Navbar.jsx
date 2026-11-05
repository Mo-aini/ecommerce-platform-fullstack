import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { count } = useCart();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const navigate = useNavigate();

  const search = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <span className="brand-dot" /> ShopSphere
        </Link>
        <form className="search" onSubmit={search} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" aria-label="Search products" />
          <button type="submit">Search</button>
        </form>
        <nav className="nav-links">
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
          {user ? (
            <>
              <NavLink to="/orders">My orders</NavLink>
              <span className="hello">Hi, {user.name.split(' ')[0]}</span>
              <button
                className="link-btn"
                onClick={() => {
                  // leave protected pages first so RequireAuth does not redirect to /login
                  navigate('/');
                  logout();
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register" className="btn btn-sm">Sign up</NavLink>
            </>
          )}
          <NavLink to="/cart" className="cart-link" aria-label="Cart">
            🛒 <span className="badge">{count}</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
