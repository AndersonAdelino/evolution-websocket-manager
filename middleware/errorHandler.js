const logger = require('../logger');

// Classe de erro customizada
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware de tratamento de erros centralizado
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log do erro
  logger.error(`Erro: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    statusCode: err.statusCode || 500
  });

  // Erro de validação do express-validator
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Erro de cast (MongoDB ObjectId inválido, etc)
  if (err.name === 'CastError') {
    const message = 'Recurso não encontrado';
    error = new AppError(message, 404, 'NOT_FOUND');
  }

  // Erro de duplicação (MongoDB)
  if (err.code === 11000) {
    const message = 'Recurso duplicado';
    error = new AppError(message, 400, 'DUPLICATE_ERROR');
  }

  // Erro JWT
  if (err.name === 'JsonWebTokenError') {
    const message = 'Token inválido';
    error = new AppError(message, 401, 'INVALID_TOKEN');
  }

  // Erro JWT expirado
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expirado';
    error = new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  // Resposta de erro
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Erro interno do servidor',
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Middleware para capturar rotas não encontradas
const notFound = (req, res, next) => {
  const error = new AppError(`Rota não encontrada: ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
};

// Wrapper para async functions (evita try-catch em todas as rotas)
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  errorHandler,
  notFound,
  asyncHandler
};

