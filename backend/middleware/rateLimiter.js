/**
 * Prosty rate limiter dla konkretnych endpointów
 * Przechowuje w pamięci - dla produkcji należy użyć Redis
 */

const requestCounts = new Map();

/**
 * Tworzy middleware rate limitera
 * @param {Object} options
 * @param {number} options.windowMs - Okno czasowe w ms (domyślnie 60000 = 1 minuta)
 * @param {number} options.maxRequests - Max żądań w oknie (domyślnie 10)
 * @param {string} options.keyPrefix - Prefix dla klucza (rozróżnia endpointy)
 * @param {string} options.message - Komunikat błędu
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000,
    maxRequests = 10,
    keyPrefix = 'default',
    message = 'Zbyt wiele żądań. Spróbuj ponownie później.'
  } = options;

  // Czyść stare wpisy co minutę
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
      if (now - data.windowStart > windowMs) {
        requestCounts.delete(key);
      }
    }
  }, 60000);

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const key = `${keyPrefix}:${userId}`;
    const now = Date.now();

    let data = requestCounts.get(key);

    if (!data || now - data.windowStart > windowMs) {
      // Nowe okno czasowe
      data = { count: 1, windowStart: now };
      requestCounts.set(key, data);
    } else {
      data.count++;
    }

    // Sprawdź limit
    if (data.count > maxRequests) {
      const retryAfter = Math.ceil((data.windowStart + windowMs - now) / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({
        error: message,
        retryAfter
      });
    }

    next();
  };
}

/**
 * Prosty cache dla wyników API
 */
class SimpleCache {
  constructor(ttlMs = 3600000) { // domyślnie 1 godzina
    this.cache = new Map();
    this.ttlMs = ttlMs;

    // Czyść wygasłe wpisy co 5 minut
    setInterval(() => this.cleanup(), 300000);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = {
  createRateLimiter,
  SimpleCache
};
