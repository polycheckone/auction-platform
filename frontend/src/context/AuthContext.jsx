import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, logout as apiLogout } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      getMe()
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
          // Czyszczenie tokenów już obsługuje interceptor w api.js
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (userData, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');

    try {
      // Wywołaj endpoint logout aby unieważnić refresh token
      if (refreshToken) {
        await apiLogout(refreshToken);
      }
    } catch (error) {
      // Ignoruj błędy - i tak czyścimy lokalnie
      console.error('Logout error:', error);
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isSupplier = user?.role === 'supplier';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isSupplier }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
