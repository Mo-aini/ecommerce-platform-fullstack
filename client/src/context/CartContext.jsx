import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

/**
 * Guests: cart lives in localStorage.
 * Signed-in customers: cart lives in the database (/api/cart), and the guest
 * cart is merged into it right after login.
 */
const CartContext = createContext(null);
const LOCAL_KEY = 'shop.guestCart';
const readLocal = () => JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
const summarize = (items) => ({
  items,
  count: items.reduce((s, i) => s + i.quantity, 0),
  subtotalCents: items.reduce((s, i) => s + i.quantity * i.priceCents, 0),
});

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(() => summarize(readLocal()));
  const [toast, setToast] = useState(null);

  const saveLocal = (items) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
    setCart(summarize(items));
  };

  const reload = useCallback(async () => {
    if (!user) return setCart(summarize(readLocal()));
    const guest = readLocal();
    if (guest.length) {
      await api('/cart/merge', { method: 'POST', body: { items: guest.map(({ productId, quantity }) => ({ productId, quantity })) } });
      localStorage.removeItem(LOCAL_KEY);
    }
    return setCart(await api('/cart'));
  }, [user]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  async function setQuantity(product, quantity) {
    const qty = Math.max(0, Math.min(quantity, product.stock));
    if (user) {
      setCart(await api(`/cart/items/${product.productId ?? product.id}`, { method: 'PUT', body: { quantity: qty } }));
      return;
    }
    const id = product.productId ?? product.id;
    const items = readLocal().filter((i) => i.productId !== id);
    if (qty > 0) {
      items.push({ productId: id, quantity: qty, name: product.name, slug: product.slug, priceCents: product.priceCents, stock: product.stock, imageUrl: product.imageUrl });
    }
    saveLocal(items);
  }

  async function add(product, quantity = 1) {
    const current = cart.items.find((i) => i.productId === product.id)?.quantity || 0;
    await setQuantity(product, current + quantity);
    notify(`Added “${product.name}” to your cart`);
  }

  const clearLocal = () => saveLocal([]);

  return (
    <CartContext.Provider value={{ ...cart, add, setQuantity, reload, clearLocal }}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
