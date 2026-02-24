const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Pobierz wszystkie statystyki dla dashboardu w jednym zapytaniu
router.get('/dashboard', authenticateToken, requireAdmin, (req, res) => {
  try {
    // Wszystkie statystyki w jednym zapytaniu (lub kilku zoptymalizowanych)
    const stats = {};

    // Liczba kategorii
    stats.categoriesCount = db.prepare('SELECT COUNT(*) as count FROM material_categories').get().count;

    // Liczba materiałów
    stats.materialsCount = db.prepare('SELECT COUNT(*) as count FROM materials').get().count;

    // Liczba dostawców
    stats.suppliersCount = db.prepare('SELECT COUNT(*) as count FROM suppliers').get().count;

    // Statystyki aukcji
    const auctionStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM auctions
    `).get();

    stats.auctionsTotal = auctionStats.total;
    stats.auctionsActive = auctionStats.active;
    stats.auctionsPending = auctionStats.pending;
    stats.auctionsCompleted = auctionStats.completed;
    stats.auctionsCancelled = auctionStats.cancelled;

    // Ostatnie aukcje (do 5)
    stats.recentAuctions = db.prepare(`
      SELECT a.id, a.title, a.status, a.created_at,
             m.name as material_name,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bids_count
      FROM auctions a
      LEFT JOIN materials m ON a.material_id = m.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `).all();

    // Dostawcy z największą liczbą wygranych aukcji
    stats.topSuppliers = db.prepare(`
      SELECT s.id, s.company_name, s.city, COUNT(a.id) as wins
      FROM suppliers s
      JOIN auctions a ON a.winner_id = s.id
      WHERE a.status = 'completed'
      GROUP BY s.id
      ORDER BY wins DESC
      LIMIT 5
    `).all();

    // Suma wartości zakończonych aukcji
    const totalValue = db.prepare(`
      SELECT SUM(winning_bid) as total
      FROM auctions
      WHERE status = 'completed' AND winning_bid IS NOT NULL
    `).get();
    stats.totalAuctionValue = totalValue.total || 0;

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Błąd pobierania statystyk' });
  }
});

module.exports = router;
