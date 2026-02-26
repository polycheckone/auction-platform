const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const {
  authenticateToken,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_EXPIRY_MS
} = require('../middleware/auth');
const { loginValidation, activateValidation, changePasswordValidation } = require('../middleware/validation');

// Funkcja do zapisania refresh tokenu w bazie
const saveRefreshToken = (userId, token) => {
  const id = `rt-${crypto.randomUUID().slice(0, 8)}`;
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, token, expiresAt);

  return id;
};

// Funkcja do usunięcia wygasłych tokenów użytkownika
const cleanupExpiredTokens = (userId) => {
  db.prepare(`
    DELETE FROM refresh_tokens
    WHERE user_id = ? AND expires_at < datetime('now')
  `).run(userId);
};

// Login
router.post('/login', loginValidation, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Konto nieaktywne. Sprawdź zaproszenie email.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    // Wyczyść wygasłe tokeny
    cleanupExpiredTokens(user.id);

    // Generuj tokeny
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Zapisz refresh token w bazie
    saveRefreshToken(user.id, refreshToken);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company: user.company
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Refresh token - odświeżenie access tokenu
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Brak refresh tokenu' });
    }

    // Sprawdź czy token istnieje w bazie
    const storedToken = db.prepare(`
      SELECT * FROM refresh_tokens
      WHERE token = ? AND expires_at > datetime('now')
    `).get(refreshToken);

    if (!storedToken) {
      return res.status(401).json({ error: 'Nieprawidłowy lub wygasły refresh token' });
    }

    // Zweryfikuj token
    let decoded;
    try {
      decoded = await verifyRefreshToken(refreshToken);
    } catch (err) {
      // Usuń nieprawidłowy token z bazy
      db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
      return res.status(401).json({ error: 'Nieprawidłowy refresh token' });
    }

    // Pobierz użytkownika
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);

    if (!user || !user.is_active) {
      // Usuń token jeśli użytkownik nie istnieje lub jest nieaktywny
      db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
      return res.status(401).json({ error: 'Użytkownik nieaktywny' });
    }

    // Generuj nowy access token
    const newAccessToken = generateAccessToken(user);

    res.json({
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Logout - unieważnienie refresh tokenu
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Usuń konkretny refresh token
      db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    }

    res.json({ message: 'Wylogowano pomyślnie' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Logout ze wszystkich urządzeń
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    // Usuń wszystkie refresh tokeny użytkownika
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);

    res.json({ message: 'Wylogowano ze wszystkich urządzeń' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Aktywacja konta przez token zaproszenia
router.post('/activate', activateValidation, async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE invitation_token = ?').get(token);

    if (!user) {
      return res.status(400).json({ error: 'Nieprawidłowy token zaproszenia' });
    }

    if (new Date(user.invitation_expires) < new Date()) {
      return res.status(400).json({ error: 'Token zaproszenia wygasł' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.prepare(`
      UPDATE users
      SET password = ?, is_active = 1, invitation_token = NULL, invitation_expires = NULL
      WHERE id = ?
    `).run(hashedPassword, user.id);

    res.json({ message: 'Konto aktywowane pomyślnie' });
  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Pobierz dane zalogowanego użytkownika
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, email, name, company, phone, role FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
  }

  // Jeśli to dostawca, pobierz też dane firmy
  if (user.role === 'supplier') {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE user_id = ?').get(user.id);
    user.supplier = supplier;
  }

  res.json(user);
});

// Zmiana hasła
router.post('/change-password', authenticateToken, changePasswordValidation, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Nieprawidłowe obecne hasło' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

    // Przy zmianie hasła unieważnij wszystkie refresh tokeny
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user.id);

    res.json({ message: 'Hasło zmienione pomyślnie. Zaloguj się ponownie.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
