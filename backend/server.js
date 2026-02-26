const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

dotenv.config();

const db = require('./database');
const authRoutes = require('./routes/auth');
const materialsRoutes = require('./routes/materials');
const suppliersRoutes = require('./routes/suppliers');
const auctionsRoutes = require('./routes/auctions');
const statsRoutes = require('./routes/stats');
const { sanitizeBody } = require('./middleware/validation');

const app = express();
const server = http.createServer(app);

// Konfiguracja CORS
const isProduction = process.env.NODE_ENV === 'production';
const corsOptions = {
  origin: isProduction
    ? (process.env.FRONTEND_URL || true) // true = same origin in production
    : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
};

const io = new Server(server, {
  cors: corsOptions
});

// ===================
// SECURITY MIDDLEWARE
// ===================

// HTTP Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Dla kompatybilności z Socket.io
}));

// Rate Limiting - ogólny
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 500, // max 500 requestów na 15 minut
  message: { error: 'Zbyt wiele żądań. Spróbuj ponownie za chwilę.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting - logowanie (5 prób na minutę)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuta
  max: 5, // max 5 prób
  message: { error: 'Zbyt wiele prób logowania. Spróbuj ponownie za minutę.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Nie licz udanych logowań
});

// Rate Limiting - API (dla operacji wrażliwych)
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuta
  max: 30, // max 30 requestów na minutę
  message: { error: 'Zbyt wiele żądań. Spróbuj ponownie za chwilę.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===================
// BASIC MIDDLEWARE
// ===================

app.use(cors(corsOptions));
app.use(cookieParser(process.env.COOKIE_SECRET || 'auction-cookie-secret-2024'));
app.use(express.json({ limit: '1mb' })); // Limit wielkości body
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanityzacja XSS dla wszystkich requestów
app.use(sanitizeBody);

// Ogólny rate limiting
app.use(generalLimiter);

// ===================
// CSRF Protection (Double Submit Cookie Pattern)
// ===================
const generateCSRFToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

// Endpoint do pobrania tokenu CSRF
app.get('/api/csrf-token', (req, res) => {
  const token = generateCSRFToken();
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Frontend musi móc go odczytać
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1 godzina
  });
  res.json({ csrfToken: token });
});

// Middleware CSRF (dla operacji modyfikujących)
const csrfProtection = (req, res, next) => {
  // Pomijaj dla GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // W trybie development pomijamy CSRF dla wygody
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromCookie = req.cookies['XSRF-TOKEN'];

  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    return res.status(403).json({ error: 'Nieprawidłowy token CSRF' });
  }

  next();
};

// ===================
// ROUTES
// ===================

// Login z osobnym rate limiterem
app.use('/api/auth/login', loginLimiter);

// CSRF protection dla wszystkich route'ów API
app.use('/api', csrfProtection);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/auctions', auctionsRoutes(io));
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ===================
// STATIC FILES (Production)
// ===================

const path = require('path');

// Serve frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend/dist');

  // Serve static files
  app.use(express.static(frontendBuildPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// ===================
// ERROR HANDLING
// ===================

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint nie znaleziony' });
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  // Nie ujawniaj szczegółów błędu w produkcji
  const message = process.env.NODE_ENV === 'production'
    ? 'Wystąpił błąd serwera'
    : err.message;

  res.status(err.status || 500).json({ error: message });
});

// ===================
// SOCKET.IO
// ===================

io.on('connection', (socket) => {
  console.log('Użytkownik połączony:', socket.id);

  socket.on('join_auction', (auctionId) => {
    socket.join(`auction_${auctionId}`);
    console.log(`Socket ${socket.id} dołączył do aukcji ${auctionId}`);
  });

  socket.on('leave_auction', (auctionId) => {
    socket.leave(`auction_${auctionId}`);
  });

  socket.on('disconnect', () => {
    console.log('Użytkownik rozłączony:', socket.id);
  });
});

// Eksport io dla innych modułów
app.set('io', io);

// ===================
// START SERVER
// ===================

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Security features enabled: Helmet, Rate Limiting, XSS Protection, CSRF');
});
