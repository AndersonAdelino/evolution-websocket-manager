const { body, validationResult } = require('express-validator');

// Middleware para tratar erros de validação
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

// Validações para login
const validateLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username é obrigatório')
    .isLength({ min: 3, max: 50 }).withMessage('Username deve ter entre 3 e 50 caracteres'),
  body('password')
    .notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
  handleValidationErrors
];

// Validações para alterar senha
const validateChangePassword = [
  body('oldPassword')
    .notEmpty().withMessage('Senha atual é obrigatória'),
  body('newPassword')
    .notEmpty().withMessage('Nova senha é obrigatória')
    .isLength({ min: 6 }).withMessage('Nova senha deve ter no mínimo 6 caracteres'),
  handleValidationErrors
];

// Validações para configurações
const validateSettings = [
  body('mode')
    .optional()
    .isIn(['global', 'traditional']).withMessage('Modo deve ser "global" ou "traditional"'),
  body('webhookEnabled')
    .optional()
    .isBoolean().withMessage('webhookEnabled deve ser um booleano'),
  body('traditionalInstances')
    .optional()
    .isArray().withMessage('traditionalInstances deve ser um array')
    .custom((instances) => {
      if (instances && instances.length > 0) {
        instances.forEach((instance, index) => {
          if (typeof instance !== 'string' || instance.trim().length === 0) {
            throw new Error(`Instância no índice ${index} deve ser uma string não vazia`);
          }
        });
      }
      return true;
    }),
  body('webhooks')
    .optional()
    .isArray().withMessage('webhooks deve ser um array')
    .custom((webhooks) => {
      if (webhooks && webhooks.length > 0) {
        webhooks.forEach((webhook, index) => {
          if (!webhook.url || typeof webhook.url !== 'string') {
            throw new Error(`Webhook no índice ${index} deve ter uma URL válida`);
          }
          if (!webhook.url.match(/^https?:\/\/.+/)) {
            throw new Error(`Webhook no índice ${index} deve ter uma URL válida (http:// ou https://)`);
          }
        });
      }
      return true;
    }),
  handleValidationErrors
];

// Validações para webhook individual
const validateWebhook = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Nome do webhook deve ter no máximo 100 caracteres'),
  body('url')
    .notEmpty().withMessage('URL do webhook é obrigatória')
    .isURL({ protocols: ['http', 'https'] }).withMessage('URL deve ser válida (http:// ou https://)'),
  body('enabled')
    .optional()
    .isBoolean().withMessage('enabled deve ser um booleano'),
  body('events')
    .optional()
    .isObject().withMessage('events deve ser um objeto'),
  handleValidationErrors
];

module.exports = {
  validateLogin,
  validateChangePassword,
  validateSettings,
  validateWebhook,
  handleValidationErrors
};

