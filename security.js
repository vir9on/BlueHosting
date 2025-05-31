const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Основной rate limiter
const mainLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Slow down для API endpoints
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 минут
  delayAfter: 50, // начинаем задерживать после 50 запросов
  delayMs: 500, // задержка 500мс
});

// Rate limiter для авторизации
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5, // максимум 5 попыток
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter для пополнения баланса
const depositLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // максимум 10 попыток
  message: 'Too many deposit attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Настройки helmet для безопасности
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

// IP-блокировка
const blockedIPs = new Set();
const IP_BLOCK_DURATION = 24 * 60 * 60 * 1000; // 24 часа

function blockIP(ip) {
  blockedIPs.add(ip);
  setTimeout(() => blockedIPs.delete(ip), IP_BLOCK_DURATION);
}

function isIPBlocked(ip) {
  return blockedIPs.has(ip);
}

// Middleware для проверки IP
const ipCheck = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (isIPBlocked(ip)) {
    return res.status(403).json({ error: 'IP blocked due to suspicious activity' });
  }
  
  next();
};

// Middleware для мониторинга подозрительной активности
const suspiciousActivityMonitor = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const path = req.path;
  
  // Логирование подозрительных запросов
  if (path.includes('admin') || path.includes('config')) {
    console.log(`Suspicious activity detected from IP: ${ip}, Path: ${path}`);
    blockIP(ip);
    return res.status(403).json({ error: 'Suspicious activity detected' });
  }
  
  next();
};

module.exports = {
  mainLimiter,
  speedLimiter,
  authLimiter,
  depositLimiter,
  helmetConfig,
  ipCheck,
  suspiciousActivityMonitor,
  blockIP,
  isIPBlocked
}; 