const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'auction.db'));

// Tworzenie tabel
db.exec(`
  -- Tabela użytkowników (admin i dostawcy)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    role TEXT DEFAULT 'supplier',
    invitation_token TEXT,
    invitation_expires TEXT,
    is_active INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabela kategorii surowców
  CREATE TABLE IF NOT EXISTS material_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabela surowców/produktów
  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    category_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT DEFAULT 'szt.',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES material_categories(id)
  );

  -- Tabela dostawców (firmy)
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    company_name TEXT NOT NULL,
    nip TEXT,
    address TEXT,
    city TEXT,
    region TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    description TEXT,
    is_local INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Tabela przypisania dostawców do kategorii
  CREATE TABLE IF NOT EXISTS supplier_categories (
    supplier_id TEXT,
    category_id TEXT,
    PRIMARY KEY (supplier_id, category_id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (category_id) REFERENCES material_categories(id)
  );

  -- Tabela aukcji
  CREATE TABLE IF NOT EXISTS auctions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    material_id TEXT,
    quantity REAL,
    unit TEXT,
    start_time TEXT,
    end_time TEXT,
    duration_minutes INTEGER DEFAULT 10,
    status TEXT DEFAULT 'pending',
    winner_id TEXT,
    winning_bid REAL,
    results_published INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id),
    FOREIGN KEY (winner_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Tabela zaproszeń do aukcji
  CREATE TABLE IF NOT EXISTS auction_invitations (
    id TEXT PRIMARY KEY,
    auction_id TEXT,
    supplier_id TEXT,
    invited_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (auction_id) REFERENCES auctions(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- Tabela ofert (bids)
  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    auction_id TEXT,
    supplier_id TEXT,
    amount REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (auction_id) REFERENCES auctions(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  -- Tabela refresh tokenów
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Dodanie domyślnego admina (hasło: admin123)
  INSERT OR IGNORE INTO users (id, email, password, name, role, is_active)
  VALUES ('admin-001', 'admin@auction.pl', '$2a$10$XQxBtJXKQZPHJZMGHqQxXeZQZXQxBtJXKQZPHJZMGHqQxXeZQZXQx', 'Administrator', 'admin', 1);
`);

// Migracja: dodanie kolumny results_published jeśli nie istnieje
try {
  db.exec(`ALTER TABLE auctions ADD COLUMN results_published INTEGER DEFAULT 0`);
  console.log('Dodano kolumnę results_published');
} catch (e) {
  // Kolumna już istnieje
}

// Migracja: dodanie kolumn dla własnego materiału
try {
  db.exec(`ALTER TABLE auctions ADD COLUMN custom_material_name TEXT`);
  console.log('Dodano kolumnę custom_material_name');
} catch (e) {
  // Kolumna już istnieje
}

try {
  db.exec(`ALTER TABLE auctions ADD COLUMN custom_material_unit TEXT`);
  console.log('Dodano kolumnę custom_material_unit');
} catch (e) {
  // Kolumna już istnieje
}

// Indeksy dla optymalizacji zapytań
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_bids_auction_id ON bids(auction_id);
  CREATE INDEX IF NOT EXISTS idx_bids_supplier_id ON bids(supplier_id);
  CREATE INDEX IF NOT EXISTS idx_auction_invitations_auction ON auction_invitations(auction_id);
  CREATE INDEX IF NOT EXISTS idx_auction_invitations_supplier ON auction_invitations(supplier_id);
  CREATE INDEX IF NOT EXISTS idx_supplier_categories_supplier ON supplier_categories(supplier_id);
  CREATE INDEX IF NOT EXISTS idx_supplier_categories_category ON supplier_categories(category_id);
  CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category_id);
  CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);
  CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
  CREATE INDEX IF NOT EXISTS idx_auctions_material ON auctions(material_id);
  CREATE INDEX IF NOT EXISTS idx_auctions_winner ON auctions(winner_id);
  CREATE INDEX IF NOT EXISTS idx_auctions_created_by ON auctions(created_by);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_suppliers_nip ON suppliers(nip);
  CREATE INDEX IF NOT EXISTS idx_suppliers_company_name ON suppliers(company_name);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
`);

console.log('Baza danych zainicjalizowana');

module.exports = db;
