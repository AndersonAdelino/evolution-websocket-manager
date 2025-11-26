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

// Configurações do Webhook n8n
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_WEBHOOK_ENABLED = process.env.N8N_WEBHOOK_ENABLED === 'true';

// Configuração de eventos para webhook
const WEBHOOK_EVENTS = {
  'messages.upsert': process.env.WEBHOOK_MESSAGES_UPSERT === 'true',
  'messages.update': process.env.WEBHOOK_MESSAGES_UPDATE === 'true',
  'messages.delete': process.env.WEBHOOK_MESSAGES_DELETE === 'true',
  'connection.update': process.env.WEBHOOK_CONNECTION_UPDATE === 'true',
  'qr.updated': process.env.WEBHOOK_QR_UPDATED === 'true',
  'contacts.upsert': process.env.WEBHOOK_CONTACTS_UPSERT === 'true',
  'contacts.update': process.env.WEBHOOK_CONTACTS_UPDATE === 'true',
  'groups.upsert': process.env.WEBHOOK_GROUPS_UPSERT === 'true',
  'groups.update': process.env.WEBHOOK_GROUPS_UPDATE === 'true',
  'call': process.env.WEBHOOK_CALL === 'true'
};

// Validar configurações
if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error('❌ ERRO: Configure EVOLUTION_API_URL e EVOLUTION_API_KEY');
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

// Exibir configuração de webhooks
console.log('\n🔔 Configuração de Webhooks:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Webhook n8n:', N8N_WEBHOOK_ENABLED ? '✅ ATIVO' : '❌ DESATIVADO');
if (N8N_WEBHOOK_ENABLED) {
  console.log('URL:', N8N_WEBHOOK_URL || 'NÃO CONFIGURADA');
  console.log('\nEventos ativos:');
  Object.entries(WEBHOOK_EVENTS).forEach(([event, enabled]) => {
    console.log(`  ${enabled ? '✅' : '⬜'} ${event}`);
  });
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('⏳ Conectando...\n');

// ============================================
// FUNÇÃO PARA ENVIAR WEBHOOK
// ============================================
async function sendWebhook(eventType, data) {
  if (!N8N_WEBHOOK_ENABLED) return;
  if (!WEBHOOK_EVENTS[eventType]) return;
  if (!N8N_WEBHOOK_URL) {
    console.warn('⚠️  Webhook habilitado mas URL não configurada!');
    return;
  }

  try {
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      instance: EVOLUTION_INSTANCE_NAME || 'global',
      data: data
    };

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✅ Webhook enviado: ${eventType}`);
    } else {
      console.error(`❌ Erro ao enviar webhook: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar webhook:', error.message);
  }
}

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

socket.on('messages.upsert', async (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📩 NOVA MENSAGEM RECEBIDA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(data, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await sendWebhook('messages.upsert', data);
});

socket.on('messages.update', async (data) => {
  console.log('🔄 Mensagem atualizada:', JSON.stringify(data, null, 2));
  await sendWebhook('messages.update', data);
});

socket.on('messages.delete', async (data) => {
  console.log('🗑️  Mensagem deletada:', JSON.stringify(data, null, 2));
  await sendWebhook('messages.delete', data);
});

socket.on('connection.update', async (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔌 STATUS DA CONEXÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(data, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await sendWebhook('connection.update', data);
});

socket.on('qr.updated', async (data) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 QR CODE ATUALIZADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(JSON.stringify(data, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await sendWebhook('qr.updated', data);
});

socket.on('contacts.upsert', async (data) => {
  console.log('👥 Novo contato:', JSON.stringify(data, null, 2));
  await sendWebhook('contacts.upsert', data);
});

socket.on('contacts.update', async (data) => {
  console.log('👥 Contato atualizado:', JSON.stringify(data, null, 2));
  await sendWebhook('contacts.update', data);
});

socket.on('groups.upsert', async (data) => {
  console.log('👥 Novo grupo:', JSON.stringify(data, null, 2));
  await sendWebhook('groups.upsert', data);
});

socket.on('groups.update', async (data) => {
  console.log('👥 Grupo atualizado:', JSON.stringify(data, null, 2));
  await sendWebhook('groups.update', data);
});

socket.on('call', async (data) => {
  console.log('📞 Chamada:', JSON.stringify(data, null, 2));
  await sendWebhook('call', data);
});

// ============================================
// SERVIDOR HTTP (HEALTH CHECK)
// ============================================

app.use(express.json());

app.get('/health', (req, res) => {
  const status = {
    websocket: socket.connected ? 'connected' : 'disconnected',
    socketId: socket.id,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mode: WEBSOCKET_MODE,
    url: socketUrl,
    webhook: {
      enabled: N8N_WEBHOOK_ENABLED,
      url: N8N_WEBHOOK_URL || 'not configured',
      events: WEBHOOK_EVENTS
    }
  };
  res.json(status);
});

app.get('/webhook/config', (req, res) => {
  res.json({
    enabled: N8N_WEBHOOK_ENABLED,
    url: N8N_WEBHOOK_URL || 'not configured',
    events: WEBHOOK_EVENTS
  });
});

app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 SERVIDOR HTTP INICIADO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`⚙️  Webhook config: http://localhost:${PORT}/webhook/config`);
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

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promise rejeitada:', reason);
});