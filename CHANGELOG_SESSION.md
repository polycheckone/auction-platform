# Zmiany wprowadzone w sesji - 2026-02-19

## 1. Ograniczenie widoku dla dostawców

### Frontend - Layout.jsx
- Ukryto menu Dashboard, Surowce, Dostawcy dla roli supplier
- Dostawca widzi tylko zakładkę "Aukcje"

### Frontend - App.jsx
- Dodano komponent `SupplierRedirect` - przekierowuje dostawców na /auctions
- Opakowano trasy /, /materials, /suppliers w SupplierRedirect
- Dostawca nie ma dostępu do stron admina

## 2. Ukrywanie wyników aukcji dla dostawców

### Backend - database.js
- Dodano kolumnę `results_published` (INTEGER DEFAULT 0) do tabeli auctions
- Dodano migrację ALTER TABLE dla istniejących baz

### Backend - routes/auctions.js
- Zmodyfikowano GET /:id - ukrywa wyniki dla dostawców jeśli results_published = 0
- Dostawca nie widzi listy zaproszonych dostawców (tylko liczbę)
- Dostawca nie widzi szczegółowych statystyk po zakończeniu aukcji
- Dodano endpoint POST /:id/publish-results (admin) - publikuje wyniki

### Frontend - api.js
- Dodano `publishAuctionResults(id)`

### Frontend - AuctionDetail.jsx
- Dodano przycisk "Opublikuj wyniki" dla admina
- Różne widoki dla admina i dostawcy:
  - Admin: pełne informacje o zwycięzcy
  - Dostawca przed publikacją: "Wyniki zostaną udostępnione przez administratora"
  - Zwycięzca po publikacji: "Gratulacje! Wygrałeś tę aukcję!"
  - Przegrany po publikacji: "Dziękujemy za udział. Twoja oferta nie została wybrana"

## 3. Wykres licytacji dla admina

### Frontend - package.json
- Dodano zależność: recharts

### Frontend - AuctionDetail.jsx
- Dodano import Recharts (LineChart, Line, XAxis, YAxis, etc.)
- Dodano `chartData` useMemo - przygotowuje dane do wykresu
- Dodano `CustomTooltip` - niestandardowy tooltip
- Dodano sekcję wykresu pokazującą:
  - Zielona linia "stepAfter" - najniższa cena w czasie
  - Niebieskie punkty - wszystkie oferty
  - Legenda dostawców z kolorami
- Wykres aktualizuje się w czasie rzeczywistym (przeładowanie przy new_bid)

### Frontend - App.css
- Dodano style: .bids-chart-section, .chart-container, .chart-tooltip, .chart-legend

## 4. Lista dostawców przy wyborze surowca

### Frontend - Materials.jsx
- Dodano stany: selectedMaterial, suppliers, suppliersLoading, selectedSuppliers
- Dodano stany: auctionModal, auctionForm
- Dodano useEffect ładujący dostawców dla wybranego materiału
- Dodano handlery: handleSelectMaterial, toggleSupplier, selectAllSuppliers, openAuctionModal, handleCreateAuction
- Kliknięcie na wiersz materiału pokazuje panel dostawców
- Panel pozwala zaznaczyć dostawców i utworzyć aukcję

### Frontend - App.css
- Dodano style: .material-row, .suppliers-panel, .supplier-checkbox-item
- Dodano style: .auction-summary, .form-row, .invited-suppliers-preview, .supplier-tags

## 5. Pobieranie danych firmy po NIP

### Backend - routes/suppliers.js
- Dodano endpoint GET /lookup/nip/:nip
- Pobiera dane z API Ministerstwa Finansów (wl-api.mf.gov.pl)
- Parsuje adres na ulicę, miasto, kod pocztowy
- Zwraca: company_name, nip, regon, krs, address, city, postal_code, status, accountNumbers

### Frontend - api.js
- Dodano `lookupNIP(nip)`

### Frontend - Suppliers.jsx
- Dodano stan: nipLoading
- Dodano handler: handleNipLookup
- Zmodyfikowano pole NIP - dodano przycisk "Pobierz z KRS"
- Automatyczne wypełnienie formularza danymi z API
- Automatyczne oznaczenie jako "lokalny" jeśli miasto = Szczecin

### Frontend - App.css
- Dodano style: .nip-input-group, .btn-nip-lookup

## 6. Dodatkowe style CSS (App.css)

- .stats-hidden - ukryte statystyki
- .results-status, .results-status.unpublished, .results-status.published
- .results-pending, .you-won-hint, .you-won, .auction-lost
- .winner-section.no-winner
- .btn-success, .btn-success.full-width

---

## Pliki zmodyfikowane:

### Backend:
- backend/database.js
- backend/routes/auctions.js
- backend/routes/suppliers.js

### Frontend:
- frontend/package.json (dodano recharts)
- frontend/src/api.js
- frontend/src/App.jsx
- frontend/src/App.css
- frontend/src/components/Layout.jsx
- frontend/src/pages/AuctionDetail.jsx
- frontend/src/pages/Materials.jsx
- frontend/src/pages/Suppliers.jsx

---

## Konto testowe dostawcy:
- Email: dostawca@brenntag.pl
- Hasło: test123

## API do testów NIP:
- Brenntag: szukaj właściwego NIP w KRS
- CIECH/Qemetica: 1180019377
- GUS (test): 5261040828
