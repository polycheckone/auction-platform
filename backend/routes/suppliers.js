const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { supplierValidation, nipParamValidation } = require('../middleware/validation');
const { createRateLimiter, SimpleCache } = require('../middleware/rateLimiter');
const { parseAddress } = require('../utils/addressParser');

// Rate limiter dla NIP lookup: max 10 żądań na minutę per user
const nipLookupLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10,
  keyPrefix: 'nip-lookup',
  message: 'Zbyt wiele zapytań NIP. Poczekaj chwilę przed kolejnym wyszukiwaniem.'
});

// Cache dla wyników NIP (ważny 1 godzinę)
const nipCache = new SimpleCache(3600000);

// Pobierz dane firmy po NIP z API Ministerstwa Finansów
router.get('/lookup/nip/:nip', authenticateToken, requireAdmin, nipLookupLimiter, nipParamValidation, async (req, res) => {
  try {
    const nip = req.params.nip.replace(/[^0-9]/g, ''); // usuń wszystko oprócz cyfr

    if (nip.length !== 10) {
      return res.status(400).json({ error: 'NIP musi mieć 10 cyfr' });
    }

    // Sprawdź cache
    const cached = nipCache.get(nip);
    if (cached) {
      return res.json(cached);
    }

    // Data dzisiejsza w formacie YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Pobierz dane z API Ministerstwa Finansów (Biała Lista VAT) z timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await response.json();

      let result;
      if (data.result?.subject) {
        const subject = data.result.subject;

        // Parsowanie adresu
        const address = subject.workingAddress || subject.residenceAddress || '';
        const addressParts = parseAddress(address);

        result = {
          found: true,
          company_name: subject.name,
          nip: subject.nip,
          regon: subject.regon,
          address: addressParts.street,
          city: addressParts.city,
          postal_code: addressParts.postalCode,
          krs: subject.krs || '',
          status: subject.statusVat,
          accountNumbers: subject.accountNumbers || []
        };
      } else {
        result = {
          found: false,
          message: 'Nie znaleziono firmy o podanym NIP'
        };
      }

      // Zapisz w cache
      nipCache.set(nip, result);
      res.json(result);

    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({ error: 'Timeout podczas komunikacji z API MF' });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('NIP lookup error:', error);
    res.status(500).json({ error: 'Błąd podczas wyszukiwania danych firmy' });
  }
});

