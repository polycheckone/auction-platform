const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken, requireAdmin, requireSupplier } = require('../middleware/auth');
const { auctionValidation, bidValidation, inviteValidation } = require('../middleware/validation');

module.exports = function(io) {
  const router = express.Router();

  // Aktywne aukcje z timeoutami
  const activeAuctions = new Map();

  // Funkcja kończąca aukcję
  const endAuction = (auctionId) => {
    const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
    if (!auction || auction.status !== 'active') return;

    // Znajdź najniższą ofertę
    const winningBid = db.prepare(`
      SELECT b.*, s.company_name
      FROM bids b
      JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.auction_id = ?
      ORDER BY b.amount ASC
      LIMIT 1
    `).get(auctionId);

    if (winningBid) {
      db.prepare(`
        UPDATE auctions
        SET status = 'completed', winner_id = ?, winning_bid = ?, end_time = ?
        WHERE id = ?
      `).run(winningBid.supplier_id, winningBid.amount, new Date().toISOString(), auctionId);

      io.to(`auction_${auctionId}`).emit('auction_ended', {
        auctionId,
        winner: {
          supplier_id: winningBid.supplier_id,
          company_name: winningBid.company_name,
          amount: winningBid.amount
        }
      });
    } else {
      db.prepare(`
        UPDATE auctions
        SET status = 'completed', end_time = ?
        WHERE id = ?
      `).run(new Date().toISOString(), auctionId);

      io.to(`auction_${auctionId}`).emit('auction_ended', {
        auctionId,
        winner: null,
        message: 'Aukcja zakończona bez ofert'
      });
    }

    activeAuctions.delete(auctionId);
    console.log(`Aukcja ${auctionId} zakończona`);
  };

  // Pobierz wszystkie aukcje
  router.get('/', authenticateToken, (req, res) => {
    try {
      const { status, material_id, page = 1, limit = 20 } = req.query;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;

      let baseQuery = `
        FROM auctions a
        LEFT JOIN materials m ON a.material_id = m.id
        LEFT JOIN material_categories c ON m.category_id = c.id
        LEFT JOIN suppliers w ON a.winner_id = w.id
        LEFT JOIN (
          SELECT auction_id, COUNT(*) as bids_count, MIN(amount) as lowest_bid
          FROM bids
          GROUP BY auction_id
        ) bid_stats ON a.id = bid_stats.auction_id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        baseQuery += ` AND a.status = ?`;
        params.push(status);
      }

      if (material_id) {
        baseQuery += ` AND a.material_id = ?`;
        params.push(material_id);
      }

      // Dla dostawców - pokaż tylko aukcje, do których są zaproszeni
      if (req.user.role === 'supplier') {
        const supplier = db.prepare('SELECT id FROM suppliers WHERE user_id = ?').get(req.user.id);
        if (supplier) {
          baseQuery += ` AND a.id IN (SELECT auction_id FROM auction_invitations WHERE supplier_id = ?)`;
          params.push(supplier.id);
        }
      }

      // Pobierz łączną liczbę wyników
      const countResult = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params);
      const total = countResult.total;

      // Pobierz aukcje z paginacją
      const query = `
        SELECT a.*,
               COALESCE(m.name, a.custom_material_name) as material_name,
               COALESCE(m.unit, a.custom_material_unit, a.unit) as material_unit,
               c.name as category_name, c.icon as category_icon,
               w.company_name as winner_name,
               COALESCE(bid_stats.bids_count, 0) as bids_count,
               bid_stats.lowest_bid
        ${baseQuery}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const auctions = db.prepare(query).all(...params, limitNum, offset);

      // Oblicz pozostały czas dla aktywnych aukcji
      for (const auction of auctions) {
        if (auction.status === 'active' && auction.end_time) {
          const remaining = new Date(auction.end_time) - new Date();
          auction.remaining_seconds = Math.max(0, Math.floor(remaining / 1000));
        }
      }

      res.json({
        data: auctions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Get auctions error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Pobierz pojedynczą aukcję
  router.get('/:id', authenticateToken, (req, res) => {
    try {
      const auction = db.prepare(`
        SELECT a.*,
               COALESCE(m.name, a.custom_material_name) as material_name,
               m.description as material_description,
               COALESCE(m.unit, a.custom_material_unit, a.unit) as material_unit,
               c.name as category_name, c.icon as category_icon,
               w.company_name as winner_name
        FROM auctions a
        LEFT JOIN materials m ON a.material_id = m.id
        LEFT JOIN material_categories c ON m.category_id = c.id
        LEFT JOIN suppliers w ON a.winner_id = w.id
        WHERE a.id = ?
      `).get(req.params.id);

      if (!auction) {
        return res.status(404).json({ error: 'Aukcja nie znaleziona' });
      }

      // Dla dostawców - sprawdź czy jest zaproszony
      let currentSupplierId = null;
      if (req.user.role === 'supplier') {
        const supplier = db.prepare('SELECT id FROM suppliers WHERE user_id = ?').get(req.user.id);
        if (supplier) {
          currentSupplierId = supplier.id;
          const invitation = db.prepare(`
            SELECT * FROM auction_invitations WHERE auction_id = ? AND supplier_id = ?
          `).get(auction.id, supplier.id);
          if (!invitation) {
            return res.status(403).json({ error: 'Nie masz dostępu do tej aukcji' });
          }
        }
      }

      // Pobierz zaproszonych dostawców (tylko dla admina)
      if (req.user.role === 'admin') {
        const invitations = db.prepare(`
          SELECT ai.*, s.company_name, s.city, s.is_local
          FROM auction_invitations ai
          JOIN suppliers s ON ai.supplier_id = s.id
          WHERE ai.auction_id = ?
        `).all(auction.id);
        auction.invitations = invitations;
      } else {
        // Dla dostawcy - pokaż tylko liczbę zaproszonych, nie szczegóły
        const invCount = db.prepare('SELECT COUNT(*) as count FROM auction_invitations WHERE auction_id = ?').get(auction.id);
        auction.invitations_count = invCount.count;
      }

      // Pobierz oferty (dla admina wszystkie, dla dostawcy tylko swoje)
      if (req.user.role === 'admin') {
        const bids = db.prepare(`
          SELECT b.*, s.company_name
          FROM bids b
          JOIN suppliers s ON b.supplier_id = s.id
          WHERE b.auction_id = ?
          ORDER BY b.amount ASC
        `).all(auction.id);
        auction.bids = bids;
      } else {
        if (currentSupplierId) {
          const myBids = db.prepare(`
            SELECT * FROM bids WHERE auction_id = ? AND supplier_id = ?
            ORDER BY created_at DESC
          `).all(auction.id, currentSupplierId);
          auction.my_bids = myBids;
        }

        // Pokaż najniższą ofertę tylko podczas aktywnej aukcji
        if (auction.status === 'active') {
          const lowestBid = db.prepare('SELECT MIN(amount) as lowest FROM bids WHERE auction_id = ?').get(auction.id);
          auction.lowest_bid = lowestBid.lowest;
        }
      }

      // Dla dostawców - ukryj informacje o zwycięzcy jeśli wyniki nie są opublikowane
      if (req.user.role === 'supplier' && auction.status === 'completed') {
        if (!auction.results_published) {
          // Ukryj wszystkie informacje o wyniku - dostawca nie wie kto wygrał
          auction.winner_id = null;
          auction.winner_name = null;
          auction.winning_bid = null;
          auction.results_hidden = true;
          // Nie ustawiamy you_won - dostawca dowie się dopiero po publikacji wyników
        } else {
          // Wyniki opublikowane - dostawca widzi tylko czy wygrał
          if (currentSupplierId && auction.winner_id === currentSupplierId) {
            auction.you_won = true;
          } else {
            // Przegrany nie widzi szczegółów zwycięzcy
            auction.winner_name = null;
            auction.winning_bid = null;
          }
        }
      }

      // Oblicz pozostały czas
      if (auction.status === 'active' && auction.end_time) {
        const remaining = new Date(auction.end_time) - new Date();
        auction.remaining_seconds = Math.max(0, Math.floor(remaining / 1000));
      }

      res.json(auction);
    } catch (error) {
      console.error('Get auction error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Utwórz aukcję (admin)
  router.post('/', authenticateToken, requireAdmin, auctionValidation, (req, res) => {
    try {
      const { title, description, material_id, custom_material_name, custom_material_unit, quantity, unit, duration_minutes, supplier_ids } = req.body;
      const id = `auc-${uuidv4().slice(0, 8)}`;

      db.prepare(`
        INSERT INTO auctions (id, title, description, material_id, custom_material_name, custom_material_unit, quantity, unit, duration_minutes, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(id, title, description, material_id || null, custom_material_name || null, custom_material_unit || null, quantity, unit, duration_minutes || 10, req.user.id);

      // Dodaj zaproszenia dla dostawców
      if (supplier_ids && supplier_ids.length > 0) {
        const insertInvitation = db.prepare(`
          INSERT INTO auction_invitations (id, auction_id, supplier_id, status)
          VALUES (?, ?, ?, 'pending')
        `);
        for (const supplierId of supplier_ids) {
          insertInvitation.run(`inv-${uuidv4().slice(0, 8)}`, id, supplierId);
        }
      }

      res.status(201).json({ id, message: 'Aukcja utworzona' });
    } catch (error) {
      console.error('Create auction error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Zaproś dostawców do aukcji (admin)
  router.post('/:id/invite', authenticateToken, requireAdmin, inviteValidation, (req, res) => {
    try {
      const { supplier_ids } = req.body;
      const auctionId = req.params.id;

      const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Aukcja nie znaleziona' });
      }

      if (auction.status !== 'pending') {
        return res.status(400).json({ error: 'Można zapraszać tylko do aukcji oczekujących' });
      }

      const insertInvitation = db.prepare(`
        INSERT OR IGNORE INTO auction_invitations (id, auction_id, supplier_id, status)
        VALUES (?, ?, ?, 'pending')
      `);

      for (const supplierId of supplier_ids) {
        insertInvitation.run(`inv-${uuidv4().slice(0, 8)}`, auctionId, supplierId);
      }

      res.json({ message: 'Dostawcy zaproszeni' });
    } catch (error) {
      console.error('Invite to auction error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Usuń dostawcę z aukcji (admin)
  router.delete('/:id/invite/:supplierId', authenticateToken, requireAdmin, (req, res) => {
    try {
      const { id: auctionId, supplierId } = req.params;

      const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Aukcja nie znaleziona' });
      }

      if (auction.status !== 'pending') {
        return res.status(400).json({ error: 'Można usuwać dostawców tylko przed uruchomieniem aukcji' });
      }

      const result = db.prepare('DELETE FROM auction_invitations WHERE auction_id = ? AND supplier_id = ?').run(auctionId, supplierId);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Dostawca nie był zaproszony do tej aukcji' });
      }

      res.json({ message: 'Dostawca usunięty z aukcji' });
    } catch (error) {
      console.error('Remove supplier from auction error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Uruchom aukcję (admin)
  router.post('/:id/start', authenticateToken, requireAdmin, (req, res) => {
    try {
      const auctionId = req.params.id;

      const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Aukcja nie znaleziona' });
      }

      if (auction.status !== 'pending') {
        return res.status(400).json({ error: 'Aukcja już została uruchomiona' });
      }

      // Sprawdź czy są zaproszeni dostawcy
      const invitations = db.prepare('SELECT COUNT(*) as count FROM auction_invitations WHERE auction_id = ?').get(auctionId);
      if (invitations.count === 0) {
        return res.status(400).json({ error: 'Zaproś przynajmniej jednego dostawcę' });
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + auction.duration_minutes * 60 * 1000);

      db.prepare(`
        UPDATE auctions
        SET status = 'active', start_time = ?, end_time = ?
        WHERE id = ?
      `).run(startTime.toISOString(), endTime.toISOString(), auctionId);

      // Ustaw timer zakończenia
      const timeout = setTimeout(() => endAuction(auctionId), auction.duration_minutes * 60 * 1000);
      activeAuctions.set(auctionId, timeout);

      // Powiadom przez Socket.io
      io.emit('auction_started', {
        auctionId,
        title: auction.title,
        end_time: endTime.toISOString(),
        duration_minutes: auction.duration_minutes
      });

      res.json({
        message: 'Aukcja uruchomiona',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      });
    } catch (error) {
      console.error('Start auction error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Złóż ofertę (dostawca)
  router.post('/:id/bid', authenticateToken, requireSupplier, bidValidation, (req, res) => {
    try {
      const { amount } = req.body;
      const auctionId = req.params.id;

      // Pobierz dostawcę
      const supplier = db.prepare('SELECT id FROM suppliers WHERE user_id = ?').get(req.user.id);
      if (!supplier) {
        return res.status(400).json({ error: 'Nie jesteś zarejestrowany jako dostawca' });
      }

      // Sprawdź czy aukcja istnieje i jest aktywna
      const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Aukcja nie znaleziona' });
      }

      if (auction.status !== 'active') {
        return res.status(400).json({ error: 'Aukcja nie jest aktywna' });
      }

      // Sprawdź czy dostawca jest zaproszony
      const invitation = db.prepare(`
        SELECT * FROM auction_invitations
        WHERE auction_id = ? AND supplier_id = ?
      `).get(auctionId, supplier.id);

      if (!invitation) {
        return res.status(403).json({ error: 'Nie jesteś zaproszony do tej aukcji' });
      }

      // Sprawdź czy czas nie minął
      const now = new Date();
      let currentEndTime = new Date(auction.end_time);
      if (currentEndTime < now) {
        return res.status(400).json({ error: 'Aukcja zakończona' });
      }

      // Dodaj ofertę
      const bidId = `bid-${uuidv4().slice(0, 8)}`;
      db.prepare(`
        INSERT INTO bids (id, auction_id, supplier_id, amount)
        VALUES (?, ?, ?, ?)
      `).run(bidId, auctionId, supplier.id, amount);

      // Aktualizuj status zaproszenia
      db.prepare(`
        UPDATE auction_invitations SET status = 'bid_placed'
        WHERE auction_id = ? AND supplier_id = ?
      `).run(auctionId, supplier.id);

      // Sprawdź czy jesteśmy w ostatniej minucie - jeśli tak, przedłuż o 30 sekund
      const remainingMs = currentEndTime - now;
      const ONE_MINUTE = 60 * 1000;
      const EXTENSION_SECONDS = 30;
      let timeExtended = false;
      let newEndTime = currentEndTime;

      if (remainingMs <= ONE_MINUTE) {
        // Przedłuż aukcję o 30 sekund
        newEndTime = new Date(currentEndTime.getTime() + EXTENSION_SECONDS * 1000);

        db.prepare(`UPDATE auctions SET end_time = ? WHERE id = ?`)
          .run(newEndTime.toISOString(), auctionId);

        // Zaktualizuj timer
        if (activeAuctions.has(auctionId)) {
          clearTimeout(activeAuctions.get(auctionId));
          const newTimeout = setTimeout(() => endAuction(auctionId), newEndTime - new Date());
          activeAuctions.set(auctionId, newTimeout);
        }

        timeExtended = true;
        console.log(`Aukcja ${auctionId} przedłużona o ${EXTENSION_SECONDS}s do ${newEndTime.toISOString()}`);
      }

      // Pobierz statystyki ofert jednym zapytaniem
      const bidStats = db.prepare('SELECT COUNT(*) as count, MIN(amount) as lowest FROM bids WHERE auction_id = ?').get(auctionId);

      // Powiadom wszystkich przez Socket.io
      const bidEvent = {
        auctionId,
        lowest_bid: bidStats.lowest,
        bids_count: bidStats.count,
        timestamp: new Date().toISOString()
      };

      // Dodaj informację o przedłużeniu czasu
      if (timeExtended) {
        bidEvent.time_extended = true;
        bidEvent.new_end_time = newEndTime.toISOString();
        bidEvent.extension_seconds = EXTENSION_SECONDS;
      }

      io.to(`auction_${auctionId}`).emit('new_bid', bidEvent);

      res.json({
        message: timeExtended ? `Oferta złożona. Czas aukcji przedłużony o ${EXTENSION_SECONDS}s` : 'Oferta złożona',
        bid_id: bidId,
        amount,
        lowest_bid: bidStats.lowest,
        time_extended: timeExtended,
        new_end_time: timeExtended ? newEndTime.toISOString() : undefined
      });
    } catch (error) {
      console.error('Place bid error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Opublikuj wyniki aukcji (admin)
  router.post('/:id/publish-results', authenticateToken, requireAdmin, (req, res) => {
    try {
      const auctionId = req.params.id;

      const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Aukcja nie znaleziona' });
      }

      if (auction.status !== 'completed') {
        return res.status(400).json({ error: 'Można publikować wyniki tylko zakończonych aukcji' });
      }

      if (auction.results_published) {
        return res.status(400).json({ error: 'Wyniki już zostały opublikowane' });
      }

      db.prepare(`UPDATE auctions SET results_published = 1 WHERE id = ?`).run(auctionId);

      res.json({ message: 'Wyniki aukcji opublikowane' });
    } catch (error) {
      console.error('Publish results error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Anuluj aukcję (admin)
  router.post('/:id/cancel', authenticateToken, requireAdmin, (req, res) => {
    try {
      const auctionId = req.params.id;

      const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Aukcja nie znaleziona' });
      }

      if (auction.status === 'completed' || auction.status === 'cancelled') {
        return res.status(400).json({ error: 'Aukcja już zakończona' });
      }

      // Anuluj timer jeśli istnieje
      if (activeAuctions.has(auctionId)) {
        clearTimeout(activeAuctions.get(auctionId));
        activeAuctions.delete(auctionId);
      }

      db.prepare(`UPDATE auctions SET status = 'cancelled' WHERE id = ?`).run(auctionId);

      io.to(`auction_${auctionId}`).emit('auction_cancelled', { auctionId });

      res.json({ message: 'Aukcja anulowana' });
    } catch (error) {
      console.error('Cancel auction error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Usuń aukcję (admin) - tylko zakończone lub anulowane
  router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
      const auctionId = req.params.id;

      const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!auction) {
        return res.status(404).json({ error: 'Aukcja nie znaleziona' });
      }

      if (auction.status === 'active') {
        return res.status(400).json({ error: 'Nie można usunąć aktywnej aukcji. Najpierw ją anuluj.' });
      }

      // Usuń powiązane dane
      db.prepare('DELETE FROM bids WHERE auction_id = ?').run(auctionId);
      db.prepare('DELETE FROM auction_invitations WHERE auction_id = ?').run(auctionId);
      db.prepare('DELETE FROM auctions WHERE id = ?').run(auctionId);

      console.log(`Aukcja ${auctionId} usunięta`);
      res.json({ message: 'Aukcja usunięta' });
    } catch (error) {
      console.error('Delete auction error:', error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  return router;
};
