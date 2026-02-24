import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAuctions } from '../api';
import { useAuth } from '../context/AuthContext';

function Auctions() {
  const { isAdmin } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const loadAuctions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await getAuctions({ status: filter || undefined, page, limit: pagination.limit });
      setAuctions(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Error loading auctions:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, pagination.limit]);

  useEffect(() => {
    loadAuctions(1);
  }, [filter]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadAuctions(newPage);
    }
  }, [loadAuctions, pagination.totalPages]);

  const getStatusLabel = (status) => {
    const labels = {
      pending: '⏳ Oczekuje',
      active: '🔴 Aktywna',
      completed: '✅ Zakończona',
      cancelled: '❌ Anulowana'
    };
    return labels[status] || status;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pl-PL');
  };

  if (loading) {
    return <div className="loading">Ładowanie...</div>;
  }

  return (
    <div className="auctions-page">
      <div className="page-header">
        <div>
          <h1>🔨 Aukcje</h1>
          <p>Przeglądaj i zarządzaj aukcjami zakupowymi</p>
        </div>
        {isAdmin && (
          <Link to="/auctions/new" className="btn-primary">
            ➕ Nowa aukcja
          </Link>
        )}
      </div>

      <div className="filters-bar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Wszystkie</option>
          <option value="pending">Oczekujące</option>
          <option value="active">Aktywne</option>
          <option value="completed">Zakończone</option>
          <option value="cancelled">Anulowane</option>
        </select>
      </div>

      {auctions.length === 0 ? (
        <div className="no-data">
          <p>Brak aukcji</p>
          {isAdmin && (
            <Link to="/auctions/new" className="btn-primary">
              Utwórz pierwszą aukcję
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="auctions-table">
            <table>
              <thead>
                <tr>
                  <th>Tytuł</th>
                  <th>Materiał</th>
                  <th>Ilość</th>
                  <th>Status</th>
                  <th>Oferty</th>
                  <th>Najniższa cena</th>
                  <th>Czas</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {auctions.map(auction => (
                  <tr key={auction.id} className={`status-row-${auction.status}`}>
                    <td><strong>{auction.title}</strong></td>
                    <td>
                      <span className="material-badge">
                        {auction.category_icon} {auction.material_name}
                      </span>
                    </td>
                    <td>{auction.quantity} {auction.unit || auction.material_unit}</td>
                    <td>
                      <span className={`status-badge status-${auction.status}`}>
                        {getStatusLabel(auction.status)}
                      </span>
                    </td>
                    <td>{auction.bids_count || 0}</td>
                    <td>
                      {auction.lowest_bid
                        ? `${auction.lowest_bid.toLocaleString('pl-PL')} PLN`
                        : '-'}
                    </td>
                    <td>
                      {auction.status === 'active' && auction.remaining_seconds > 0
                        ? `${Math.floor(auction.remaining_seconds / 60)}:${String(auction.remaining_seconds % 60).padStart(2, '0')}`
                        : formatDate(auction.end_time)}
                    </td>
                    <td>
                      <Link to={`/auctions/${auction.id}`} className="btn-small">
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn-page"
                onClick={() => handlePageChange(1)}
                disabled={pagination.page === 1}
              >
                «
              </button>
              <button
                className="btn-page"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                ‹
              </button>
              <span className="page-info">
                Strona {pagination.page} z {pagination.totalPages} ({pagination.total} wyników)
              </span>
              <button
                className="btn-page"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                ›
              </button>
              <button
                className="btn-page"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.page === pagination.totalPages}
              >
                »
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Auctions;
