const jwt = require('jsonwebtoken');

// W produkcji wymagaj ustawionych zmiennych środowiskowych
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.JWT_SECRET || !process.env.REFRESH_SECRET)) {
  throw new Error('JWT_SECRET and REFRESH_SECRET must be set in production!');
}

const JWT_SECRET = process.env.JWT_SECRET || 'auction-secret-key-2024-dev';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'auction-refresh-secret-key-2024-dev';

// Czas wygasnięcia tokenów (konfigurowalne przez env)
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const REFRESH_TOKEN_EXPIRY_MS = parseExpiry(REFRESH_TOKEN_EXPIRY);

// Parsowanie czasu wygaśnięcia do milisekund
function parseExpiry(expiry) {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Rozróżnij wygasły token od nieprawidłowego
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token wygasł', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Nieprawidłowy token' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Wymagane uprawnienia administratora' });
  }
  next();
};

const requireSupplier = (req, res, next) => {
  if (req.user.role !== 'supplier' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Wymagane uprawnienia dostawcy' });
  }
  next();
};

// Generowanie access tokenu
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// Generowanie refresh tokenu
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

// Weryfikacja refresh tokenu
const verifyRefreshToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, REFRESH_SECRET, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSupplier,
  JWT_SECRET,
  REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_MS,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
};
