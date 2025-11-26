require('dotenv').config();
const io = require('socket.io-client');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURAÇÕES
// ============================================
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;
const WEBSOCKET_MODE = process.env.WEBSOCKET_MODE || 'global';

// Validar configurações
if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ ERRO: Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no arquivo .env');
  process.exit(1);
}

// Construir URL do WebSocket
let socketUrl;
if (WEBSOCKET_MODE === 'global') {
  socketUrl = EVOLUTION_API_URL;
  console.log('📡 Modo: GLOBAL - conectando em todas as instâncias');
} else {
  if (!EVOLUTION_INSTANCE_NAME) {
    console.error('❌ ERRO: Configure EVOLUTION_INSTANCE_NAME para modo tradicional');
    process.exit(1);
  }
  socketUrl = `${EVOLUTION_API_URL}/${EVOLUTION_INSTANCE_NAME}`;
  console.log('📡 Modo: TRADICIONAL - conectando na instância:', EVOLUTION_INSTANCE_NAME);
}

console.log('🔌 URL do WebSocket:', socketUrl);
console.log('⏳ Conectando...\n');

// ============================================
// CONFIGURAR WEBSOCKET
// ============================================
const socket = io(socketUrl, {
  transports: ['websocket', 'polling'],
  extraHeaders: {
    'apikey': EVOLUTION_API_KEY
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// ============================================
// EVENTOS DE CONEXÃO
// ============================================

socket.on('connect', () => {
  console.log('✅ CONECTADO ao Evolution API WebSocket!');
  console.log('📡 ID da conexão:', socket.id);
  console.log('🎯 Aguardando eventos...\n');
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro ao conectar:', error.message);
  console.log('💡 Verifique:');
  console.log('   - URL da API está correta?');
  console.log('   - API Key está válida?');
  console.log('   - Evolution API está online?\n');
});

socket.on('disconnect', (reason) => {
  console.log('🔴 Desconectado:', reason);
  if (reason === 'io server disconnect') {
    console.log('🔄 Tentando reconectar...');
    socket.connect();
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log('🔄 Reconectado após', attemptNumber, 'tentativas');
});

socket.on('reconnect_error', (error) => {
  console.error('❌ Erro ao reconectar:', error.message);
});

// ============================================
// EVENTOS DA EVOLUTION API
// ============================================

// 📩 MENSAGENS
socket.on('messages.upsert', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📩 NOVA MENSAGEM RECEBIDA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(data, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Aqui você pode processar a mensagem
  // Exemplo: enviar para banco de dados, webhook, etc
});

socket.on('messages.update', (data) => {
  console.log('🔄 Mensagem atualizada:', data);
});

socket.on('messages.delete', (data) => {
  console.log('🗑️  Mensagem deletada:', data);
});

// 🔌 CONEXÃO DO WHATSAPP
socket.on('connection.update', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔌 STATUS DA CONEXÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(data, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// 📱 QR CODE
socket.on('qr.updated', (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 QR CODE ATUALIZADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(data, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// 👥 CONTATOS
socket.on('contacts.upsert', (data) => {
  console.log('👥 Novo contato:', data);
});

socket.on('contacts.update', (data) => {
  console.log('👥 Contato atualizado:', data);
});

// 👥 GRUPOS
socket.on('groups.upsert', (data) => {
  console.log('👥 Novo grupo:', data);
});

socket.on('groups.update', (data) => {
  console.log('👥 Grupo atualizado:', data);
});

// 📞 CHAMADAS
socket.on('call', (data) => {
  console.log('📞 Chamada:', data);
});

// ============================================
// SERVIDOR HTTP (HEALTH CHECK)
// ============================================

app.use(express.json());

// Endpoint de status
app.get('/health', (req, res) => {
  const status = {
    websocket: socket.connected ? 'connected' : 'disconnected',
    socketId: socket.id,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mode: WEBSOCKET_MODE,
    url: socketUrl
  };
  
  res.json(status);
});

// Endpoint para enviar mensagem (exemplo)
app.post('/send-message', (req, res) => {
  const { to, message } = req.body;
  
  if (!to || !message) {
    return res.status(400).json({ error: 'Campos "to" e "message" são obrigatórios' });
  }
  
  // Aqui você implementaria o envio via Evolution API REST
  // Este é apenas um exemplo
  res.json({ 
    success: true, 
    message: 'Para enviar mensagens, use a API REST da Evolution' 
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 SERVIDOR HTTP INICIADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📨 Enviar mensagem: POST http://localhost:${PORT}/send-message`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// ============================================
// ENCERRAMENTO GRACIOSO
// ============================================

process.on('SIGINT', () => {
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🛑 ENCERRANDO APLICAÇÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  socket.disconnect();
  console.log('✅ WebSocket desconectado');
  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Erro não tratado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada:', reason);
});