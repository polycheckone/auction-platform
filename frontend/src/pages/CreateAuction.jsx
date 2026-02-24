import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategories, getMaterials, getSuppliers, createAuction } from '../api';

function CreateAuction() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customMaterialMode, setCustomMaterialMode] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    material_id: '',
    custom_material_name: '',
    custom_material_unit: '',
    quantity: '',
    unit: '',
    duration_minutes: 10,
    supplier_ids: []
  });

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [categoriesRes, allSuppliersRes] = await Promise.all([
          getCategories(),
          getSuppliers({ limit: 100 }) // Pobierz wszystkich dostawców (bez paginacji)
        ]);
        setCategories(categoriesRes.data);
        setAllSuppliers(allSuppliersRes.data.data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (form.category_id) {
      getMaterials(form.category_id).then(res => setMaterials(res.data));
      getSuppliers({ category_id: form.category_id, limit: 100 }).then(res => setSuppliers(res.data.data));
    } else {
      setMaterials([]);
      setSuppliers([]);
    }
  }, [form.category_id]);

  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleSupplier = useCallback((supplierId) => {
    setForm(prev => ({
      ...prev,
      supplier_ids: prev.supplier_ids.includes(supplierId)
        ? prev.supplier_ids.filter(id => id !== supplierId)
        : [...prev.supplier_ids, supplierId]
    }));
  }, []);

  const selectAllLocal = useCallback(() => {
    const localIds = suppliers.filter(s => s.is_local).map(s => s.id);
    setForm(prev => ({
      ...prev,
      supplier_ids: [...new Set([...prev.supplier_ids, ...localIds])]
    }));
  }, [suppliers]);

  const selectAllNational = useCallback(() => {
    const nationalIds = suppliers.filter(s => !s.is_local).map(s => s.id);
    setForm(prev => ({
      ...prev,
      supplier_ids: [...new Set([...prev.supplier_ids, ...nationalIds])]
    }));
  }, [suppliers]);

  const handleSubmit = useCallback(async () => {
    try {
      const res = await createAuction(form);
      navigate(`/auctions/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd tworzenia aukcji');
    }
  }, [form, navigate]);

  const selectedMaterial = useMemo(() => materials.find(m => m.id === form.material_id), [materials, form.material_id]);

  // Memoizacja filtrowanych dostawców
  const categorySupplierIds = useMemo(() => suppliers.map(s => s.id), [suppliers]);
  const otherSuppliers = useMemo(() => allSuppliers.filter(s => !categorySupplierIds.includes(s.id)), [allSuppliers, categorySupplierIds]);
  const filteredOtherSuppliers = useMemo(() => otherSuppliers.filter(s =>
    s.company_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.city?.toLowerCase().includes(supplierSearch.toLowerCase())
  ), [otherSuppliers, supplierSearch]);
  const localSuppliers = useMemo(() => suppliers.filter(s => s.is_local), [suppliers]);
  const nationalSuppliers = useMemo(() => suppliers.filter(s => !s.is_local), [suppliers]);

  if (loading) {
    return <div className="loading">Ładowanie...</div>;
  }

  return (
    <div className="create-auction">
      <div className="page-header">
        <button onClick={() => navigate('/auctions')} className="btn-back">
          ← Powrót
        </button>
        <h1>➕ Nowa aukcja</h1>
      </div>

      <div className="steps-indicator">
        <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Materiał</div>
        <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Szczegóły</div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Dostawcy</div>
        <div className={`step ${step >= 4 ? 'active' : ''}`}>4. Podsumowanie</div>
      </div>

      {step === 1 && (
        <div className="step-content">
          <h2>Wybierz kategorię i materiał</h2>

          <div className="form-group">
            <label>Kategoria surowca</label>
            <div className="categories-select">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className={`category-option ${form.category_id === cat.id ? 'selected' : ''}`}
                  onClick={() => handleChange('category_id', cat.id)}
                >
                  <span className="icon">{cat.icon}</span>
                  <span className="name">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>

          {form.category_id && (
            <>
              <div className="form-group">
                <div className="material-mode-toggle">
                  <button
                    type="button"
                    className={`btn-toggle ${!customMaterialMode ? 'active' : ''}`}
                    onClick={() => {
                      setCustomMaterialMode(false);
                      handleChange('custom_material_name', '');
                      handleChange('custom_material_unit', '');
                    }}
                  >
                    📋 Z listy
                  </button>
                  <button
                    type="button"
                    className={`btn-toggle ${customMaterialMode ? 'active' : ''}`}
                    onClick={() => {
                      setCustomMaterialMode(true);
                      handleChange('material_id', '');
                    }}
                  >
                    ✏️ Własny materiał
                  </button>
                </div>
              </div>

              {!customMaterialMode ? (
                <div className="form-group">
                  <label>Materiał</label>
                  <select
                    value={form.material_id}
                    onChange={(e) => handleChange('material_id', e.target.value)}
                  >
                    <option value="">Wybierz materiał...</option>
                    {materials.map(mat => (
                      <option key={mat.id} value={mat.id}>
                        {mat.name} ({mat.unit})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="custom-material-form">
                  <div className="form-group">
                    <label>Nazwa materiału</label>
                    <input
                      type="text"
                      value={form.custom_material_name}
                      onChange={(e) => handleChange('custom_material_name', e.target.value)}
                      placeholder="Wpisz nazwę materiału..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Jednostka</label>
                    <input
                      type="text"
                      value={form.custom_material_unit}
                      onChange={(e) => handleChange('custom_material_unit', e.target.value)}
                      placeholder="np. kg, szt., mb..."
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="step-actions">
            <button
              className="btn-primary"
              onClick={() => setStep(2)}
              disabled={customMaterialMode ? !form.custom_material_name : !form.material_id}
            >
              Dalej →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step-content">
          <h2>Szczegóły zamówienia</h2>

          <div className="form-group">
            <label>Tytuł aukcji</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder={`Zakup: ${customMaterialMode ? form.custom_material_name : selectedMaterial?.name || ''}`}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Ilość</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                placeholder="np. 100"
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Jednostka</label>
              <input
                type="text"
                value={form.unit || (customMaterialMode ? form.custom_material_unit : selectedMaterial?.unit) || ''}
                onChange={(e) => handleChange('unit', e.target.value)}
                placeholder={(customMaterialMode ? form.custom_material_unit : selectedMaterial?.unit) || 'szt.'}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Czas trwania aukcji (minuty)</label>
            <select
              value={form.duration_minutes}
              onChange={(e) => handleChange('duration_minutes', parseInt(e.target.value))}
            >
              <option value={5}>5 minut</option>
              <option value={10}>10 minut</option>
              <option value={15}>15 minut</option>
              <option value={30}>30 minut</option>
              <option value={60}>1 godzina</option>
            </select>
          </div>

          <div className="form-group">
            <label>Dodatkowy opis (opcjonalnie)</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Specyfikacja, wymagania, termin dostawy..."
              rows={3}
            />
          </div>

          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              ← Wstecz
            </button>
            <button
              className="btn-primary"
              onClick={() => setStep(3)}
              disabled={!form.title || !form.quantity}
            >
              Dalej →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
          <div className="step-content">
            <h2>Wybierz dostawców do zaproszenia</h2>
            <p className="hint">Wybrano: {form.supplier_ids.length} dostawców</p>

            <div className="quick-select">
              <button className="btn-small" onClick={selectAllLocal}>
                🏠 Zaznacz wszystkich lokalnych
              </button>
              <button className="btn-small" onClick={selectAllNational}>
                🌍 Zaznacz wszystkich ogólnopolskich
              </button>
              <button className="btn-small" onClick={() => handleChange('supplier_ids', [])}>
                Odznacz wszystkich
              </button>
            </div>

            <div className="suppliers-select">
              <div className="suppliers-group">
                <h4>🏠 Dostawcy lokalni (Szczecin i okolice)</h4>
                {localSuppliers.map(supplier => (
                  <label key={supplier.id} className="supplier-checkbox">
                    <input
                      type="checkbox"
                      checked={form.supplier_ids.includes(supplier.id)}
                      onChange={() => toggleSupplier(supplier.id)}
                    />
                    <span className="supplier-info">
                      <strong>{supplier.company_name}</strong>
                      <small>{supplier.city}</small>
                    </span>
                  </label>
                ))}
                {localSuppliers.length === 0 && (
                  <p className="no-suppliers">Brak dostawców lokalnych w tej kategorii</p>
                )}
              </div>

              <div className="suppliers-group">
                <h4>🌍 Dostawcy ogólnopolscy</h4>
                {nationalSuppliers.map(supplier => (
                  <label key={supplier.id} className="supplier-checkbox">
                    <input
                      type="checkbox"
                      checked={form.supplier_ids.includes(supplier.id)}
                      onChange={() => toggleSupplier(supplier.id)}
                    />
                    <span className="supplier-info">
                      <strong>{supplier.company_name}</strong>
                      <small>{supplier.city}</small>
                    </span>
                  </label>
                ))}
                {nationalSuppliers.length === 0 && (
                  <p className="no-suppliers">Brak dostawców ogólnopolskich w tej kategorii</p>
                )}
              </div>

              <div className="suppliers-group other-suppliers">
                <h4>📋 Pozostali dostawcy</h4>
                <div className="supplier-search">
                  <input
                    type="text"
                    placeholder="🔍 Szukaj dostawcy po nazwie lub mieście..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                  />
                </div>
                {supplierSearch && filteredOtherSuppliers.length > 0 && (
                  <div className="other-suppliers-list">
                    {filteredOtherSuppliers.slice(0, 10).map(supplier => (
                      <label key={supplier.id} className="supplier-checkbox">
                        <input
                          type="checkbox"
                          checked={form.supplier_ids.includes(supplier.id)}
                          onChange={() => toggleSupplier(supplier.id)}
                        />
                        <span className="supplier-info">
                          <strong>{supplier.company_name}</strong>
                          <small>{supplier.city} {supplier.is_local ? '🏠' : ''}</small>
                        </span>
                      </label>
                    ))}
                    {filteredOtherSuppliers.length > 10 && (
                      <p className="hint">...i {filteredOtherSuppliers.length - 10} więcej. Zawęź wyszukiwanie.</p>
                    )}
                  </div>
                )}
                {supplierSearch && filteredOtherSuppliers.length === 0 && (
                  <p className="no-suppliers">Nie znaleziono dostawców</p>
                )}
                {!supplierSearch && (
                  <p className="hint">Wpisz nazwę firmy lub miasto, aby wyszukać dostawcę spoza kategorii</p>
                )}
              </div>
            </div>

            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(2)}>
                ← Wstecz
              </button>
              <button
                className="btn-primary"
                onClick={() => setStep(4)}
                disabled={form.supplier_ids.length === 0}
              >
                Dalej →
              </button>
            </div>
          </div>
      )}

      {step === 4 && (
        <div className="step-content">
          <h2>Podsumowanie aukcji</h2>

          <div className="summary-card">
            <div className="summary-row">
              <span className="label">Tytuł:</span>
              <span className="value">{form.title}</span>
            </div>
            <div className="summary-row">
              <span className="label">Materiał:</span>
              <span className="value">
                {customMaterialMode ? (
                  <>{form.custom_material_name} <small>(własny)</small></>
                ) : (
                  selectedMaterial?.name
                )}
              </span>
            </div>
            <div className="summary-row">
              <span className="label">Ilość:</span>
              <span className="value">
                {form.quantity} {form.unit || (customMaterialMode ? form.custom_material_unit : selectedMaterial?.unit)}
              </span>
            </div>
            <div className="summary-row">
              <span className="label">Czas trwania:</span>
              <span className="value">{form.duration_minutes} minut</span>
            </div>
            <div className="summary-row">
              <span className="label">Zaproszeni dostawcy:</span>
              <span className="value">{form.supplier_ids.length}</span>
            </div>
            {form.description && (
              <div className="summary-row">
                <span className="label">Opis:</span>
                <span className="value">{form.description}</span>
              </div>
            )}
          </div>

          <div className="invited-list">
            <h4>Zaproszeni dostawcy:</h4>
            {form.supplier_ids.map(id => {
              const supplier = suppliers.find(s => s.id === id) || allSuppliers.find(s => s.id === id);
              return (
                <span key={id} className="invited-tag">
                  {supplier?.is_local ? '🏠' : '🌍'} {supplier?.company_name}
                </span>
              );
            })}
          </div>

          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep(3)}>
              ← Wstecz
            </button>
            <button className="btn-primary" onClick={handleSubmit}>
              ✅ Utwórz aukcję
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateAuction;
