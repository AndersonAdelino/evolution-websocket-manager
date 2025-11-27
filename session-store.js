// Store de sessão customizado para produção
// Baseado em memória, mas sem o warning do MemoryStore
// Adequado para ambientes com 1 réplica

const EventEmitter = require('events');

class CustomSessionStore extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    // Limpar sessões expiradas a cada hora
    setInterval(() => this.cleanExpired(), 60 * 60 * 1000);
  }

  get(sid, callback) {
    try {
      const stored = this.sessions.get(sid);
      if (!stored || !stored.data) {
        return callback();
      }
      
      // Verificar se a sessão expirou
      if (stored.expires && stored.expires < Date.now()) {
        this.sessions.delete(sid);
        return callback();
      }
      
      // Retornar diretamente os dados salvos
      // O express-session espera receber o objeto de sessão completo como foi salvo
      callback(null, stored.data);
    } catch (error) {
      callback(error);
    }
  }

  createSession(req, sess) {
    // Método necessário para express-session funcionar corretamente
    // Retorna os dados da sessão diretamente
    return sess;
  }

  set(sid, session, callback) {
    try {
      if (!session) {
        return callback(new Error('Session is required'));
      }
      
      // Extrair dados relevantes da sessão
      const expires = session.cookie?.expires;
      const expiresTimestamp = expires ? (expires instanceof Date ? expires.getTime() : new Date(expires).getTime()) : null;
      
      // Criar um objeto simples apenas com os dados da sessão (sem métodos)
      // Remover propriedades que não devem ser armazenadas
      const sessionData = {
        cookie: session.cookie || {},
        // Copiar todas as propriedades customizadas (exceto métodos)
        ...Object.keys(session).reduce((acc, key) => {
          if (key !== 'cookie' && typeof session[key] !== 'function' && key !== 'id' && key !== 'reload' && key !== 'save' && key !== 'touch' && key !== 'destroy') {
            acc[key] = session[key];
          }
          return acc;
        }, {})
      };
      
      this.sessions.set(sid, {
        data: sessionData,
        expires: expiresTimestamp
      });
      callback();
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback) {
    this.sessions.delete(sid);
    callback();
  }

  all(callback) {
    const sessions = Array.from(this.sessions.values()).map(s => s.data);
    callback(null, sessions);
  }

  length(callback) {
    callback(null, this.sessions.size);
  }

  clear(callback) {
    this.sessions.clear();
    callback();
  }

  touch(sid, session, callback) {
    const existing = this.sessions.get(sid);
    if (existing) {
      const expires = session.cookie?.expires;
      existing.expires = expires ? new Date(expires).getTime() : null;
      existing.data = session;
    }
    callback();
  }

  cleanExpired() {
    const now = Date.now();
    for (const [sid, session] of this.sessions.entries()) {
      if (session.expires && session.expires < now) {
        this.sessions.delete(sid);
      }
    }
  }
}

module.exports = CustomSessionStore;

