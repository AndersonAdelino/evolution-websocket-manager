const express = require('express');
const session = require('express-session');
const { verifyPassword, changePassword, getSettings, updateSettings } = require('./auth');
const { validateLogin, validateChangePassword, validateSettings } = require('./middleware/validation');
const { loginLimiter, adminLimiter } = require('./middleware/rateLimiter');
const { asyncHandler } = require('./middleware/errorHandler');

const router = express.Router();

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.status(401).json({ error: 'Não autenticado' });
}

// Login
router.post('/api/admin/login', loginLimiter, validateLogin, asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const isValid = await verifyPassword(username, password);
  if (isValid) {
    req.session.authenticated = true;
    req.session.username = username;
    return res.json({ success: true, message: 'Login realizado com sucesso' });
  } else {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
}));

// Logout
router.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logout realizado com sucesso' });
});

// Verificar autenticação
router.get('/api/admin/check', requireAuth, (req, res) => {
  res.json({ authenticated: true, username: req.session.username });
});

// Obter estatísticas
router.get('/api/admin/stats', requireAuth, adminLimiter, asyncHandler(async (req, res) => {
  const metrics = require('./metrics');
  const stats = metrics.getStats();
  res.json(stats);
}));

// Obter resumo de estatísticas
router.get('/api/admin/stats/summary', requireAuth, adminLimiter, asyncHandler(async (req, res) => {
  const metrics = require('./metrics');
  const summary = metrics.getSummary();
  res.json(summary);
}));

// Resetar estatísticas
router.post('/api/admin/stats/reset', requireAuth, adminLimiter, asyncHandler(async (req, res) => {
  const metrics = require('./metrics');
  metrics.reset();
  res.json({ success: true, message: 'Estatísticas resetadas com sucesso' });
}));

// Alterar senha
router.post('/api/admin/change-password', requireAuth, adminLimiter, validateChangePassword, asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  await changePassword(req.session.username, oldPassword, newPassword);
  res.json({ success: true, message: 'Senha alterada com sucesso' });
}));

// Obter configurações
router.get('/api/admin/settings', requireAuth, adminLimiter, asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
}));

// Atualizar configurações
router.post('/api/admin/settings', requireAuth, adminLimiter, validateSettings, asyncHandler(async (req, res) => {
  const settings = await updateSettings(req.body);
  
  // Notificar que as configurações mudaram (para reconectar WebSocket)
  if (req.app.locals.onSettingsChange) {
    req.app.locals.onSettingsChange();
  }
  
  res.json({ success: true, settings });
}));

module.exports = router;

