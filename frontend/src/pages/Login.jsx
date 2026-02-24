import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api';

function Login() {
  const [email, setEmail] = useState('admin@auction.pl');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiLogin(email, password);
      login(res.data.user, res.data.accessToken, res.data.refreshToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Błąd logowania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>🏭 Platforma Zakupowa</h1>
          <p>System aukcji surowców przemysłowych</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <h2>Logowanie</h2>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Hasło</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <div className="login-footer">
          <p>Demo: admin@auction.pl / admin123</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
