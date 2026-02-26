# Changelog - Auction Platform

## 2026-02-26 - Deployment na Railway (PRODUKCJA)

### Deployment zakończony pomyślnie
Aplikacja działa na Railway.app

#### Naprawione błędy podczas deploymentu
| Błąd | Rozwiązanie |
|------|-------------|
| `uuid` ESM error | Zamiana `require('uuid')` na `crypto.randomUUID()` |
| Express 5 wildcard route | Zmiana `'*'` na `'/{*splat}'` |
| Baza pusta po deploy | Auto-seed w `npm start`: `node seed.js && node server.js` |
| CSRF blokuje login | Wyłączono CSRF (JWT w Authorization header jest CSRF-safe) |
| Frontend łączy z localhost | Dodano `frontend/.env.production` do Git |

#### Zmiany w plikach
- **backend/package.json**: `start: "node seed.js && node server.js"`
- **backend/server.js**: Wyłączono CSRF, naprawiono wildcard route
- **backend/routes/*.js**: `crypto.randomUUID()` zamiast `uuid`
- **backend/seed.js**: Dodano konta testowe dostawców
- **.gitignore**: Usunięto `frontend/.env.production` z wykluczeń

#### Konta testowe (produkcja)
| Rola | Email | Hasło |
|------|-------|-------|
| Admin | `admin@auction.pl` | `admin123` |
| Dostawca Brenntag | `dostawca@brenntag.pl` | `test123` |
| Dostawca CIECH | `dostawca@ciech.pl` | `test123` |

### Poprawki danych (seed.js)
- ✅ Usunięto duplikat Brenntag (scalono sup-077 i sup-078)
- ✅ Usunięto ALAMET (firma z Sosnowca, nie Szczecina)
- ✅ Dodano HELION S.C. (sup-088, NIP: 9552311300, Szczecin, koła i rolki)

### Nowa kategoria: Opakowania przemysłowe (cat-010)

#### Materiały
| ID | Nazwa |
|----|-------|
| mat-045 | Paletopojemniki IBC 1000L |
| mat-046 | Kanistry HDPE 5-60L |
| mat-047 | Beczki plastikowe 200L |
| mat-048 | Butelki PET/HDPE |
| mat-049 | Zakrętki i nakrętki |

#### Dostawcy opakowań
| Firma | Miasto | NIP |
|-------|--------|-----|
| DD-PACK Sp. z o.o. | Katowice | 6342803283 |
| IBC Service Recycling | Ustroń | 5482662072 |
| RECOFASS Sp. z o.o. | Kolechowice-Kolonia | 7142057781 |
| Opack Serwis Sp. z o.o. | Zielona Góra | 9731058042 |
| ChemPak Kutno | Kutno | 7752668069 |
| SUWARY Sp. z o.o. | Ksawerów | 7311007350 |

### Commity z tej sesji
```
7b53635 Add Opakowania przemysłowe category with materials and suppliers
567f1ae Fix: Apply missing data changes from previous session
4932a97 Add test supplier accounts to seed
3ad86a3 Fix: Disable CSRF (JWT is CSRF-safe), remove duplicate Brenntag
5d8434c Fix: Add frontend/.env.production for Railway build
4be516f Fix: Exclude auth endpoints from CSRF protection
db7d8e5 Fix: Auto-seed database on start
1b98c80 Fix: Update wildcard route for Express 5
8e2a9ac Fix: Replace uuid with crypto.randomUUID()
d6d73fb Initial commit: Auction Platform
```

---

## 2026-02-24 (część 3) - Przygotowanie do deploymentu

### Railway Deployment
Projekt przygotowany do uruchomienia na Railway.app

#### Nowe pliki
| Plik | Opis |
|------|------|
| `railway.toml` | Konfiguracja buildu Railway (Nixpacks) |
| `package.json` (root) | Monorepo - skrypty install/build/start |
| `.gitignore` | Wykluczenia: node_modules, .env, *.db |
| `.env.example` | Wzór zmiennych środowiskowych |
| `frontend/.env.production` | Produkcyjne URL-e (relative paths) |

#### Zmiany w kodzie
- **backend/server.js**: Serwowanie statycznych plików frontendu w produkcji
- **frontend/src/api.js**: Export `SOCKET_URL` dla centralnego zarządzania
- **frontend/src/pages/AuctionDetail.jsx**: Import SOCKET_URL z api.js

#### Zmienne środowiskowe (produkcja)
```
NODE_ENV=production
JWT_SECRET=<losowy-32-znakowy-klucz>
REFRESH_SECRET=<losowy-32-znakowy-klucz>
COOKIE_SECRET=<losowy-32-znakowy-klucz>
```

#### Status
- [x] Konfiguracja Railway
- [x] Build produkcyjny działa (728KB JS, 28KB CSS)
- [x] Git zainicjalizowany
- [ ] Wymaga: konfiguracji git user.email/user.name
- [ ] Wymaga: push do GitHub i połączenie z Railway

---

## 2026-02-24 (część 2)

### Mechanizm Refresh Tokenów

#### Backend
- **middleware/auth.js**: Access token 15min, Refresh token 7dni
- **routes/auth.js**: Nowe endpointy:
  - `POST /auth/refresh` - odświeżanie access tokenu
  - `POST /auth/logout` - unieważnienie refresh tokenu
  - `POST /auth/logout-all` - wylogowanie ze wszystkich urządzeń
- **database.js**: Tabela `refresh_tokens` z TTL i indeksami
- Przy zmianie hasła automatyczne unieważnienie wszystkich tokenów

#### Frontend
- **api.js**: Interceptor automatycznie odświeża token przy 401/TOKEN_EXPIRED
- **AuthContext.jsx**: Obsługa accessToken + refreshToken
- Kolejkowanie requestów podczas odświeżania tokenu

### Walidacja formularzy

- **category_id**: Sprawdzenie formatu `/^cat-[a-z0-9]+$/i`
- **supplier_ids**: Walidacja każdego elementu tablicy `/^sup-[a-z0-9]+$/i`
- **NIP**: Walidacja sumy kontrolnej (algorytm z wagami 6,5,7,2,3,4,5,6,7)

### Optymalizacje bezpieczeństwa

| Zmiana | Plik |
|--------|------|
| Env vars wymagane w produkcji | `middleware/auth.js` |
| `VITE_API_URL`, `VITE_SOCKET_URL` | `frontend/.env` |
| `REFRESH_SECRET`, `BACKEND_URL` | `backend/.env` |
| Autentykacja na GET /materials | `routes/materials.js` |
| Rate limiting NIP lookup (10/min) | `routes/suppliers.js` |
| Cache NIP (1h) | `middleware/rateLimiter.js` |
| Activation link z env var | `routes/suppliers.js` |

### Optymalizacje wydajności

#### Nowy endpoint `/api/stats/dashboard`
- 1 zapytanie API zamiast 5 osobnych
- Zwraca: kategorie, dostawcy, aukcje, topSuppliers, totalAuctionValue, recentAuctions

#### Inkrementalne aktualizacje ofert
- Socket `new_bid` aktualizuje tylko zmienione dane
- Bez pełnego przeładowania aukcji przy każdej ofercie

#### Debounce na wyszukiwarkach
- `hooks/useDebounce.js` - reusable hook (300ms)
- Suppliers.jsx - wyszukiwanie dostawców
- AuctionDetail.jsx - filtrowanie w modalu (200ms)

#### Nowe indeksy bazy danych
```sql
idx_auctions_winner, idx_auctions_created_by,
idx_users_email, idx_suppliers_nip, idx_suppliers_company_name
```

### Architektura i komponenty

| Nowy plik | Opis |
|-----------|------|
| `components/Pagination.jsx` | Reusable komponent paginacji |
| `context/ToastContext.jsx` | Centralne powiadomienia (success/error/warning/info) |
| `hooks/useDebounce.js` | Hook do debounce'owania wartości |
| `utils/addressParser.js` | Funkcja parseAddress wydzielona z routes |
| `middleware/rateLimiter.js` | Rate limiter + SimpleCache |

### Dashboard - ulepszenia

- Łączna wartość zakończonych aukcji (totalAuctionValue)
- Top 5 dostawców z największą liczbą wygranych
- Układ dwukolumnowy (recent auctions + top suppliers)

### Nowy materiał: Inne

- Kategoria: **Inne materiały** (cat-008)
- Materiał: **Inne - do określenia w aukcji**
- Do użycia dla aukcji nie pasujących do pozostałych kategorii

---

## 2026-02-24

### Poprawki walidacji formularzy

#### Formularz dostawcy (Suppliers.jsx, validation.js)
- Automatyczne czyszczenie NIP z myślników i spacji przed wysłaniem
- Szczegółowe komunikaty błędów walidacji (pokazuje które pole i dlaczego)
- Pola opcjonalne (email, NIP, telefon, miasto, adres) akceptują teraz puste stringi - `optional({ values: 'falsy' })`

#### Naprawa wyświetlania "0" przy dostawcach
- Problem: `{supplier.is_local && '...'}` zwracało `0` dla nielokalnych dostawców
- Rozwiązanie: Zamiana na `{supplier.is_local ? '...' : null}` w Suppliers.jsx i Materials.jsx

### Zarządzanie dostawcami w aukcji

#### Backend (routes/auctions.js)
- Nowy endpoint: `DELETE /api/auctions/:id/invite/:supplierId` - usuwa dostawcę z aukcji
- Działa tylko przed uruchomieniem aukcji (status = pending)

#### Frontend (AuctionDetail.jsx)
- Przycisk "✕" przy każdym dostawcy do usunięcia z listy
- Przycisk "+ Dodaj" otwiera modal wyboru dostawców
- Modal jest **przesuwany** (draggable) - można podejrzeć listę już dodanych
- Wyszukiwanie dostawców po nazwie lub NIP (obsługuje NIP z kreskami i bez)
- Nowe style CSS: `.modal-draggable`, `.modal-drag-handle`, `.search-input-wrapper`

### Ukrywanie wyników aukcji

- Naprawiono błąd: dostawca widział "Gratulacje" przed publikacją wyników
- Teraz dostawca dowiaduje się o wygranej dopiero po kliknięciu "Opublikuj wyniki" przez admina

### Wyszukiwanie dostawców (Suppliers.jsx)

- Naprawiono utratę focusu pola wyszukiwania przy każdej literze
- Loading pokazuje się tylko w sekcji listy, nie blokuje całego UI

### Nowa kategoria: Opakowania przemysłowe 🧴

Materiały:
- Paletopojemniki IBC 1000L
- Kanistry HDPE 5-60L
- Beczki plastikowe 200L
- Butelki PET/HDPE
- Zakrętki i nakrętki

### Nowi dostawcy opakowań

| Firma | Miasto | NIP |
|-------|--------|-----|
| DD-PACK Sp. z o.o. | Katowice | 6342803283 |
| IBC Service Recycling | Ustroń | 5482662072 |
| RECOFASS Sp. z o.o. | Kolechowice-Kolonia | 7142057781 |
| Opack Serwis Sp. z o.o. | Zielona Góra | 9731058042 |
| ChemPak Kutno | Kutno | 7752668069 |
| SUWARY Sp. z o.o. | Ksawerów | 7311007350 |

### Konta testowe

- Admin: `admin@auction.pl` / `admin123`
- Dostawca Brenntag: `dostawca@brenntag.pl` / `test123`
- Dostawca CIECH: `dostawca@ciech.pl` / `test123`

---

## 2026-02-23

### Optymalizacje wydajności

#### 1. Indeksy SQL (database.js)
Dodano 10 indeksów dla przyspieszenia zapytań:
```sql
CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_supplier_id ON bids(supplier_id);
CREATE INDEX idx_auction_invitations_auction ON auction_invitations(auction_id);
CREATE INDEX idx_auction_invitations_supplier ON auction_invitations(supplier_id);
CREATE INDEX idx_supplier_categories_supplier ON supplier_categories(supplier_id);
CREATE INDEX idx_supplier_categories_category ON supplier_categories(category_id);
CREATE INDEX idx_materials_category ON materials(category_id);
CREATE INDEX idx_suppliers_user ON suppliers(user_id);
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_material ON auctions(material_id);
```

#### 2. Eliminacja problemu N+1 (Backend)
- **auctions.js**: Zamiast 101 zapytań dla 50 aukcji - teraz 1 zapytanie z LEFT JOIN subquery
- **suppliers.js**: Zamiast 101 zapytań dla 100 dostawców - teraz 2 zapytania (batch load kategorii)

#### 3. React - useCallback/useMemo (Frontend)
- **Suppliers.jsx**: Dodano useCallback dla wszystkich handlerów
- **CreateAuction.jsx**: Dodano useCallback + useMemo dla filtrowanych list dostawców

#### 4. Paginacja
**Backend (auctions.js, suppliers.js)**:
- Parametry: `page` (domyślnie 1), `limit` (domyślnie 20, max 100)
- Odpowiedź: `{ data: [...], pagination: { page, limit, total, totalPages } }`

**Frontend**:
- Auctions.jsx, Suppliers.jsx - kontrolki paginacji
- Dashboard.jsx - używa pagination.total dla statystyk
- CreateAuction.jsx - pobiera wszystkich dostawców (limit: 100)
- App.css - style dla .pagination, .btn-page, .page-info

---

### Funkcjonalności (wcześniej w sesji)

#### Własne materiały w aukcjach
- Możliwość dodania własnego materiału (nie z listy)
- Nowe kolumny: `custom_material_name`, `custom_material_unit`
- Toggle "Z listy" / "Własny materiał" w CreateAuction.jsx

#### Dostawcy spoza kategorii
- Sekcja "Pozostali dostawcy" z wyszukiwaniem
- Możliwość zaproszenia dowolnego dostawcy do aukcji

#### Anti-sniping
- Oferta w ostatniej minucie przedłuża aukcję o 30 sekund
- Powiadomienie przez Socket.io o przedłużeniu czasu

#### Usuwanie aukcji
- Admin może usunąć zakończone/anulowane aukcje
- Endpoint: DELETE /api/auctions/:id

#### Bezpieczeństwo
- express-validator - walidacja formularzy
- xss - sanityzacja HTML
- helmet - HTTP Security Headers
- express-rate-limit - max 5 prób logowania/minutę
- CSRF protection (double submit cookie)

#### UI/UX
- Widok listy/siatki dla dostawców i kategorii materiałów
- Wyszukiwanie dostawców po nazwie i NIP
- Pobieranie danych firmy z API Ministerstwa Finansów (NIP lookup)

---

### Baza danych - zmiany
- Usunięto duplikat Brenntag (scalono sup-077 i sup-078)
- Usunięto ALAMET (firma z Sosnowca, nie Szczecina)
- Dodano HELION S.C. (NIP 9552311300, Szczecin, kategoria: Koła i rolki)

---

### Do zrobienia w przyszłości
- React Query/SWR dla cache'owania API
- Lazy loading komponentów
- Virtualizacja długich list (react-window)
- Eksport danych do Excel/PDF
- Powiadomienia email (nodemailer)
- Historia zmian aukcji (audit log)
