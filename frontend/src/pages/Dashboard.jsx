import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats } from '../api';

function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    categoriesCount: 0,
    materialsCount: 0,
    suppliersCount: 0,
    auctionsActive: 0,
    auctionsCompleted: 0,
    auctionsPending: 0,
    totalAuctionValue: 0,
    recentAuctions: [],
    topSuppliers: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Jeden endpoint zamiast 5 osobnych zapytań
        const res = await getDashboardStats();
        setStats(res.data);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="loading">Ładowanie...</div>;
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Witaj, {user?.name}!</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <h3>{stats.categoriesCount}</h3>
            <p>Kategorii surowców</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <div className="stat-info">
            <h3>{stats.suppliersCount}</h3>
            <p>Dostawców</p>
          </div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-icon">🔴</div>
          <div className="stat-info">
            <h3>{stats.auctionsActive}</h3>
            <p>Aktywnych aukcji</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.auctionsCompleted}</h3>
            <p>Zakończonych aukcji</p>
          </div>
        </div>
      </div>

      {isAdmin && stats.totalAuctionValue > 0 && (
        <div className="total-value-card">
          <h3>Łączna wartość zakończonych aukcji</h3>
          <p className="value">{stats.totalAuctionValue.toLocaleString('pl-PL')} PLN</p>
        </div>
      )}

      {isAdmin && (
        <div className="quick-actions">
          <h2>Szybkie akcje</h2>
          <div className="actions-grid">
            <Link to="/auctions/new" className="action-card">
              <span className="action-icon">➕</span>
              <span>Utwórz aukcję</span>
            </Link>
            <Link to="/materials" className="action-card">
              <span className="action-icon">📦</span>
              <span>Przeglądaj surowce</span>
            </Link>
            <Link to="/suppliers" className="action-card">
              <span className="action-icon">🏢</span>
              <span>Zarządzaj dostawcami</span>
            </Link>
          </div>
        </div>
      )}

      <div className="dashboard-columns">
        <div className="recent-auctions">
          <h2>Ostatnie aukcje</h2>
          {stats.recentAuctions.length === 0 ? (
            <p className="no-data">Brak aukcji</p>
          ) : (
            <div className="auctions-list">
              {stats.recentAuctions.map(auction => (
                <Link key={auction.id} to={`/auctions/${auction.id}`} className="auction-item">
                  <div className="auction-info">
                    <h4>{auction.title}</h4>
                    <p>{auction.material_name}</p>
                  </div>
                  <div className={`auction-status status-${auction.status}`}>
                    {auction.status === 'pending' && 'Oczekuje'}
                    {auction.status === 'active' && 'Aktywna'}
                    {auction.status === 'completed' && 'Zakończona'}
                    {auction.status === 'cancelled' && 'Anulowana'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {isAdmin && stats.topSuppliers && stats.topSuppliers.length > 0 && (
          <div className="top-suppliers">
            <h2>Najlepsi dostawcy</h2>
            <div className="suppliers-list">
              {stats.topSuppliers.map((supplier, index) => (
                <div key={supplier.id} className="supplier-rank-item">
                  <span className="rank">#{index + 1}</span>
                  <div className="supplier-info">
                    <strong>{supplier.company_name}</strong>
                    <small>{supplier.city}</small>
                  </div>
                  <span className="wins">{supplier.wins} wygranych</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