// Pobierz wszystkich dostawców
router.get('/', (req, res) => {
  try {
    const { category_id, is_local, city, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let baseQuery = `
      FROM suppliers s
      LEFT JOIN supplier_categories sc ON s.id = sc.supplier_id
      WHERE 1=1
    `;
    const params = [];

    // Wyszukiwanie po nazwie lub NIP (obsługa NIP z myślnikami)
    if (search) {
      const searchClean = search.replace(/[^0-9]/g, ''); // NIP bez myślników
      if (searchClean.length >= 3) {
        // Szukaj po nazwie LUB po NIP (oczyszczonym)
        baseQuery += ` AND (s.company_name LIKE ? OR s.nip LIKE ?)`;
        params.push(`%${search}%`, `%${searchClean}%`);
      } else {
        // Tylko po nazwie jeśli za mało cyfr
        baseQuery += ` AND s.company_name LIKE ?`;
        params.push(`%${search}%`);
      }
    }

    if (category_id) {
      baseQuery += ` AND sc.category_id = ?`;
      params.push(category_id);
    }

    if (is_local !== undefined && is_local !== '') {
      baseQuery += ` AND s.is_local = ?`;
      params.push(is_local === 'true' ? 1 : 0);
    }

    if (city) {
      baseQuery += ` AND s.city LIKE ?`;
      params.push(`%${city}%`);
    }

    // Pobierz łączną liczbę wyników
    const countResult = db.prepare(`SELECT COUNT(DISTINCT s.id) as total ${baseQuery}`).get(...params);
    const total = countResult.total;

    // Pobierz dostawców z paginacją
    const query = `
      SELECT DISTINCT s.*
      ${baseQuery}
      ORDER BY s.is_local DESC, s.company_name
      LIMIT ? OFFSET ?
    `;

    const suppliers = db.prepare(query).all(...params, limitNum, offset);

    // Pobierz wszystkie kategorie dla wszystkich dostawców jednym zapytaniem
    if (suppliers.length > 0) {
      const supplierIds = suppliers.map(s => s.id);
      const placeholders = supplierIds.map(() => '?').join(',');

      const allCategories = db.prepare(`
        SELECT sc.supplier_id, c.*
        FROM material_categories c
        JOIN supplier_categories sc ON c.id = sc.category_id
        WHERE sc.supplier_id IN (${placeholders})
      `).all(...supplierIds);

      // Grupuj kategorie po supplier_id
      const categoriesBySupplier = {};
      for (const cat of allCategories) {
        if (!categoriesBySupplier[cat.supplier_id]) {
          categoriesBySupplier[cat.supplier_id] = [];
        }
        categoriesBySupplier[cat.supplier_id].push({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          created_at: cat.created_at
        });
      }

      // Przypisz kategorie do dostawców
      for (const supplier of suppliers) {
        supplier.categories = categoriesBySupplier[supplier.id] || [];
      }
    }

    res.json({
      data: suppliers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz pojedynczego dostawcę
router.get('/:id', (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);

    if (!supplier) {
      return res.status(404).json({ error: 'Dostawca nie znaleziony' });
    }

    // Pobierz kategorie dostawcy
    const categories = db.prepare(`
      SELECT c.*
      FROM material_categories c
      JOIN supplier_categories sc ON c.id = sc.category_id
      WHERE sc.supplier_id = ?
    `).all(supplier.id);

    supplier.categories = categories;

    // Pobierz konto użytkownika jeśli istnieje
    if (supplier.user_id) {
      const user = db.prepare('SELECT id, email, name, is_active FROM users WHERE id = ?').get(supplier.user_id);
      supplier.user = user;
    }

    res.json(supplier);
  } catch (error) {
    console.error('Get supplier error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Dodaj dostawcę (admin)
router.post('/', authenticateToken, requireAdmin, supplierValidation, (req, res) => {
  try {
    const { company_name, nip, address, city, region, phone, email, website, description, is_local, category_ids } = req.body;

    // Sprawdź czy NIP już istnieje (jeśli podano)
    if (nip) {
      const existingNip = db.prepare('SELECT id, company_name FROM suppliers WHERE nip = ?').get(nip);
      if (existingNip) {
        return res.status(400).json({
          error: `Dostawca z NIP ${nip} już istnieje: ${existingNip.company_name}`
        });
      }
    }

    // Sprawdź czy nazwa firmy już istnieje
    const existingName = db.prepare('SELECT id FROM suppliers WHERE LOWER(company_name) = LOWER(?)').get(company_name);
    if (existingName) {
      return res.status(400).json({
        error: `Dostawca o nazwie "${company_name}" już istnieje`
      });
    }

    const id = `sup-${crypto.randomUUID().slice(0, 8)}`;

    db.prepare(`
      INSERT INTO suppliers (id, company_name, nip, address, city, region, phone, email, website, description, is_local)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, company_name, nip, address, city, region, phone, email, website, description, is_local ? 1 : 0);

    // Dodaj kategorie
    if (category_ids && category_ids.length > 0) {
      const insertCategory = db.prepare('INSERT INTO supplier_categories (supplier_id, category_id) VALUES (?, ?)');
      for (const catId of category_ids) {
        insertCategory.run(id, catId);
      }
    }

    res.status(201).json({ id, company_name, message: 'Dostawca dodany' });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Zaproś dostawcę do platformy (utwórz konto)
router.post('/:id/invite', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { email, name } = req.body;
    const supplierId = req.params.id;

    // Sprawdź czy dostawca istnieje
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Dostawca nie znaleziony' });
    }

    // Sprawdź czy email już istnieje
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email już zarejestrowany' });
    }

    // Utwórz użytkownika z tokenem zaproszenia
    const userId = `user-${crypto.randomUUID().slice(0, 8)}`;
    const invitationToken = crypto.randomUUID();
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dni

    db.prepare(`
      INSERT INTO users (id, email, password, name, company, role, invitation_token, invitation_expires, is_active)
      VALUES (?, ?, '', ?, ?, 'supplier', ?, ?, 0)
    `).run(userId, email, name || supplier.company_name, supplier.company_name, invitationToken, invitationExpires);

    // Powiąż użytkownika z dostawcą
    db.prepare('UPDATE suppliers SET user_id = ?, email = ? WHERE id = ?').run(userId, email, supplierId);

    // W rzeczywistej aplikacji tutaj wysyłamy email
    // Na razie symulacja - zwracamy link aktywacyjny
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${frontendUrl}/activate?token=${invitationToken}`;

    res.json({
      message: 'Zaproszenie wysłane (symulacja)',
      activationLink,
      token: invitationToken // tylko do testów
    });
  } catch (error) {
    console.error('Invite supplier error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Aktualizuj dostawcę (admin)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { company_name, nip, address, city, region, phone, email, website, description, is_local, category_ids } = req.body;
    const supplierId = req.params.id;

    // Sprawdź czy NIP już istnieje u innego dostawcy
    if (nip) {
      const existingNip = db.prepare('SELECT id, company_name FROM suppliers WHERE nip = ? AND id != ?').get(nip, supplierId);
      if (existingNip) {
        return res.status(400).json({
          error: `Dostawca z NIP ${nip} już istnieje: ${existingNip.company_name}`
        });
      }
    }

    // Sprawdź czy nazwa firmy już istnieje u innego dostawcy
    const existingName = db.prepare('SELECT id FROM suppliers WHERE LOWER(company_name) = LOWER(?) AND id != ?').get(company_name, supplierId);
    if (existingName) {
      return res.status(400).json({
        error: `Dostawca o nazwie "${company_name}" już istnieje`
      });
    }

    db.prepare(`
      UPDATE suppliers
      SET company_name = ?, nip = ?, address = ?, city = ?, region = ?, phone = ?, email = ?, website = ?, description = ?, is_local = ?
      WHERE id = ?
    `).run(company_name, nip, address, city, region, phone, email, website, description, is_local ? 1 : 0, supplierId);

    // Aktualizuj kategorie
    if (category_ids) {
      db.prepare('DELETE FROM supplier_categories WHERE supplier_id = ?').run(req.params.id);
      const insertCategory = db.prepare('INSERT INTO supplier_categories (supplier_id, category_id) VALUES (?, ?)');
      for (const catId of category_ids) {
        insertCategory.run(req.params.id, catId);
      }
    }

    res.json({ message: 'Dostawca zaktualizowany' });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Usuń dostawcę (admin)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM supplier_categories WHERE supplier_id = ?').run(req.params.id);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ message: 'Dostawca usunięty' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
