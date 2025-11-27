const logger = require('./logger');
const { getSettings } = require('./auth');
const metrics = require('./metrics');

// Configuração de retry
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelays: [1000, 5000, 15000], // 1s, 5s, 15s
  timeout: 10000 // 10 segundos de timeout
};

// Fila de webhooks com retry
class WebhookQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  // Adicionar webhook à fila
  async addWebhook(webhook, eventType, data, instance) {
    const webhookJob = {
      id: Date.now() + Math.random(),
      webhook,
      eventType,
      data,
      instance,
      attempts: 0,
      createdAt: new Date().toISOString()
    };

    this.queue.push(webhookJob);
    logger.info(`Webhook adicionado à fila: ${webhook.name || webhook.url} - ${eventType}`);

    // Processar fila se não estiver processando
    if (!this.processing) {
      this.processQueue();
    }
  }

  // Processar fila de webhooks
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      await this.processWebhook(job);
    }

    this.processing = false;
  }

  // Processar um webhook individual com retry
  async processWebhook(job) {
    const { webhook, eventType, data, instance } = job;

    try {
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        instance: instance,
        data: data
      };

      // Criar AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeout);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.headers || {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        logger.success(`Webhook enviado com sucesso: ${eventType} → ${webhook.name || webhook.url}`);
        metrics.recordWebhook(webhook.name || webhook.url, eventType, true);
        return;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      job.attempts++;

      // Se ainda há tentativas disponíveis, reagendar
      if (job.attempts < RETRY_CONFIG.maxRetries) {
        const delay = RETRY_CONFIG.retryDelays[job.attempts - 1] || RETRY_CONFIG.retryDelays[RETRY_CONFIG.retryDelays.length - 1];
        
        logger.warning(`Webhook falhou (tentativa ${job.attempts}/${RETRY_CONFIG.maxRetries}): ${webhook.name || webhook.url} - ${error.message}. Tentando novamente em ${delay}ms`);
        
        // Reagendar para retry
        setTimeout(() => {
          this.queue.push(job);
          if (!this.processing) {
            this.processQueue();
          }
        }, delay);
      } else {
        // Esgotaram-se as tentativas
        logger.error(`Webhook falhou após ${RETRY_CONFIG.maxRetries} tentativas: ${webhook.name || webhook.url} - ${error.message}`);
        metrics.recordWebhook(webhook.name || webhook.url, eventType, false);
      }
    }
  }

  // Obter estatísticas da fila
  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing
    };
  }
}

module.exports = new WebhookQueue();

