import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCategories, getMaterials, createCategory, createMaterial, updateMaterial, deleteMaterial, getSuppliers, createAuction } from '../api';
import { useAuth } from '../context/AuthContext';

function Materials() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  // Wybrany materiał i dostawcy
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);

  // Modal kategorii
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', icon: '' });

  // Modal materialu
  const [materialModal, setMaterialModal] = useState(null); // null | 'add' | material object (edit)
  const [materialForm, setMaterialForm] = useState({
    category_id: '',
    name: '',
    description: '',
    unit: 'szt.'
  });

  // Modal szybkiego tworzenia aukcji
  const [auctionModal, setAuctionModal] = useState(false);
  const [auctionForm, setAuctionForm] = useState({
    title: '',
    description: '',
    quantity: '',
    duration_minutes: 10
  });

  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list'

  const loadCategories = async () => {
    try {
      const res = await getCategories();
      setCategories(res.data);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    const loadMaterials = async () => {
      if (!selectedCategory) {
        setMaterials([]);
        setSelectedMaterial(null);
        return;
      }

      try {
        const res = await getMaterials(selectedCategory);
        setMaterials(res.data);
        setSelectedMaterial(null);
      } catch (err) {
        console.error('Error loading materials:', err);
      }
    };

    loadMaterials();
  }, [selectedCategory]);

  // Ładowanie dostawców dla wybranego materiału
  useEffect(() => {
    const loadSuppliers = async () => {
      if (!selectedMaterial || !selectedCategory) {
        setSuppliers([]);
        return;
      }

      setSuppliersLoading(true);
      try {
        const res = await getSuppliers({ category_id: selectedCategory, limit: 100 });
        setSuppliers(res.data.data || []);
        setSelectedSuppliers([]);
      } catch (err) {
        console.error('Error loading suppliers:', err);
      } finally {
        setSuppliersLoading(false);
      }
    };

    loadSuppliers();
  }, [selectedMaterial, selectedCategory]);

  // Kategorie
  const openCategoryModal = () => {
    setCategoryForm({ name: '', description: '', icon: '' });
    setCategoryModal(true);
  };

  const handleCategoryChange = (field, value) => {
    setCategoryForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveCategory = async () => {
    try {
      await createCategory(categoryForm);
      setCategoryModal(false);
      loadCategories();
      alert('Kategoria dodana!');
    } catch (err) {
      alert(err.response?.data?.error || 'Blad dodawania kategorii');
    }
  };

  // Materialy
  const openAddMaterialModal = () => {
    setMaterialForm({
      category_id: selectedCategory || '',
      name: '',
      description: '',
      unit: 'szt.'
    });
    setMaterialModal('add');
  };

  const openEditMaterialModal = (material) => {
    setMaterialForm({
      category_id: material.category_id || '',
      name: material.name || '',
      description: material.description || '',
      unit: material.unit || 'szt.'
    });
    setMaterialModal(material);
  };

  const handleMaterialChange = (field, value) => {
    setMaterialForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveMaterial = async () => {
    try {
      if (materialModal === 'add') {
        await createMaterial(materialForm);
        alert('Material dodany!');
      } else {
        await updateMaterial(materialModal.id, materialForm);
        alert('Material zaktualizowany!');
      }
      setMaterialModal(null);
      // Reload materials
      const res = await getMaterials(selectedCategory);
      setMaterials(res.data);
      loadCategories(); // Update count
    } catch (err) {
      alert(err.response?.data?.error || 'Blad zapisywania materialu');
    }
  };

  const handleDeleteMaterial = async (material) => {
    if (!confirm(`Czy na pewno chcesz usunac material "${material.name}"?`)) return;
    try {
      await deleteMaterial(material.id);
      const res = await getMaterials(selectedCategory);
      setMaterials(res.data);
      loadCategories(); // Update count
    } catch (err) {
      alert(err.response?.data?.error || 'Blad usuwania materialu');
    }
  };

  // Wybór materiału
  const handleSelectMaterial = (material) => {
    if (selectedMaterial?.id === material.id) {
      setSelectedMaterial(null);
    } else {
      setSelectedMaterial(material);
    }
  };

  // Toggle dostawcy
  const toggleSupplier = (supplierId) => {
    setSelectedSuppliers(prev =>
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  // Zaznacz wszystkich dostawców
  const selectAllSuppliers = () => {
    if (selectedSuppliers.length === suppliers.length) {
      setSelectedSuppliers([]);
    } else {
      setSelectedSuppliers(suppliers.map(s => s.id));
    }
  };

  // Otwórz modal aukcji
  const openAuctionModal = () => {
    if (selectedSuppliers.length === 0) {
      alert('Wybierz przynajmniej jednego dostawcę');
      return;
    }
    setAuctionForm({
      title: `Zakup: ${selectedMaterial.name}`,
      description: '',
      quantity: '',
      duration_minutes: 10
    });
    setAuctionModal(true);
  };

  // Utwórz aukcję
  const handleCreateAuction = async () => {
    try {
      const res = await createAuction({
        title: auctionForm.title,
        description: auctionForm.description,
        material_id: selectedMaterial.id,
        quantity: parseFloat(auctionForm.quantity),
        unit: selectedMaterial.unit,
        duration_minutes: auctionForm.duration_minutes,
        supplier_ids: selectedSuppliers
      });
      setAuctionModal(false);
      alert('Aukcja utworzona! Przekierowuję do szczegółów...');
      navigate(`/auctions/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd tworzenia aukcji');
    }
  };

  if (loading) {
    return <div className="loading">Ladowanie...</div>;
  }

  return (
    <div className="materials-page">
      <div className="page-header">
        <div>
          <h1>Surowce</h1>
          <p>Przegladaj kategorie i surowce</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={openCategoryModal}>
            + Dodaj kategorie
          </button>
        )}
      </div>

      <div className="categories-toolbar">
        <span className="section-title">Kategorie ({categories.length})</span>
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

      {viewMode === 'list' ? (
        <div className="categories-list">
          {categories.map(category => (
            <div
              key={category.id}
              className={`category-list-item ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <span className="cat-icon-small">{category.icon}</span>
              <span className="cat-name">{category.name}</span>
              <span className="cat-count">{category.materials_count} mat.</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="categories-grid">
          {categories.map(category => (
            <div
              key={category.id}
              className={`category-card ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.id)}
            >
              <span className="category-icon">{category.icon}</span>
              <h3>{category.name}</h3>
              <p>{category.description}</p>
              <span className="materials-count">{category.materials_count} materiałów</span>
            </div>
          ))}
        </div>
      )}

      {selectedCategory && (
        <div className="materials-section">
          <div className="materials-header">
            <h2>Materialy w kategorii</h2>
            {isAdmin && (
              <button className="btn-primary" onClick={openAddMaterialModal}>
                + Dodaj material
              </button>
            )}
          </div>

          {materials.length === 0 ? (
            <p className="no-data">Brak materialow w tej kategorii</p>
          ) : (
            <div className="materials-table">
              <table>
                <thead>
                  <tr>
                    <th>Nazwa</th>
                    <th>Opis</th>
                    <th>Jednostka</th>
                    {isAdmin && <th>Akcje</th>}
                  </tr>
                </thead>
                <tbody>
                  {materials.map(material => (
                    <tr
                      key={material.id}
                      className={`material-row ${selectedMaterial?.id === material.id ? 'selected' : ''}`}
                      onClick={() => isAdmin && handleSelectMaterial(material)}
                    >
                      <td><strong>{material.name}</strong></td>
                      <td>{material.description}</td>
                      <td>{material.unit}</td>
                      {isAdmin && (
                        <td className="actions-cell">
                          <button className="btn-small" onClick={(e) => { e.stopPropagation(); openEditMaterialModal(material); }}>
                            Edytuj
                          </button>
                          <button className="btn-small btn-danger-small" onClick={(e) => { e.stopPropagation(); handleDeleteMaterial(material); }}>
                            Usun
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Panel dostawców dla wybranego materiału */}
          {isAdmin && selectedMaterial && (
            <div className="suppliers-panel">
              <div className="suppliers-panel-header">
                <h3>🏢 Dostawcy dla: {selectedMaterial.name}</h3>
                <button className="btn-secondary" onClick={() => setSelectedMaterial(null)}>
                  ✕ Zamknij
                </button>
              </div>

              {suppliersLoading ? (
                <p className="loading-text">Ładowanie dostawców...</p>
              ) : suppliers.length === 0 ? (
                <p className="no-data">Brak dostawców w tej kategorii</p>
              ) : (
                <>
                  <div className="suppliers-panel-actions">
                    <button className="btn-small" onClick={selectAllSuppliers}>
                      {selectedSuppliers.length === suppliers.length ? 'Odznacz wszystkich' : 'Zaznacz wszystkich'}
                    </button>
                    <span className="selected-count">
                      Wybrano: <strong>{selectedSuppliers.length}</strong> z {suppliers.length}
                    </span>
                  </div>

                  <div className="suppliers-list">
                    {suppliers.map(supplier => (
                      <div
                        key={supplier.id}
                        className={`supplier-checkbox-item ${selectedSuppliers.includes(supplier.id) ? 'selected' : ''}`}
                        onClick={() => toggleSupplier(supplier.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSuppliers.includes(supplier.id)}
                          onChange={() => {}}
                        />
                        <div className="supplier-info">
                          <span className="supplier-name">{supplier.company_name}</span>
                          <span className="supplier-location">
                            {supplier.city}
                            {supplier.is_local ? ' 📍 Lokalny' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="suppliers-panel-footer">
                    <button
                      className="btn-primary"
                      onClick={openAuctionModal}
                      disabled={selectedSuppliers.length === 0}
                    >
                      🔨 Utwórz aukcję ({selectedSuppliers.length} dostawców)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal dodawania kategorii */}
      {categoryModal && (
        <div className="modal-overlay" onClick={() => setCategoryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Dodaj nowa kategorie</h3>

            <div className="form-group">
              <label>Ikona (emoji)</label>
              <input
                type="text"
                value={categoryForm.icon}
                onChange={(e) => handleCategoryChange('icon', e.target.value)}
                placeholder="np. 🧪"
                maxLength={4}
              />
            </div>

            <div className="form-group">
              <label>Nazwa kategorii *</label>
              <input
                type="text"
                value={categoryForm.name}
                onChange={(e) => handleCategoryChange('name', e.target.value)}
                placeholder="np. Surowce chemiczne"
              />
            </div>

            <div className="form-group">
              <label>Opis</label>
              <textarea
                value={categoryForm.description}
                onChange={(e) => handleCategoryChange('description', e.target.value)}
                placeholder="Krotki opis kategorii..."
                rows={2}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setCategoryModal(false)}>
                Anuluj
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveCategory}
                disabled={!categoryForm.name}
              >
                Dodaj kategorie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal dodawania/edycji materialu */}
      {materialModal && (
        <div className="modal-overlay" onClick={() => setMaterialModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{materialModal === 'add' ? 'Dodaj nowy material' : 'Edytuj material'}</h3>

            <div className="form-group">
              <label>Kategoria *</label>
              <select
                value={materialForm.category_id}
                onChange={(e) => handleMaterialChange('category_id', e.target.value)}
              >
                <option value="">Wybierz kategorie...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Nazwa materialu *</label>
              <input
                type="text"
                value={materialForm.name}
                onChange={(e) => handleMaterialChange('name', e.target.value)}
                placeholder="np. Kwas siarkowy"
              />
            </div>

            <div className="form-group">
              <label>Opis / zastosowanie</label>
              <textarea
                value={materialForm.description}
                onChange={(e) => handleMaterialChange('description', e.target.value)}
                placeholder="Opis materialu, zastosowanie..."
                rows={2}
              />
            </div>

            <div className="form-group">
              <label>Jednostka miary</label>
              <input
                type="text"
                value={materialForm.unit}
                onChange={(e) => handleMaterialChange('unit', e.target.value)}
                placeholder="np. kg, l, szt."
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setMaterialModal(null)}>
                Anuluj
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveMaterial}
                disabled={!materialForm.name || !materialForm.category_id}
              >
                {materialModal === 'add' ? 'Dodaj material' : 'Zapisz zmiany'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tworzenia aukcji */}
      {auctionModal && selectedMaterial && (
        <div className="modal-overlay" onClick={() => setAuctionModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <h3>🔨 Utwórz nową aukcję</h3>

            <div className="auction-summary">
              <p><strong>Materiał:</strong> {selectedMaterial.name}</p>
              <p><strong>Zaproszeni dostawcy:</strong> {selectedSuppliers.length}</p>
            </div>

            <div className="form-group">
              <label>Tytuł aukcji *</label>
              <input
                type="text"
                value={auctionForm.title}
                onChange={(e) => setAuctionForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="np. Zakup kwasu siarkowego"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Ilość * ({selectedMaterial.unit})</label>
                <input
                  type="number"
                  value={auctionForm.quantity}
                  onChange={(e) => setAuctionForm(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="np. 1000"
                  min="0"
                  step="any"
                />
              </div>

              <div className="form-group">
                <label>Czas trwania (minuty)</label>
                <select
                  value={auctionForm.duration_minutes}
                  onChange={(e) => setAuctionForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                >
                  <option value={5}>5 minut</option>
                  <option value={10}>10 minut</option>
                  <option value={15}>15 minut</option>
                  <option value={30}>30 minut</option>
                  <option value={60}>1 godzina</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Dodatkowe uwagi</label>
              <textarea
                value={auctionForm.description}
                onChange={(e) => setAuctionForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="np. Wymagana dostawa w ciągu 7 dni..."
                rows={3}
              />
            </div>

            <div className="invited-suppliers-preview">
              <h4>Zaproszeni dostawcy:</h4>
              <div className="supplier-tags">
                {suppliers
                  .filter(s => selectedSuppliers.includes(s.id))
                  .map(s => (
                    <span key={s.id} className="supplier-tag">
                      {s.company_name}
                      {s.is_local ? ' 📍' : ''}
                    </span>
                  ))
                }
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setAuctionModal(false)}>
                Anuluj
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateAuction}
                disabled={!auctionForm.title || !auctionForm.quantity}
              >
                Utwórz aukcję
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Materials;
