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
    const session = this.sessions.get(sid);
    if (!session) {
      return callback();
    }
    
    // Verificar se a sessão expirou
    if (session.expires && session.expires < Date.now()) {
      this.sessions.delete(sid);
      return callback();
    }
    
    callback(null, session.data);
  }

  set(sid, session, callback) {
    const expires = session.cookie?.expires;
    this.sessions.set(sid, {
      data: session,
      expires: expires ? new Date(expires).getTime() : null
    });
    callback();
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

