import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getAuction, startAuction, placeBid, cancelAuction, publishAuctionResults, deleteAuction, inviteToAuction, removeFromAuction, getSuppliers, SOCKET_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

function AuctionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isSupplier } = useAuth();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeExtendedNotice, setTimeExtendedNotice] = useState(false);
  const socketRef = useRef(null);

  // Zarządzanie dostawcami
  const [addSupplierModal, setAddSupplierModal] = useState(false);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [selectedNewSuppliers, setSelectedNewSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const debouncedSupplierSearch = useDebounce(supplierSearch, 200);

  // Draggable modal
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const modalRef = useRef(null);

  useEffect(() => {
    const loadAuction = async () => {
      try {
        const res = await getAuction(id);
        setAuction(res.data);
        if (res.data.remaining_seconds) {
          setTimeLeft(res.data.remaining_seconds);
        }
      } catch (err) {
        console.error('Error loading auction:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAuction();

    // Socket.io connection
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('join_auction', id);

    socketRef.current.on('new_bid', (data) => {
      if (data.auctionId === id) {
        // Obsługa przedłużenia czasu
        if (data.time_extended && data.new_end_time) {
          const newEndTime = new Date(data.new_end_time);
          const remaining = Math.max(0, Math.floor((newEndTime - new Date()) / 1000));
          setTimeLeft(remaining);

          // Pokaż powiadomienie o przedłużeniu
          setTimeExtendedNotice(true);
          setTimeout(() => setTimeExtendedNotice(false), 3000);
        }

        // Inkrementalna aktualizacja - bez pełnego przeładowania
        setAuction(prev => {
          if (!prev) return prev;

          // Aktualizuj podstawowe dane
          const updated = {
            ...prev,
            lowest_bid: data.lowest_bid,
            bids_count: data.bids_count
          };

          // Dodaj nową ofertę do listy (jeśli admin widzi oferty)
          if (data.bid && prev.bids) {
            updated.bids = [data.bid, ...prev.bids].sort((a, b) => a.amount - b.amount);
          }

          return updated;
        });
      }
    });

    socketRef.current.on('auction_started', (data) => {
      if (data.auctionId === id) {
        loadAuction();
      }
    });

    socketRef.current.on('auction_ended', (data) => {
      if (data.auctionId === id) {
        loadAuction();
      }
    });

    socketRef.current.on('auction_cancelled', (data) => {
      if (data.auctionId === id) {
        loadAuction();
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_auction', id);
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  // Timer
  useEffect(() => {
    if (auction?.status !== 'active' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [auction?.status, timeLeft]);

  const handleStart = async () => {
    try {
      await startAuction(id);
      const res = await getAuction(id);
      setAuction(res.data);
      setTimeLeft(res.data.remaining_seconds);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd uruchamiania aukcji');
    }
  };

  const handleBid = async () => {
    try {
      await placeBid(id, parseFloat(bidAmount));
      setBidAmount('');
      const res = await getAuction(id);
      setAuction(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd składania oferty');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Czy na pewno chcesz anulować aukcję?')) return;
    try {
      await cancelAuction(id);
      const res = await getAuction(id);
      setAuction(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd anulowania aukcji');
    }
  };

  const handlePublishResults = async () => {
    if (!confirm('Czy na pewno chcesz opublikować wyniki aukcji? Zwycięzca zostanie poinformowany.')) return;
    try {
      await publishAuctionResults(id);
      const res = await getAuction(id);
      setAuction(res.data);
      alert('Wyniki aukcji zostały opublikowane');
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd publikowania wyników');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć tę aukcję? Ta operacja jest nieodwracalna.')) return;
    try {
      await deleteAuction(id);
      alert('Aukcja została usunięta');
      navigate('/auctions');
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd usuwania aukcji');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Otwórz modal dodawania dostawców
  const handleOpenAddSuppliers = async () => {
    setSuppliersLoading(true);
    setAddSupplierModal(true);
    try {
      const res = await getSuppliers({ limit: 100 });
      const allSuppliers = res.data.data || [];
      // Filtruj dostawców którzy już są zaproszeni
      const invitedIds = auction.invitations?.map(inv => inv.supplier_id) || [];
      const available = allSuppliers.filter(s => !invitedIds.includes(s.id));
      setAvailableSuppliers(available);
      setSelectedNewSuppliers([]);
    } catch (err) {
      console.error('Error loading suppliers:', err);
      alert('Błąd ładowania dostawców');
    } finally {
      setSuppliersLoading(false);
    }
  };

  // Dodaj wybranych dostawców do aukcji
  const handleAddSuppliers = async () => {
    if (selectedNewSuppliers.length === 0) return;
    try {
      await inviteToAuction(id, { supplier_ids: selectedNewSuppliers });
      setAddSupplierModal(false);
      // Odśwież aukcję
      const res = await getAuction(id);
      setAuction(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd dodawania dostawców');
    }
  };

  // Usuń dostawcę z aukcji
  const handleRemoveSupplier = async (supplierId, companyName) => {
    if (!confirm(`Czy na pewno chcesz usunąć "${companyName}" z aukcji?`)) return;
    try {
      await removeFromAuction(id, supplierId);
      // Odśwież aukcję
      const res = await getAuction(id);
      setAuction(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd usuwania dostawcy');
    }
  };

  // Toggle wyboru dostawcy w modalu
  const toggleSupplierSelection = (supplierId) => {
    setSelectedNewSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  // Filtrowanie dostawców po nazwie lub NIP (z debounce)
  const filteredSuppliers = useMemo(() => {
    if (!debouncedSupplierSearch.trim()) return availableSuppliers;

    const searchTerm = debouncedSupplierSearch.toLowerCase().trim();
    // Usuń kreski z wyszukiwanego NIP
    const searchNip = searchTerm.replace(/[^0-9]/g, '');

    return availableSuppliers.filter(supplier => {
      const nameMatch = supplier.company_name.toLowerCase().includes(searchTerm);
      // Porównuj NIP bez kresek
      const supplierNip = (supplier.nip || '').replace(/[^0-9]/g, '');
      const nipMatch = searchNip.length >= 3 && supplierNip.includes(searchNip);
      return nameMatch || nipMatch;
    });
  }, [availableSuppliers, debouncedSupplierSearch]);

  // Obsługa przeciągania modalu
  const handleDragStart = (e) => {
    if (e.target.classList.contains('modal-drag-handle') || e.target.closest('.modal-drag-handle')) {
      setIsDragging(true);
      dragStartPos.current = {
        x: e.clientX - modalPosition.x,
        y: e.clientY - modalPosition.y
      };
    }
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    setModalPosition({
      x: e.clientX - dragStartPos.current.x,
      y: e.clientY - dragStartPos.current.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Reset pozycji modalu przy zamknięciu
  const closeAddSupplierModal = () => {
    setAddSupplierModal(false);
    setSupplierSearch('');
    setModalPosition({ x: 0, y: 0 });
  };

  // Przygotowanie danych do wykresu licytacji (tylko dla admina)
  const chartData = useMemo(() => {
    if (!auction?.bids || auction.bids.length === 0) return [];

    // Sortuj oferty po czasie
    const sortedBids = [...auction.bids].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    // Grupuj oferty wg dostawcy i śledź najniższą cenę
    const supplierColors = {};
    const colorPalette = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    let colorIndex = 0;

    let lowestSoFar = Infinity;
    const data = sortedBids.map((bid, index) => {
      const time = new Date(bid.created_at);
      const timeLabel = time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (!supplierColors[bid.company_name]) {
        supplierColors[bid.company_name] = colorPalette[colorIndex % colorPalette.length];
        colorIndex++;
      }

      lowestSoFar = Math.min(lowestSoFar, bid.amount);

      return {
        index: index + 1,
        time: timeLabel,
        timestamp: time.getTime(),
        amount: bid.amount,
        company: bid.company_name,
        lowestAtTime: lowestSoFar,
        color: supplierColors[bid.company_name]
      };
    });

    return { data, supplierColors };
  }, [auction?.bids]);

  // Custom tooltip dla wykresu
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="time">{data.time}</p>
          <p className="company">{data.company}</p>
          <p className="amount">{data.amount.toLocaleString('pl-PL')} PLN</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="loading">Ładowanie...</div>;
  }

  if (!auction) {
    return <div className="error">Aukcja nie znaleziona</div>;
  }

  return (
    <div className="auction-detail">
      <div className="page-header">
        <button onClick={() => navigate('/auctions')} className="btn-back">
          ← Powrót
        </button>
        <h1>{auction.title}</h1>
      </div>

      <div className="auction-grid">
        <div className="auction-main">
          <div className="auction-status-bar">
            <span className={`status-badge large status-${auction.status}`}>
              {auction.status === 'pending' && '⏳ Oczekuje na start'}
              {auction.status === 'active' && '🔴 AUKCJA TRWA'}
              {auction.status === 'completed' && '✅ Zakończona'}
              {auction.status === 'cancelled' && '❌ Anulowana'}
            </span>

            {auction.status === 'active' && (
              <div className="timer-container">
                <div className={`timer ${timeLeft < 60 ? 'warning' : ''}`}>
                  ⏱️ {formatTime(timeLeft)}
                </div>
                {timeExtendedNotice && (
                  <div className="time-extended-notice">
                    +30s ⏰
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="auction-info-card">
            <h3>Szczegóły zamówienia</h3>
            <div className="info-row">
              <span className="label">Materiał:</span>
              <span className="value">{auction.category_icon} {auction.material_name}</span>
            </div>
            <div className="info-row">
              <span className="label">Opis:</span>
              <span className="value">{auction.material_description}</span>
            </div>
            <div className="info-row">
              <span className="label">Ilość:</span>
              <span className="value">{auction.quantity} {auction.unit || auction.material_unit}</span>
            </div>
            <div className="info-row">
              <span className="label">Czas trwania:</span>
              <span className="value">{auction.duration_minutes} minut</span>
            </div>
            {auction.description && (
              <div className="info-row">
                <span className="label">Uwagi:</span>
                <span className="value">{auction.description}</span>
              </div>
            )}
          </div>

          {/* Wykres licytacji - admin only */}
          {isAdmin && chartData.data && chartData.data.length > 0 && (
            <div className="bids-chart-section">
              <h3>📊 Przebieg licytacji</h3>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData.data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="time"
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      tickFormatter={(value) => `${value.toLocaleString('pl-PL')}`}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {/* Linia najniższej ceny */}
                    <Line
                      type="stepAfter"
                      dataKey="lowestAtTime"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={false}
                      name="Najniższa cena"
                    />
                    {/* Punkty wszystkich ofert */}
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#3b82f6"
                      strokeWidth={0}
                      dot={{ r: 6, fill: '#3b82f6', stroke: '#1e293b', strokeWidth: 2 }}
                      activeDot={{ r: 8 }}
                      name="Oferty"
                    />
                    {auction.winning_bid && (
                      <ReferenceLine
                        y={auction.winning_bid}
                        stroke="#f59e0b"
                        strokeDasharray="5 5"
                        label={{ value: 'Zwycięska', fill: '#f59e0b', fontSize: 12 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <h4>Dostawcy:</h4>
                <div className="legend-items">
                  {Object.entries(chartData.supplierColors || {}).map(([company, color]) => (
                    <span key={company} className="legend-item">
                      <span className="legend-color" style={{ background: color }}></span>
                      {company}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bid section for suppliers */}
          {isSupplier && auction.status === 'active' && (
            <div className="bid-section">
              <h3>Złóż ofertę</h3>
              <div className="current-lowest">
                <span>Aktualna najniższa cena:</span>
                <strong>
                  {auction.lowest_bid
                    ? `${auction.lowest_bid.toLocaleString('pl-PL')} PLN`
                    : 'Brak ofert'}
                </strong>
              </div>
              <div className="bid-form">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Twoja cena (PLN)"
                  min="0"
                  step="0.01"
                />
                <button
                  className="btn-primary"
                  onClick={handleBid}
                  disabled={!bidAmount || parseFloat(bidAmount) <= 0}
                >
                  Złóż ofertę
                </button>
              </div>
              {auction.my_bids && auction.my_bids.length > 0 && (
                <div className="my-bids">
                  <h4>Twoje oferty:</h4>
                  {auction.my_bids.map(bid => (
                    <div key={bid.id} className="bid-item">
                      {bid.amount.toLocaleString('pl-PL')} PLN
                      <small>{new Date(bid.created_at).toLocaleTimeString('pl-PL')}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Winner section - admin view */}
          {auction.status === 'completed' && auction.winner_id && isAdmin && (
            <div className="winner-section">
              <h3>🏆 Zwycięzca aukcji</h3>
              <div className="winner-info">
                <p className="winner-name">{auction.winner_name}</p>
                <p className="winning-bid">
                  Zwycięska oferta: <strong>{auction.winning_bid?.toLocaleString('pl-PL')} PLN</strong>
                </p>
                {!auction.results_published && (
                  <p className="results-status unpublished">⚠️ Wyniki nie zostały jeszcze opublikowane</p>
                )}
                {auction.results_published && (
                  <p className="results-status published">✅ Wyniki opublikowane</p>
                )}
              </div>
            </div>
          )}

          {/* Winner section - supplier view */}
          {auction.status === 'completed' && isSupplier && (
            <div className="winner-section">
              {auction.results_hidden ? (
                <>
                  <h3>⏳ Aukcja zakończona</h3>
                  <p className="results-pending">Wyniki zostaną udostępnione przez administratora.</p>
                  {auction.you_won && (
                    <p className="you-won-hint">🎉 Gratulacje! Twoja oferta została wybrana. Oczekuj na oficjalne wyniki.</p>
                  )}
                </>
              ) : auction.you_won ? (
                <>
                  <h3>🏆 Gratulacje!</h3>
                  <div className="winner-info">
                    <p className="you-won">Wygrałeś tę aukcję!</p>
                    <p className="winning-bid">
                      Twoja zwycięska oferta: <strong>{auction.my_bids?.[0]?.amount?.toLocaleString('pl-PL') || '-'} PLN</strong>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h3>Aukcja zakończona</h3>
                  <p className="auction-lost">Dziękujemy za udział. Twoja oferta nie została wybrana.</p>
                </>
              )}
            </div>
          )}

          {/* No winner (no bids) */}
          {auction.status === 'completed' && !auction.winner_id && isAdmin && (
            <div className="winner-section no-winner">
              <h3>Aukcja zakończona</h3>
              <p>Brak ofert - aukcja zakończona bez zwycięzcy.</p>
            </div>
          )}
        </div>

        <div className="auction-sidebar">
          {/* Admin actions */}
          {isAdmin && (
            <div className="admin-actions">
              <h3>Zarządzanie</h3>
              {auction.status === 'pending' && (
                <button className="btn-primary full-width" onClick={handleStart}>
                  ▶️ Uruchom aukcję
                </button>
              )}
              {(auction.status === 'pending' || auction.status === 'active') && (
                <button className="btn-danger full-width" onClick={handleCancel}>
                  ❌ Anuluj aukcję
                </button>
              )}
              {auction.status === 'completed' && auction.winner_id && !auction.results_published && (
                <button className="btn-success full-width" onClick={handlePublishResults}>
                  📢 Opublikuj wyniki
                </button>
              )}
              {(auction.status === 'completed' || auction.status === 'cancelled') && (
                <button className="btn-danger full-width" onClick={handleDelete} style={{ marginTop: '10px' }}>
                  🗑️ Usuń aukcję
                </button>
              )}
            </div>
          )}

          {/* Invited suppliers - admin only */}
          {isAdmin && (
            <div className="invited-suppliers">
              <div className="invited-suppliers-header">
                <h3>Zaproszeni dostawcy ({auction.invitations?.length || 0})</h3>
                {auction.status === 'pending' && (
                  <button className="btn-small btn-primary" onClick={handleOpenAddSuppliers}>
                    + Dodaj
                  </button>
                )}
              </div>
              {auction.invitations?.map(inv => (
                <div key={inv.supplier_id} className="supplier-item">
                  <span className={`supplier-status ${inv.status}`}>
                    {inv.status === 'pending' && '⏳'}
                    {inv.status === 'bid_placed' && '✅'}
                  </span>
                  <span className="supplier-name">{inv.company_name}</span>
                  <span className="supplier-city">{inv.city}</span>
                  {auction.status === 'pending' && (
                    <button
                      className="btn-remove-supplier"
                      onClick={() => handleRemoveSupplier(inv.supplier_id, inv.company_name)}
                      title="Usuń dostawcę"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Invited count - supplier view */}
          {isSupplier && (
            <div className="invited-suppliers">
              <h3>Informacje o aukcji</h3>
              <p>Liczba zaproszonych dostawców: <strong>{auction.invitations_count || '?'}</strong></p>
            </div>
          )}

          {/* All bids (admin only) */}
          {isAdmin && auction.bids && auction.bids.length > 0 && (
            <div className="all-bids">
              <h3>Wszystkie oferty</h3>
              {auction.bids.map((bid, index) => (
                <div key={bid.id} className={`bid-row ${index === 0 ? 'lowest' : ''}`}>
                  <span className="bid-rank">#{index + 1}</span>
                  <span className="bid-company">{bid.company_name}</span>
                  <span className="bid-amount">{bid.amount.toLocaleString('pl-PL')} PLN</span>
                </div>
              ))}
            </div>
          )}

          {/* Auction stats */}
          <div className="auction-stats">
            <h3>Statystyki</h3>
            {isAdmin && (
              <>
                <div className="stat-item">
                  <span>Liczba ofert:</span>
                  <strong>{auction.bids_count || auction.bids?.length || 0}</strong>
                </div>
                <div className="stat-item">
                  <span>Najniższa cena:</span>
                  <strong>
                    {auction.lowest_bid
                      ? `${auction.lowest_bid.toLocaleString('pl-PL')} PLN`
                      : '-'}
                  </strong>
                </div>
              </>
            )}
            {isSupplier && auction.status === 'active' && (
              <div className="stat-item">
                <span>Aktualna najniższa cena:</span>
                <strong>
                  {auction.lowest_bid
                    ? `${auction.lowest_bid.toLocaleString('pl-PL')} PLN`
                    : 'Brak ofert'}
                </strong>
              </div>
            )}
            {isSupplier && auction.status !== 'active' && (
              <p className="stats-hidden">Statystyki dostępne tylko podczas trwania aukcji</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal dodawania dostawców - draggable */}
      {addSupplierModal && (
        <div
          className="modal-overlay modal-overlay-transparent"
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div
            ref={modalRef}
            className="modal modal-draggable"
            style={{
              transform: `translate(${modalPosition.x}px, ${modalPosition.y}px)`,
              cursor: isDragging ? 'grabbing' : 'default'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="modal-drag-handle"
              onMouseDown={handleDragStart}
            >
              <span className="drag-indicator">⋮⋮</span>
              <h2>Dodaj dostawców do aukcji</h2>
              <button className="btn-close" onClick={closeAddSupplierModal}>✕</button>
            </div>

            {suppliersLoading ? (
              <div className="loading">Ładowanie...</div>
            ) : availableSuppliers.length === 0 ? (
              <p>Wszyscy dostawcy zostali już zaproszeni.</p>
            ) : (
              <>
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    placeholder="🔍 Szukaj po nazwie lub NIP..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="search-input"
                  />
                  {supplierSearch && (
                    <button className="btn-clear-search" onClick={() => setSupplierSearch('')}>✕</button>
                  )}
                </div>

                <div className="suppliers-select-list">
                  {filteredSuppliers.length === 0 ? (
                    <p className="no-results">Brak wyników dla "{supplierSearch}"</p>
                  ) : (
                    filteredSuppliers.map(supplier => (
                      <label key={supplier.id} className="supplier-checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedNewSuppliers.includes(supplier.id)}
                          onChange={() => toggleSupplierSelection(supplier.id)}
                        />
                        <span className="supplier-info">
                          <strong>{supplier.company_name}</strong>
                          <small>
                            {supplier.city} {supplier.is_local ? '📍' : ''}
                            {supplier.nip && ` • NIP: ${supplier.nip}`}
                          </small>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="selected-count">
                  Wybrano: <strong>{selectedNewSuppliers.length}</strong> dostawców
                  {supplierSearch && ` (wyświetlono ${filteredSuppliers.length} z ${availableSuppliers.length})`}
                </p>
              </>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeAddSupplierModal}>
                Anuluj
              </button>
              <button
                className="btn-primary"
                onClick={handleAddSuppliers}
                disabled={selectedNewSuppliers.length === 0}
              >
                Dodaj wybranych
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuctionDetail;
