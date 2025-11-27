const rateLimit = require('express-rate-limit');

// Rate limiter para login (mais restritivo)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // não contar requisições bem-sucedidas
});

// Rate limiter para APIs administrativas
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // máximo 60 requisições por minuto
  message: {
    error: 'Muitas requisições. Tente novamente em alguns instantes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter geral (menos restritivo)
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // máximo 100 requisições por minuto
  message: {
    error: 'Muitas requisições. Tente novamente em alguns instantes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  adminLimiter,
  generalLimiter
};

