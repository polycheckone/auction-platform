const db = require('./database');
const crypto = require('crypto');

// Najpierw dodaj kategorię "Opakowania przemysłowe" jeśli nie istnieje
const existingCategory = db.prepare("SELECT id FROM material_categories WHERE name LIKE '%Opakowania%'").get();

let categoryId;
if (!existingCategory) {
  categoryId = 'cat-010';
  db.prepare(`
    INSERT INTO material_categories (id, name, icon, description, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(categoryId, 'Opakowania przemysłowe', '📦', 'Kanistry, paletopojemniki IBC, beczki, butelki');
  console.log('Dodano kategorię: Opakowania przemysłowe');
} else {
  categoryId = existingCategory.id;
  console.log('Kategoria już istnieje:', categoryId);
}

// Dostawcy opakowań chemicznych
const suppliers = [
  {
    company_name: 'DD-PACK Sp. z o.o.',
    nip: '6342803283',
    city: 'Katowice',
    region: 'śląskie',
    address: 'ul. Modelarska 25',
    website: 'dd-pack.com.pl',
    description: 'Producent kontenerów IBC 1000L i opakowań HDPE 1-1000L'
  },
  {
    company_name: 'IBC Service Recycling Sp. z o.o.',
    nip: '5482662072',
    city: 'Ustroń',
    region: 'śląskie',
    address: 'ul. Daszyńskiego 64',
    website: 'ibcservice.com.pl',
    description: 'Serwis i sprzedaż paletopojemników IBC, beczek, kanistrów'
  },
  {
    company_name: 'RECOFASS Sp. z o.o.',
    nip: '7142057781',
    city: 'Kolechowice-Kolonia',
    region: 'lubelskie',
    address: '',
    website: 'recofass.pl',
    description: 'Skup, mycie i sprzedaż pojemników IBC, beczek, kanistrów'
  },
  {
    company_name: 'Opack Serwis Sp. z o.o.',
    nip: '9731058042',
    city: 'Zielona Góra',
    region: 'lubuskie',
    address: 'ul. Błotna 20A',
    website: 'opackserwis.pl',
    description: 'Producent opakowań PET i HDPE - butelki, kanistry, słoiki'
  },
  {
    company_name: 'ChemPak Kutno Sp. z o.o.',
    nip: '7752668069',
    city: 'Kutno',
    region: 'łódzkie',
    address: 'ul. Grunwaldzka 79',
    website: 'chempakkutno.pl',
    description: 'Producent butelek PET/HDPE, zakrętek - branża chemiczna, farmaceutyczna'
  }
];

// Dodaj dostawców
const insertSupplier = db.prepare(`
  INSERT INTO suppliers (id, company_name, nip, address, city, region, website, description, is_local, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
`);

const insertCategory = db.prepare(`
  INSERT INTO supplier_categories (supplier_id, category_id) VALUES (?, ?)
`);

let added = 0;
for (const s of suppliers) {
  // Sprawdź czy dostawca już istnieje (po NIP)
  const exists = db.prepare('SELECT id FROM suppliers WHERE nip = ?').get(s.nip);
  if (exists) {
    console.log(`Pomijam (już istnieje): ${s.company_name}`);
    continue;
  }

  const id = `sup-${crypto.randomUUID().slice(0, 8)}`;
  insertSupplier.run(id, s.company_name, s.nip, s.address, s.city, s.region, s.website, s.description);
  insertCategory.run(id, categoryId);
  console.log(`Dodano: ${s.company_name} (${s.city})`);
  added++;
}

console.log(`\nDodano ${added} dostawców opakowań przemysłowych.`);

// Dodaj też materiały do nowej kategorii
const existingMaterials = db.prepare('SELECT COUNT(*) as count FROM materials WHERE category_id = ?').get(categoryId);
if (existingMaterials.count === 0) {
  const materials = [
    { name: 'Paletopojemniki IBC 1000L', unit: 'szt.', description: 'Kontenery na ciecze, nowe i regenerowane' },
    { name: 'Kanistry HDPE 5-60L', unit: 'szt.', description: 'Kanistry z certyfikatem UN/ADR' },
    { name: 'Beczki plastikowe 200L', unit: 'szt.', description: 'Beczki HDPE z pokrywą lub korkiem' },
    { name: 'Butelki PET/HDPE', unit: 'szt.', description: 'Butelki do chemii, farmacji, kosmetyków' },
    { name: 'Zakrętki i nakrętki', unit: 'szt.', description: 'Zamknięcia do butelek i kanistrów' }
  ];

  const insertMaterial = db.prepare(`
    INSERT INTO materials (id, category_id, name, description, unit, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  for (const m of materials) {
    const id = `mat-${crypto.randomUUID().slice(0, 8)}`;
    insertMaterial.run(id, categoryId, m.name, m.description, m.unit);
  }
  console.log('Dodano 5 materiałów do kategorii Opakowania przemysłowe');
}
