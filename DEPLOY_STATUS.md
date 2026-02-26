# Status Deploymentu - W TRAKCIE TESTÓW

## DO ZROBIENIA (następna sesja)
1. ~~Utworzyć stronę /activate~~ - ZROBIONE
2. **Dodać FRONTEND_URL w Railway** - `FRONTEND_URL=https://auction-platform-production-e7a6.up.railway.app`
3. **KRYTYCZNE: Przejść na PostgreSQL** - SQLite nie działa na Railway (ephemeral filesystem)
4. Przetestować pełny flow zapraszania dostawcy

## Problem z bazą danych
Railway ma "ephemeral filesystem" - SQLite jest kasowana przy każdym restarcie kontenera.
Rozwiązanie: migracja na PostgreSQL (Railway oferuje darmową bazę PostgreSQL).

## URL produkcyjny
https://auction-platform-production-e7a6.up.railway.app

---

# Status Deploymentu - UKOŃCZONY

## Data: 2026-02-26

## Aplikacja DZIAŁA na Railway

### URL produkcyjny
Sprawdź w Railway Dashboard -> projekt -> Settings -> Domains

### Konta testowe
| Rola | Email | Hasło |
|------|-------|-------|
| Admin | admin@auction.pl | admin123 |
| Dostawca Brenntag | dostawca@brenntag.pl | test123 |
| Dostawca CIECH | dostawca@ciech.pl | test123 |

## Zmienne środowiskowe (Railway Variables)
```
NODE_ENV=production
JWT_SECRET=b87423c7c56944ead7a23fd6a1c92cf59ba5a3b4ec6cda4d0b8dbcfb4ca031a7
REFRESH_SECRET=9200996cf0af4f1e7e1c3551f08e4d48b655d7f01e57cdb494229137a5185159
COOKIE_SECRET=d8e3fe9cdf57f8a5c27fb7732b86b6dace7d23e05d906812fa3c3fac291a2645
```

## Jak deployować zmiany
```bash
cd C:\Project\M5\auction-platform
git add .
git commit -m "Opis zmiany"
git push
```
Railway automatycznie zbuduje i wdroży nową wersję (2-3 min).

## Problemy naprawione podczas deploymentu

1. **uuid ESM error** - Node.js 22 nie obsługuje `require('uuid')` dla nowej wersji
   - Rozwiązanie: `crypto.randomUUID()` (wbudowane w Node.js)

2. **Express 5 wildcard** - `'*'` nie działa w Express 5
   - Rozwiązanie: `'/{*splat}'`

3. **Pusta baza danych** - Railway tworzy nową bazę przy każdym deploy
   - Rozwiązanie: `npm start` uruchamia `seed.js` przed serwerem

4. **CSRF blokuje logowanie** - Brak tokenu CSRF przy pierwszym requeście
   - Rozwiązanie: Wyłączono CSRF (JWT jest już CSRF-safe)

5. **Frontend łączy z localhost** - `.env.production` był w `.gitignore`
   - Rozwiązanie: Usunięto z `.gitignore`, dodano do repo

## Struktura projektu
```
auction-platform/
├── backend/
│   ├── server.js          # Serwer Express + Socket.io
│   ├── database.js        # SQLite + tabele
│   ├── seed.js            # Dane początkowe
│   ├── routes/            # API endpoints
│   └── middleware/        # Auth, validation, rate limiting
├── frontend/
│   ├── src/
│   │   ├── pages/         # React komponenty stron
│   │   ├── components/    # Reusable komponenty
│   │   ├── context/       # Auth, Toast context
│   │   └── api.js         # Axios + interceptory
│   └── .env.production    # VITE_API_URL=/api
├── package.json           # Root - monorepo scripts
├── railway.toml           # Konfiguracja Railway
└── CHANGELOG.md           # Historia zmian
```

## Dane w bazie (seed.js)
- 10 kategorii materiałów
- 49 materiałów
- 94 dostawców (w tym 6 opakowań przemysłowych)
- 1 admin + 2 konta dostawców testowych
