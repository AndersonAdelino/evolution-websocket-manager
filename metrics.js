const EventEmitter = require('events');

class Metrics extends EventEmitter {
  constructor() {
    super();
    this.startTime = Date.now();
    this.reset();
  }

  reset() {
    this.events = {
      total: 0,
      byType: {},
      byInstance: {}
    };
    
    this.webhooks = {
      total: 0,
      success: 0,
      failed: 0,
      byWebhook: {},
      byEventType: {}
    };
    
    this.connections = {
      totalConnections: 0,
      currentConnections: 0,
      reconnections: 0,
      disconnections: 0
    };
    
    this.errors = {
      total: 0,
      byType: {}
    };
  }

  // Registrar evento recebido
  recordEvent(eventType, instance = 'global') {
    this.events.total++;
    
    // Por tipo
    if (!this.events.byType[eventType]) {
      this.events.byType[eventType] = 0;
    }
    this.events.byType[eventType]++;
    
    // Por instância
    if (!this.events.byInstance[instance]) {
      this.events.byInstance[instance] = 0;
    }
    this.events.byInstance[instance]++;
    
    this.emit('event', { eventType, instance });
  }

  // Registrar webhook enviado
  recordWebhook(webhookName, eventType, success) {
    this.webhooks.total++;
    
    if (success) {
      this.webhooks.success++;
    } else {
      this.webhooks.failed++;
    }
    
    // Por webhook
    if (!this.webhooks.byWebhook[webhookName]) {
      this.webhooks.byWebhook[webhookName] = {
        total: 0,
        success: 0,
        failed: 0
      };
    }
    this.webhooks.byWebhook[webhookName].total++;
    if (success) {
      this.webhooks.byWebhook[webhookName].success++;
    } else {
      this.webhooks.byWebhook[webhookName].failed++;
    }
    
    // Por tipo de evento
    if (!this.webhooks.byEventType[eventType]) {
      this.webhooks.byEventType[eventType] = {
        total: 0,
        success: 0,
        failed: 0
      };
    }
    this.webhooks.byEventType[eventType].total++;
    if (success) {
      this.webhooks.byEventType[eventType].success++;
    } else {
      this.webhooks.byEventType[eventType].failed++;
    }
    
    this.emit('webhook', { webhookName, eventType, success });
  }

  // Registrar conexão
  recordConnection(type) {
    switch (type) {
      case 'connect':
        this.connections.totalConnections++;
        this.connections.currentConnections++;
        break;
      case 'disconnect':
        this.connections.disconnections++;
        this.connections.currentConnections = Math.max(0, this.connections.currentConnections - 1);
        break;
      case 'reconnect':
        this.connections.reconnections++;
        break;
    }
    this.emit('connection', { type });
  }

  // Registrar erro
  recordError(errorType, errorMessage) {
    this.errors.total++;
    
    if (!this.errors.byType[errorType]) {
      this.errors.byType[errorType] = 0;
    }
    this.errors.byType[errorType]++;
    
    this.emit('error', { errorType, errorMessage });
  }

  // Obter estatísticas completas
  getStats() {
    const uptime = Date.now() - this.startTime;
    const uptimeSeconds = Math.floor(uptime / 1000);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);

    const webhookSuccessRate = this.webhooks.total > 0
      ? ((this.webhooks.success / this.webhooks.total) * 100).toFixed(2)
      : 0;

    return {
      uptime: {
        milliseconds: uptime,
        seconds: uptimeSeconds,
        minutes: uptimeMinutes,
        hours: uptimeHours,
        days: uptimeDays,
        formatted: this.formatUptime(uptime)
      },
      events: {
        ...this.events,
        averagePerMinute: uptimeMinutes > 0
          ? (this.events.total / uptimeMinutes).toFixed(2)
          : 0
      },
      webhooks: {
        ...this.webhooks,
        successRate: `${webhookSuccessRate}%`,
        averagePerMinute: uptimeMinutes > 0
          ? (this.webhooks.total / uptimeMinutes).toFixed(2)
          : 0
      },
      connections: {
        ...this.connections
      },
      errors: {
        ...this.errors,
        errorRate: this.events.total > 0
          ? ((this.errors.total / this.events.total) * 100).toFixed(2)
          : '0.00',
        errorRatePercent: this.events.total > 0
          ? `${((this.errors.total / this.events.total) * 100).toFixed(2)}%`
          : '0%'
      },
      timestamp: new Date().toISOString()
    };
  }

  // Formatar uptime de forma legível
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Obter estatísticas resumidas
  getSummary() {
    const stats = this.getStats();
    return {
      uptime: stats.uptime.formatted,
      events: {
        total: stats.events.total,
        averagePerMinute: stats.events.averagePerMinute
      },
      webhooks: {
        total: stats.webhooks.total,
        success: stats.webhooks.success,
        failed: stats.webhooks.failed,
        successRate: stats.webhooks.successRate
      },
      connections: {
        current: stats.connections.currentConnections,
        total: stats.connections.totalConnections
      },
      errors: {
        total: stats.errors.total,
        errorRate: `${stats.errors.errorRate}%`
      }
    };
  }
}

module.exports = new Metrics();

