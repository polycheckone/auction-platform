const db = require('./database');
const { v4: uuidv4 } = require('uuid');

// Znajdź materiał z kategorii surowce chemiczne
const material = db.prepare("SELECT * FROM materials WHERE category_id = 'cat-009' LIMIT 1").get();
console.log('Materiał:', material?.name);

// Utwórz aukcję
const auctionId = 'auc-test-' + uuidv4().slice(0, 6);
db.prepare(`
  INSERT INTO auctions (id, title, material_id, quantity, unit, description, status, duration_minutes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
`).run(
  auctionId,
  'SYMULACJA: Zakup kwasu siarkowego',
  material?.id || null,
  1000,
  'kg',
  'Aukcja testowa do demonstracji systemu licytacji',
  5  // 5 minut
);

// Zaproś Brenntag i CIECH
db.prepare('INSERT INTO auction_invitations (id, auction_id, supplier_id, status) VALUES (?, ?, ?, ?)').run(
  'inv-' + uuidv4().slice(0, 8), auctionId, 'sup-078', 'pending'
);
db.prepare('INSERT INTO auction_invitations (id, auction_id, supplier_id, status) VALUES (?, ?, ?, ?)').run(
  'inv-' + uuidv4().slice(0, 8), auctionId, 'sup-080', 'pending'
);

console.log('Aukcja utworzona:', auctionId);
console.log('Zaproszeni: Brenntag Polska, CIECH S.A.');
console.log('');
console.log('Otwórz w przeglądarce:');
console.log('  Admin: http://localhost:5173 (admin@auction.pl / admin123)');
console.log('  Dostawca 1: http://localhost:5173 (dostawca@brenntag.pl / test123)');
console.log('  Dostawca 2: http://localhost:5173 (dostawca@ciech.pl / test123)');
