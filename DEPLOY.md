# Deployment - Platforma Aukcyjna

## Opcja 1: Render.com (Rekomendowane - Darmowe)

### Krok 1: Przygotowanie repozytorium
```bash
cd C:\Project\M5\auction-platform
git init
git add .
git commit -m "Initial commit"
```

### Krok 2: GitHub
1. Utwórz nowe repozytorium na GitHub
2. Połącz i wyślij:
```bash
git remote add origin https://github.com/TWOJ_USER/auction-platform.git
git branch -M main
git push -u origin main
```

### Krok 3: Deploy na Render
1. Idź na https://render.com i zaloguj się przez GitHub
2. Kliknij "New" → "Web Service"
3. Wybierz repozytorium `auction-platform`
4. Ustawienia:
   - **Name:** auction-platform
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free

5. Dodaj Environment Variables:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = (kliknij Generate)
   - `JWT_REFRESH_SECRET` = (kliknij Generate)
   - `COOKIE_SECRET` = (kliknij Generate)

6. Kliknij "Create Web Service"

### Krok 4: Poczekaj na deploy
- Build zajmie ~3-5 minut
- Aplikacja będzie dostępna pod adresem: `https://auction-platform.onrender.com`

---

## Opcja 2: Railway.app (Darmowe z limitem)

1. Idź na https://railway.app
2. Zaloguj się przez GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Wybierz repozytorium
5. Railway automatycznie wykryje Node.js
6. Dodaj zmienne środowiskowe (jak wyżej)

---

## Opcja 3: Fly.io (Darmowe z limitem)

```bash
# Zainstaluj CLI
curl -L https://fly.io/install.sh | sh

# Zaloguj się
fly auth login

# Deploy
cd C:\Project\M5\auction-platform
fly launch
fly deploy
```

---

## Dane testowe po deploymencie

| Użytkownik | Email | Hasło |
|------------|-------|-------|
| Admin | admin@auction.pl | admin123 |
| Dostawca 1 | dostawca@brenntag.pl | test123 |
| Dostawca 2 | dostawca@ciech.pl | test123 |

---

## Uwagi

- **SQLite** - baza danych jest w pliku, resetuje się przy każdym nowym deploymencie na darmowych planach
- **Free tier limits** - Render usypia aplikację po 15 min nieaktywności (pierwsze żądanie może trwać ~30s)
- **WebSockets** - działają na wszystkich wymienionych platformach
