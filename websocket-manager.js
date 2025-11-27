const io = require('socket.io-client');
const logger = require('./logger');
const { getSettings } = require('./auth');
const webhookQueue = require('./webhook-queue');
const metrics = require('./metrics');

let evolutionSockets = [];
let currentConfig = null;

const AVAILABLE_EVENTS = [
  'messages.upsert',
  'messages.update',
  'messages.delete',
  'connection.update',
  'qr.updated',
  'contacts.upsert',
  'contacts.update',
  'groups.upsert',
  'groups.update',
  'call'
];

async function initializeWebSocket(evolutionApiUrl, evolutionApiKey) {
  let settings;
  try {
    settings = await getSettings();
  } catch (error) {
    logger.error(`Erro ao carregar configurações: ${error.message}`);
    // Usar configuração padrão se houver erro
    settings = {
      mode: 'global',
      webhookEnabled: false,
      webhooks: [],
      traditionalInstances: []
    };
  }
  currentConfig = settings;

  // Desconectar sockets existentes
  evolutionSockets.forEach(socket => {
    if (socket) socket.disconnect();
  });
  evolutionSockets = [];

  // Se modo traditional, conectar para cada instância
  if (settings.mode === 'traditional' && settings.traditionalInstances && settings.traditionalInstances.length > 0) {
    for (const instanceName of settings.traditionalInstances) {
      const socket = await connectToInstance(evolutionApiUrl, evolutionApiKey, instanceName);
      evolutionSockets.push(socket);
    }
  } else {
    // Modo global
    const socket = await connectToInstance(evolutionApiUrl, evolutionApiKey, null);
    evolutionSockets.push(socket);
  }
}

async function connectToInstance(evolutionApiUrl, evolutionApiKey, instanceName) {
  // Converter http/https para ws/wss
  let wsUrl = evolutionApiUrl;
  if (wsUrl.startsWith('https://')) {
    wsUrl = wsUrl.replace('https://', 'wss://');
  } else if (wsUrl.startsWith('http://')) {
    wsUrl = wsUrl.replace('http://', 'ws://');
  }
  
  let socketUrl;
  let socketOptions = {
    transports: ['websocket', 'polling'],
    extraHeaders: {
      'apikey': evolutionApiKey
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    forceNew: true,
    autoConnect: true
  };

  if (instanceName) {
    // Modo Traditional: usar namespace na URL
    // Não codificar o nome da instância - usar exatamente como está
    socketUrl = `${wsUrl}/${instanceName}`;
    
    // Adicionar query parameter WEBSOCKET_GLOBAL_EVENTS=false
    socketOptions.query = {
      WEBSOCKET_GLOBAL_EVENTS: 'false'
    };
    
    logger.info(`Conectando ao modo TRADICIONAL - Instância: ${instanceName}`);
  } else {
    // Modo Global: conectar na URL base
    socketUrl = wsUrl;
    logger.info('Conectando ao modo GLOBAL - todas as instâncias');
  }

  logger.info(`URL do WebSocket: ${socketUrl}`);
  if (instanceName) {
    logger.info(`Query parameter: WEBSOCKET_GLOBAL_EVENTS=false`);
  }

  const socket = io(socketUrl, socketOptions);
  setupSocketEvents(socket, instanceName);
  return socket;
}

function setupSocketEvents(socket, instanceName) {

  // Eventos de conexão
  socket.on('connect', () => {
    logger.success(`CONECTADO ao Evolution API WebSocket! ${instanceName ? `(Instância: ${instanceName})` : '(Global)'}`);
    logger.info(`ID da conexão: ${socket.id}`);
    metrics.recordConnection('connect');
  });

  socket.on('connect_error', (error) => {
    logger.error(`Erro ao conectar ${instanceName ? `(Instância: ${instanceName})` : '(Global)'}: ${error.message}`);
    metrics.recordError('connection_error', error.message);
    if (error.message.includes('Invalid namespace')) {
      logger.warning(`💡 Dica: Verifique se a instância "${instanceName}" existe e está com WebSocket habilitado na Evolution API`);
      logger.warning(`💡 A instância pode precisar ser configurada via API REST antes de conectar`);
    }
  });

  socket.on('disconnect', (reason) => {
    logger.warning(`Desconectado ${instanceName ? `(Instância: ${instanceName})` : '(Global)'}: ${reason}`);
    metrics.recordConnection('disconnect');
    if (reason === 'io server disconnect') {
      logger.info('Tentando reconectar...');
      socket.connect();
    }
  });

  socket.on('reconnect', (attemptNumber) => {
    logger.success(`Reconectado após ${attemptNumber} tentativas ${instanceName ? `(Instância: ${instanceName})` : '(Global)'}`);
    metrics.recordConnection('reconnect');
  });

  socket.on('reconnect_error', (error) => {
    logger.error(`Erro ao reconectar ${instanceName ? `(Instância: ${instanceName})` : '(Global)'}: ${error.message}`);
  });

  // Registrar eventos da Evolution API
  AVAILABLE_EVENTS.forEach(eventType => {
    socket.on(eventType, async (data) => {
      const instance = instanceName || 'global';
      logger.event(`${eventType} (${instance})`, data);
      metrics.recordEvent(eventType, instance);
      await sendWebhooks(eventType, data, instance);
    });
  });
}

async function sendWebhooks(eventType, data, instance) {
  const settings = await getSettings();
  
  if (!settings.webhookEnabled || !settings.webhooks || settings.webhooks.length === 0) {
    return;
  }

  // Adicionar cada webhook à fila com retry
  for (const webhook of settings.webhooks) {
    if (!webhook.url || !webhook.enabled) continue;
    
    // Verificar se o evento está habilitado para este webhook
    if (webhook.events && webhook.events[eventType]) {
      // Adicionar à fila de webhooks (com retry automático)
      await webhookQueue.addWebhook(webhook, eventType, data, instance);
    }
  }
}

function getSocketStatus() {
  if (evolutionSockets.length === 0) {
    return { connected: false, socketId: null, connections: 0 };
  }
  
  const connectedSockets = evolutionSockets.filter(s => s && s.connected);
  return {
    connected: connectedSockets.length > 0,
    socketId: connectedSockets.length > 0 ? connectedSockets[0].id : null,
    connections: connectedSockets.length,
    total: evolutionSockets.length
  };
}

function disconnect() {
  evolutionSockets.forEach(socket => {
    if (socket) socket.disconnect();
  });
  evolutionSockets = [];
}

module.exports = {
  initializeWebSocket,
  getSocketStatus,
  disconnect,
  AVAILABLE_EVENTS
};

