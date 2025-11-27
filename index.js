require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const CustomSessionStore = require('./session-store');
const path = require('path');
const logger = require('./logger');
const websocketManager = require('./websocket-manager');
const adminApi = require('./admin-api');
const { getSettings } = require('./auth');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

// Configurar timeout do servidor
server.timeout = 30000; // 30 segundos
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Configurar Socket.IO com CORS e opções de timeout
// IMPORTANTE: Configuração para funcionar atrás do Traefik
const io = new Server(server, {
  cors: {
    origin: true, // Aceitar qualquer origem (Traefik gerencia isso)
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURAÇÕES
// ============================================
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

// Validar configurações
if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  logger.error('ERRO: Configure EVOLUTION_API_URL e EVOLUTION_API_KEY');
  process.exit(1);
}

// ============================================
// MIDDLEWARES
// ============================================
// Trust proxy (CRÍTICO para Traefik funcionar corretamente)
app.set('trust proxy', 1);

// Middleware de logging para debug (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
    next();
  });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting geral (apenas para API, não para / e /health)
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/') {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return generalLimiter(req, res, next);
  }
  next();
});

// Configurar sessão
// IMPORTANTE: Quando atrás do Traefik, sempre usar secure: true se PUBLIC_URL for HTTPS
const isSecure = PUBLIC_URL.startsWith('https://');
app.use(session({
  store: new CustomSessionStore(),
  secret: process.env.SESSION_SECRET || 'websocket-evolution-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Nome customizado para evitar conflitos
  cookie: { 
    secure: isSecure, // true se usar HTTPS (Traefik termina SSL)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: 'lax' // lax funciona melhor com Traefik
  }
}));

// ============================================
// ROTAS
// ============================================
// Health check (antes de tudo) - versão ultra rápida
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas da API (antes do static)
app.use(adminApi);

// Rota para o painel - versão simplificada e robusta
app.get('/', (req, res, next) => {
  try {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    const fs = require('fs');
    
    // Verificar se o arquivo existe (síncrono mas rápido)
    if (!fs.existsSync(indexPath)) {
      logger.error(`Arquivo index.html não encontrado em: ${indexPath}`);
      return res.status(500).send('Arquivo não encontrado');
    }
    
    // Servir arquivo diretamente com callback para capturar erros
    res.sendFile(indexPath, (err) => {
      if (err) {
        logger.error(`Erro ao servir index.html: ${err.message}`);
        if (!res.headersSent) {
          next(err);
        }
      }
    });
  } catch (error) {
    logger.error(`Erro na rota /: ${error.message}`);
    next(error);
  }
});

// Arquivos estáticos (deve vir por último)
// IMPORTANTE: Não servir index.html automaticamente para evitar conflito
app.use(express.static(path.join(__dirname, 'public'), {
  index: false, // Não servir index.html automaticamente
  maxAge: 0,
  etag: false,
  lastModified: false
}));

// Middleware para rotas não encontradas (não deve ser alcançado devido ao catch-all acima)
app.use(notFound);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// ============================================
// WEBSOCKET PARA LOGS EM TEMPO REAL
// ============================================
io.on('connection', (socket) => {
  logger.info('Cliente conectado ao painel de logs');
  
  // Enviar logs históricos
  const logs = logger.getLogs(100);
  socket.emit('logs', logs);

  socket.on('disconnect', () => {
    logger.info('Cliente desconectado do painel de logs');
  });
});

// ============================================
// INICIALIZAR WEBSOCKET DA EVOLUTION API
// ============================================
async function startEvolutionWebSocket() {
  try {
    await websocketManager.initializeWebSocket(EVOLUTION_API_URL, EVOLUTION_API_KEY);
    logger.success('WebSocket da Evolution API inicializado');
  } catch (error) {
    logger.error(`Erro ao inicializar WebSocket: ${error.message}`);
  }
}

// Função para reconectar quando configurações mudarem
async function reconnectWebSocket() {
  logger.info('Reconectando WebSocket devido a mudanças nas configurações...');
  await startEvolutionWebSocket();
}

// Disponibilizar função de reconexão para o admin-api
app.locals.onSettingsChange = reconnectWebSocket;

// Integrar logger com WebSocket para logs em tempo real
logger.on('log', (logEntry) => {
  io.emit('log', logEntry);
});

logger.on('logsCleared', () => {
  io.emit('logsCleared');
});

// ============================================
// INICIAR SERVIDOR
// ============================================
server.listen(PORT, () => {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🌐 SERVIDOR HTTP INICIADO');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info(`🏥 Health check: ${PUBLIC_URL}/health`);
  logger.info(`🎛️  Painel Admin: ${PUBLIC_URL}`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Inicializar WebSocket da Evolution API (não bloquear o servidor)
  startEvolutionWebSocket().catch(err => {
    logger.error(`Erro ao inicializar WebSocket: ${err.message}`);
  });
});

// ============================================
// ENCERRAMENTO GRACIOSO
// ============================================

process.on('SIGINT', () => {
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🛑 ENCERRANDO APLICAÇÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  websocketManager.disconnect();
  console.log('✅ WebSocket desconectado');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Erro não tratado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Promise rejeitada:', reason);
});