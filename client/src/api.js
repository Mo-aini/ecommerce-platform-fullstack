const BASE = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'shop.session';

export const session = {
  get: () => JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'),
  set: (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s)),
  clear: () => localStorage.removeItem(STORAGE_KEY),
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let refreshing = null;
async function refreshSession() {
  const s = session.get();
  if (!s?.refreshToken) return null;
  // share one refresh request between parallel calls (refresh tokens are single use)
  refreshing ??= fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) {
        session.clear();
        return null;
      }
      const data = await res.json();
      session.set(data);
      return data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** fetch wrapper: JSON in/out, Bearer token, one automatic refresh on 401. */
export async function api(path, { method = 'GET', body, retry = true } = {}) {
  const s = session.get();
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(s?.accessToken && { Authorization: `Bearer ${s.accessToken}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && s?.refreshToken) {
    const renewed = await refreshSession();
    if (renewed) return api(path, { method, body, retry: false });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error?.message || 'Request failed', data.error?.details);
  return data;
}

export const money = (cents) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

export const formatDate = (iso) =>
  new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
