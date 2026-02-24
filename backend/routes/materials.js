const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Pobierz wszystkie kategorie (wymaga autoryzacji)
router.get('/categories', authenticateToken, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(m.id) as materials_count
      FROM material_categories c
      LEFT JOIN materials m ON c.id = m.category_id
      GROUP BY c.id
      ORDER BY c.name
    `).all();

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz wszystkie materiały (wymaga autoryzacji)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { category_id } = req.query;

    let query = `
      SELECT m.*, c.name as category_name, c.icon as category_icon
      FROM materials m
      LEFT JOIN material_categories c ON m.category_id = c.id
    `;

    if (category_id) {
      query += ` WHERE m.category_id = ?`;
      const materials = db.prepare(query).all(category_id);
      return res.json(materials);
    }

    const materials = db.prepare(query + ' ORDER BY c.name, m.name').all();
    res.json(materials);
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz pojedynczy materiał (wymaga autoryzacji)
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const material = db.prepare(`
      SELECT m.*, c.name as category_name, c.icon as category_icon
      FROM materials m
      LEFT JOIN material_categories c ON m.category_id = c.id
      WHERE m.id = ?
    `).get(req.params.id);

    if (!material) {
      return res.status(404).json({ error: 'Materiał nie znaleziony' });
    }

    // Pobierz dostawców dla tej kategorii
    const suppliers = db.prepare(`
      SELECT s.*
      FROM suppliers s
      JOIN supplier_categories sc ON s.id = sc.supplier_id
      WHERE sc.category_id = ?
      ORDER BY s.is_local DESC, s.company_name
    `).all(material.category_id);

    material.suppliers = suppliers;
    res.json(material);
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Dodaj kategorię (admin)
router.post('/categories', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const id = `cat-${uuidv4().slice(0, 8)}`;

    db.prepare(`
      INSERT INTO material_categories (id, name, description, icon)
      VALUES (?, ?, ?, ?)
    `).run(id, name, description, icon);

    res.status(201).json({ id, name, description, icon });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Dodaj materiał (admin)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { category_id, name, description, unit } = req.body;
    const id = `mat-${uuidv4().slice(0, 8)}`;

    db.prepare(`
      INSERT INTO materials (id, category_id, name, description, unit)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, category_id, name, description, unit || 'szt.');

    res.status(201).json({ id, category_id, name, description, unit });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Aktualizuj materiał (admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { category_id, name, description, unit } = req.body;

    db.prepare(`
      UPDATE materials
      SET category_id = ?, name = ?, description = ?, unit = ?
      WHERE id = ?
    `).run(category_id, name, description, unit, req.params.id);

    res.json({ message: 'Materiał zaktualizowany' });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Usuń materiał (admin)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
    res.json({ message: 'Materiał usunięty' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
