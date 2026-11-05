import { createContext, useContext, useEffect, useState } from 'react';
import { api, session } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => session.get()?.user || null);

  useEffect(() => {
    // confirm the saved session is still valid
    if (session.get()) {
      api('/auth/me')
        .then((d) => setUser(d.user))
        .catch(() => {
          session.clear();
          setUser(null);
        });
    }
  }, []);

  const start = (data) => {
    session.set(data);
    setUser(data.user);
    return data.user;
  };

  const value = {
    user,
    isAdmin: user?.role === 'admin',
    login: async (email, password) => start(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (form) => start(await api('/auth/register', { method: 'POST', body: form })),
    logout: async () => {
      const s = session.get();
      if (s?.refreshToken) await api('/auth/logout', { method: 'POST', body: { refreshToken: s.refreshToken } }).catch(() => {});
      session.clear();
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
