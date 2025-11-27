const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Usar config.json no diretório config se existir (para Docker volumes), senão usar raiz
const CONFIG_DIR = process.env.CONFIG_DIR || __dirname;
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Garantir que o diretório existe
if (!fsSync.existsSync(CONFIG_DIR)) {
  fsSync.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Senha padrão: admin123 (deve ser alterada no primeiro login)
const DEFAULT_PASSWORD = 'admin123';

async function loadConfig() {
  try {
    // Adicionar timeout para leitura do arquivo
    const data = await Promise.race([
      fs.readFile(CONFIG_FILE, 'utf8'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao ler config.json')), 5000)
      )
    ]);
    return JSON.parse(data);
  } catch (error) {
    // Se não existir ou houver erro, criar com padrão
    console.log(`Criando config.json padrão: ${error.message}`);
    const defaultConfig = {
      auth: {
        username: 'admin',
        passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 10)
      },
      settings: {
        mode: 'global',
        webhookEnabled: false,
        webhooks: [],
        traditionalInstances: []
      }
    };
    try {
      await saveConfig(defaultConfig);
    } catch (saveError) {
      console.error(`Erro ao salvar config padrão: ${saveError.message}`);
    }
    return defaultConfig;
  }
}

async function saveConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

async function verifyPassword(username, password) {
  const config = await loadConfig();
  if (config.auth.username !== username) {
    return false;
  }
  return await bcrypt.compare(password, config.auth.passwordHash);
}

async function changePassword(username, oldPassword, newPassword) {
  const config = await loadConfig();
  if (config.auth.username !== username) {
    throw new Error('Usuário inválido');
  }
  const isValid = await bcrypt.compare(oldPassword, config.auth.passwordHash);
  if (!isValid) {
    throw new Error('Senha atual incorreta');
  }
  config.auth.passwordHash = await bcrypt.hash(newPassword, 10);
  await saveConfig(config);
  return true;
}

async function getSettings() {
  const config = await loadConfig();
  return config.settings;
}

async function updateSettings(newSettings) {
  const config = await loadConfig();
  config.settings = { ...config.settings, ...newSettings };
  await saveConfig(config);
  return config.settings;
}

module.exports = {
  verifyPassword,
  changePassword,
  getSettings,
  updateSettings,
  loadConfig
};

