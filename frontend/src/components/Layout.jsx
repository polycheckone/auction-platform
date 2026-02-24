import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>🏭 Platforma Zakupowa</h2>
          <p className="user-info">{user?.name}</p>
          <span className="user-role">{isAdmin ? 'Administrator' : 'Dostawca'}</span>
        </div>

        <ul className="nav-menu">
          {isAdmin && (
            <>
              <li>
                <NavLink to="/" end>
                  📊 Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/materials">📦 Surowce</NavLink>
              </li>
              <li>
                <NavLink to="/suppliers">🏢 Dostawcy</NavLink>
              </li>
            </>
          )}
          <li>
            <NavLink to="/auctions">🔨 Aukcje</NavLink>
          </li>
        </ul>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-logout">
            Wyloguj się
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
