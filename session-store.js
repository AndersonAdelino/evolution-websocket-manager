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
      if (!stored) {
        return callback();
      }
      
      // Verificar se a sessão expirou
      if (stored.expires && stored.expires < Date.now()) {
        this.sessions.delete(sid);
        return callback();
      }
      
      // Retornar os dados da sessão
      // Garantir que o objeto tenha a estrutura esperada pelo express-session
      const sessionData = stored.data;
      
      // Se sessionData não tiver cookie, criar um objeto cookie básico
      if (!sessionData.cookie) {
        sessionData.cookie = {
          originalMaxAge: 24 * 60 * 60 * 1000,
          expires: stored.expires ? new Date(stored.expires) : null,
          secure: false,
          httpOnly: true,
          domain: undefined,
          path: '/',
          sameSite: 'lax'
        };
      }
      
      callback(null, sessionData);
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
      const expires = session.cookie?.expires;
      this.sessions.set(sid, {
        data: session,
        expires: expires ? new Date(expires).getTime() : null
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

