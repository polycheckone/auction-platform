import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSuppliers, getCategories, inviteSupplier, createSupplier, updateSupplier, deleteSupplier, lookupNIP } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';

function Suppliers() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category_id: '',
    is_local: '',
    city: ''
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [loading, setLoading] = useState(true);
  const [inviteModal, setInviteModal] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState(null);

  // Formularz dodawania/edycji dostawcy
  const [supplierModal, setSupplierModal] = useState(null); // null | 'add' | supplier object (edit)
  const [supplierForm, setSupplierForm] = useState({
    company_name: '',
    city: '',
    region: '',
    address: '',
    website: '',
    phone: '',
    email: '',
    nip: '',
    description: '',
    is_local: false,
    category_ids: []
  });
  const [nipLoading, setNipLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list'
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const loadData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [suppliersRes, categoriesRes] = await Promise.all([
        getSuppliers({ ...filters, search: debouncedSearch, page, limit: pagination.limit }),
        getCategories()
      ]);
      setSuppliers(suppliersRes.data.data);
      setPagination(suppliersRes.data.pagination);
      setCategories(categoriesRes.data);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch, pagination.limit]);

  useEffect(() => {
    loadData(1);
  }, [filters, debouncedSearch]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadData(newPage);
    }
  }, [loadData, pagination.totalPages]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleInvite = useCallback(async () => {
    try {
      const res = await inviteSupplier(inviteModal.id, { email: inviteEmail });
      setInviteResult(res.data);
      setInviteEmail('');
    } catch (err) {
      alert(err.response?.data?.error || 'Blad wysylania zaproszenia');
    }
  }, [inviteModal, inviteEmail]);

  const openAddModal = useCallback(() => {
    setSupplierForm({
      company_name: '',
      city: '',
      region: '',
      address: '',
      website: '',
      phone: '',
      email: '',
      nip: '',
      description: '',
      is_local: false,
      category_ids: []
    });
    setSupplierModal('add');
  }, []);

  const openEditModal = useCallback((supplier) => {
    setSupplierForm({
      company_name: supplier.company_name || '',
      city: supplier.city || '',
      region: supplier.region || '',
      address: supplier.address || '',
      website: supplier.website || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      nip: supplier.nip || '',
      description: supplier.description || '',
      is_local: supplier.is_local === 1,
      category_ids: supplier.categories?.map(c => c.id) || []
    });
    setSupplierModal(supplier);
  }, []);

  const handleFormChange = useCallback((field, value) => {
    setSupplierForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleCategory = useCallback((catId) => {
    setSupplierForm(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter(id => id !== catId)
        : [...prev.category_ids, catId]
    }));
  }, []);

  // Pobierz dane firmy po NIP
  const handleNipLookup = useCallback(async () => {
    const nip = supplierForm.nip.replace(/[^0-9]/g, '');
    if (nip.length !== 10) {
      alert('NIP musi mieć 10 cyfr');
      return;
    }

    setNipLoading(true);
    try {
      const res = await lookupNIP(nip);
      if (res.data.found) {
        const data = res.data;
        setSupplierForm(prev => ({
          ...prev,
          company_name: data.company_name || prev.company_name,
          nip: data.nip || prev.nip,
          address: data.address || prev.address,
          city: data.city || prev.city,
          // Automatyczne wykrycie czy to Szczecin
          is_local: (data.city || '').toLowerCase().includes('szczecin')
        }));
        alert(`Pobrano dane firmy: ${data.company_name}`);
      } else {
        alert('Nie znaleziono firmy o podanym NIP w rejestrze VAT');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd podczas wyszukiwania');
    } finally {
      setNipLoading(false);
    }
  }, [supplierForm.nip]);

  const handleSaveSupplier = useCallback(async () => {
    try {
      // Oczyść NIP z myślników, spacji i innych znaków
      const cleanedForm = {
        ...supplierForm,
        nip: supplierForm.nip ? supplierForm.nip.replace(/[^0-9]/g, '') : ''
      };

      if (supplierModal === 'add') {
        await createSupplier(cleanedForm);
        alert('Dostawca dodany!');
      } else {
        await updateSupplier(supplierModal.id, cleanedForm);
        alert('Dostawca zaktualizowany!');
      }
      setSupplierModal(null);
      loadData();
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.details && Array.isArray(errorData.details)) {
        const messages = errorData.details.map(d => `${d.field}: ${d.message}`).join('\n');
        alert(`Błąd walidacji:\n${messages}`);
      } else {
        alert(errorData?.error || 'Błąd zapisywania dostawcy');
      }
    }
  }, [supplierModal, supplierForm, loadData]);

  const handleDeleteSupplier = useCallback(async (supplier) => {
    if (!confirm(`Czy na pewno chcesz usunac dostawce "${supplier.company_name}"?`)) return;
    try {
      await deleteSupplier(supplier.id);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Blad usuwania dostawcy');
    }
  }, [loadData]);

  return (
    <div className="suppliers-page">
      <div className="page-header">
        <div>
          <h1>Dostawcy</h1>
          <p>Lista dostawcow surowcow przemyslowych</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={openAddModal}>
            + Dodaj dostawce
          </button>
        )}
      </div>

      <div className="filters-bar">
        <input
          type="text"
          placeholder="🔍 Szukaj po nazwie lub NIP..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="search-input"
        />

        <select
          value={filters.category_id}
          onChange={(e) => handleFilterChange('category_id', e.target.value)}
        >
          <option value="">Wszystkie kategorie</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
          ))}
        </select>

        <select
          value={filters.is_local}
          onChange={(e) => handleFilterChange('is_local', e.target.value)}
        >
          <option value="">Wszyscy</option>
          <option value="true">Lokalni (Szczecin)</option>
          <option value="false">Ogólnopolscy</option>
        </select>

        <input
          type="text"
          placeholder="Miasto..."
          value={filters.city}
          onChange={(e) => handleFilterChange('city', e.target.value)}
        />
      </div>

      <div className="suppliers-toolbar">
        <div className="suppliers-count">
          Znaleziono: <strong>{pagination.total}</strong> dostawców
        </div>
        <div className="view-toggle">
          <button
            className={`btn-toggle-view ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Widok listy"
          >
            ☰
          </button>
          <button
            className={`btn-toggle-view ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Widok siatki"
          >
            ▦
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Ładowanie...</div>
      ) : viewMode === 'list' ? (
        <div className="suppliers-table">
          <table>
            <thead>
              <tr>
                <th>Firma</th>
                <th>Miasto</th>
                <th>Kategorie</th>
                <th>Kontakt</th>
                {isAdmin && <th>Akcje</th>}
              </tr>
            </thead>
            <tbody>
              {suppliers.map(supplier => (
                <tr key={supplier.id} className={supplier.is_local ? 'local-row' : ''}>
                  <td>
                    <strong>{supplier.company_name}</strong>
                    {supplier.is_local ? <span className="badge-inline local">Lokalny</span> : null}
                  </td>
                  <td>{supplier.city}</td>
                  <td>
                    <div className="categories-inline">
                      {supplier.categories?.slice(0, 2).map(cat => (
                        <span key={cat.id} className="cat-tag-small">{cat.name}</span>
                      ))}
                      {supplier.categories?.length > 2 && (
                        <span className="cat-more">+{supplier.categories.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {supplier.phone && <span className="contact-item">📞 {supplier.phone}</span>}
                    {supplier.email && <span className="contact-item">✉️ {supplier.email}</span>}
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="table-actions">
                        <button className="btn-small" onClick={() => openEditModal(supplier)}>Edytuj</button>
                        <button className="btn-small" onClick={() => setInviteModal(supplier)}>Zaproś</button>
                        <button className="btn-small btn-danger-small" onClick={() => handleDeleteSupplier(supplier)}>Usuń</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="suppliers-grid">
        {suppliers.map(supplier => (
          <div key={supplier.id} className={`supplier-card ${supplier.is_local ? 'local' : ''}`}>
            <div className="supplier-header">
              <h3>{supplier.company_name}</h3>
              {supplier.is_local ? (
                <span className="badge local">Lokalny</span>
              ) : (
                <span className="badge">Polska</span>
              )}
            </div>

            <div className="supplier-details">
              <p><strong>Miasto:</strong> {supplier.city}</p>
              {supplier.address && <p><strong>Adres:</strong> {supplier.address}</p>}
              {supplier.website && (
                <p>
                  <strong>Strona:</strong>{' '}
                  <a href={`https://${supplier.website}`} target="_blank" rel="noopener noreferrer">
                    {supplier.website}
                  </a>
                </p>
              )}
              {supplier.phone && <p><strong>Tel:</strong> {supplier.phone}</p>}
            </div>

            <div className="supplier-categories">
              {supplier.categories?.map(cat => (
                <span key={cat.id} className="category-tag">
                  {cat.icon} {cat.name}
                </span>
              ))}
            </div>

            {isAdmin && (
              <div className="supplier-actions">
                <button className="btn-small" onClick={() => openEditModal(supplier)}>
                  Edytuj
                </button>
                <button className="btn-small" onClick={() => setInviteModal(supplier)}>
                  Zapros
                </button>
                <button className="btn-small btn-danger-small" onClick={() => handleDeleteSupplier(supplier)}>
                  Usun
                </button>
              </div>
            )}
          </div>
        ))}
        </div>
      )}

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

      {/* Modal zaproszenia */}
      {inviteModal && (
        <div className="modal-overlay" onClick={() => { setInviteModal(null); setInviteResult(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Zapros dostawce</h3>
            <p>Firma: <strong>{inviteModal.company_name}</strong></p>

            {inviteResult ? (
              <div className="invite-result">
                <p>Zaproszenie wyslane (symulacja)</p>
                <p><strong>Link aktywacyjny:</strong></p>
                <code>{inviteResult.activationLink}</code>
                <button className="btn-primary" onClick={() => { setInviteModal(null); setInviteResult(null); }}>
                  Zamknij
                </button>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Email kontaktowy</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@firma.pl"
                  />
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setInviteModal(null)}>
                    Anuluj
                  </button>
                  <button className="btn-primary" onClick={handleInvite} disabled={!inviteEmail}>
                    Wyslij zaproszenie
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal dodawania/edycji dostawcy */}
      {supplierModal && (
        <div className="modal-overlay" onClick={() => setSupplierModal(null)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <h3>{supplierModal === 'add' ? 'Dodaj nowego dostawce' : 'Edytuj dostawce'}</h3>

            <div className="form-grid">
              <div className="form-group">
                <label>Nazwa firmy *</label>
                <input
                  type="text"
                  value={supplierForm.company_name}
                  onChange={(e) => handleFormChange('company_name', e.target.value)}
                  placeholder="np. ABC Sp. z o.o."
                />
              </div>

              <div className="form-group">
                <label>NIP {supplierModal === 'add' && '(wpisz i pobierz dane)'}</label>
                <div className="nip-input-group">
                  <input
                    type="text"
                    value={supplierForm.nip}
                    onChange={(e) => handleFormChange('nip', e.target.value)}
                    placeholder="np. 1234567890"
                  />
                  <button
                    type="button"
                    className="btn-nip-lookup"
                    onClick={handleNipLookup}
                    disabled={nipLoading || !supplierForm.nip}
                  >
                    {nipLoading ? '⏳' : '🔍'} {nipLoading ? 'Szukam...' : 'Pobierz z KRS'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Miasto *</label>
                <input
                  type="text"
                  value={supplierForm.city}
                  onChange={(e) => handleFormChange('city', e.target.value)}
                  placeholder="np. Szczecin"
                />
              </div>

              <div className="form-group">
                <label>Wojewodztwo</label>
                <input
                  type="text"
                  value={supplierForm.region}
                  onChange={(e) => handleFormChange('region', e.target.value)}
                  placeholder="np. zachodniopomorskie"
                />
              </div>

              <div className="form-group full-width">
                <label>Adres</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                  placeholder="np. ul. Przemyslowa 15"
                />
              </div>

              <div className="form-group">
                <label>Strona WWW</label>
                <input
                  type="text"
                  value={supplierForm.website}
                  onChange={(e) => handleFormChange('website', e.target.value)}
                  placeholder="np. firma.pl"
                />
              </div>

              <div className="form-group">
                <label>Telefon</label>
                <input
                  type="text"
                  value={supplierForm.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                  placeholder="np. +48 91 123 45 67"
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  placeholder="np. kontakt@firma.pl"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={supplierForm.is_local}
                    onChange={(e) => handleFormChange('is_local', e.target.checked)}
                  />
                  Dostawca lokalny (Szczecin i okolice)
                </label>
              </div>

              <div className="form-group full-width">
                <label>Opis</label>
                <textarea
                  value={supplierForm.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Dodatkowe informacje o dostawcy..."
                  rows={2}
                />
              </div>

              <div className="form-group full-width">
                <label>Kategorie surowcow</label>
                <div className="categories-checkboxes">
                  {categories.map(cat => (
                    <label key={cat.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={supplierForm.category_ids.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      {cat.icon} {cat.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setSupplierModal(null)}>
                Anuluj
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveSupplier}
                disabled={!supplierForm.company_name || !supplierForm.city}
              >
                {supplierModal === 'add' ? 'Dodaj dostawce' : 'Zapisz zmiany'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Suppliers;
