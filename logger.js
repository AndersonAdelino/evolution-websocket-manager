const EventEmitter = require('events');

class Logger extends EventEmitter {
  constructor() {
    super();
    this.logs = [];
    this.maxLogs = 1000; // Manter últimos 1000 logs
  }

  log(level, message, data = null) {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      level, // 'info', 'success', 'error', 'warning', 'event'
      message,
      data
    };

    this.logs.push(logEntry);
    
    // Limitar quantidade de logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Emitir evento para WebSocket
    this.emit('log', logEntry);

    // Também logar no console
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      event: '📡'
    }[level] || '📝';

    console.log(`${emoji} [${logEntry.timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  info(message, data) {
    this.log('info', message, data);
  }

  success(message, data) {
    this.log('success', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  warning(message, data) {
    this.log('warning', message, data);
  }

  event(eventType, data) {
    this.log('event', `Evento: ${eventType}`, data);
  }

  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }

  clearLogs() {
    this.logs = [];
    this.emit('logsCleared');
  }
}

module.exports = new Logger();

