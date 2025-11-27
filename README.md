# WebSocket Evolution API - Painel Administrativo

Cliente WebSocket para Evolution API com painel administrativo completo para gerenciamento de configurações, webhooks e visualização de logs em tempo real.

## 🚀 Funcionalidades

- ✅ **Painel Administrativo Web**
  - Login seguro com autenticação
  - Interface moderna e responsiva
  - Visualização de logs em tempo real
  - Gerenciamento completo de configurações

- ✅ **Modos de Conexão**
  - **Global**: Conecta em todas as instâncias da Evolution API
  - **Traditional**: Conecta apenas em instâncias específicas configuradas

- ✅ **Sistema de Webhooks**
  - Múltiplos webhooks configuráveis
  - Seleção de eventos por webhook
  - Ativar/desativar webhooks individualmente
  - Headers customizados (em breve)

- ✅ **Logs em Tempo Real**
  - Visualização de todos os eventos
  - Filtros por tipo de log
  - Auto-scroll
  - Histórico de logs

## 📋 Pré-requisitos

- Node.js 18+ (fetch nativo)
- Evolution API configurada e rodando
- NPM ou Yarn

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/AndersonAdelino/websocket-evolution.git
cd websocket-evolution
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente criando um arquivo `.env`:
```env
EVOLUTION_API_URL=https://sua-api-evolution.com
EVOLUTION_API_KEY=sua_api_key_aqui
PORT=3000
SESSION_SECRET=seu_secret_key_aqui
```

4. Inicie o servidor:
```bash
npm start
```

5. Acesse o painel administrativo:
```
http://localhost:3000
```

## 🔐 Login Padrão

- **Usuário**: `admin`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha padrão após o primeiro login!

## 📖 Como Usar

### Configuração Inicial

1. Faça login no painel administrativo
2. Vá em **Configurações** e configure:
   - Modo de conexão (Global ou Traditional)
   - Se Traditional, adicione os nomes das instâncias
   - Ative/desative o envio de webhooks

### Configurar Webhooks

1. Vá na aba **Webhooks**
2. Clique em **+ Adicionar Webhook**
3. Preencha:
   - Nome do webhook
   - URL do webhook
   - Selecione os eventos que deseja receber
   - Ative/desative o webhook
4. Salve

### Visualizar Logs

1. Vá na aba **Logs em Tempo Real**
2. Os logs aparecerão automaticamente conforme os eventos chegam
3. Use o botão **Limpar Logs** para limpar a visualização

## 🐳 Docker

### Build da imagem:
```bash
docker build -t websocket-evolution .
```

### Executar com docker-compose:
```bash
docker-compose up -d
```

## 📁 Estrutura do Projeto

```
websocket-evolution/
├── public/              # Interface web do painel
│   ├── index.html      # Página principal
│   ├── styles.css      # Estilos
│   └── app.js          # Lógica do frontend
├── index.js            # Servidor principal
├── websocket-manager.js # Gerenciador de WebSocket
├── admin-api.js        # API REST do painel
├── auth.js             # Sistema de autenticação
├── logger.js           # Sistema de logs
├── config.json         # Configurações (gerado automaticamente)
└── package.json        # Dependências
```

## 🔌 Eventos Disponíveis

Os seguintes eventos podem ser configurados para envio via webhook:

- `messages.upsert` - Nova mensagem recebida
- `messages.update` - Mensagem atualizada
- `messages.delete` - Mensagem deletada
- `connection.update` - Status da conexão
- `qr.updated` - QR Code atualizado
- `contacts.upsert` - Novo contato
- `contacts.update` - Contato atualizado
- `groups.upsert` - Novo grupo
- `groups.update` - Grupo atualizado
- `call` - Chamada recebida

## 🔒 Segurança

- Senhas são armazenadas com hash bcrypt
- Sessões com expiração de 24 horas
- Autenticação requerida para todas as operações administrativas
- Configurações armazenadas localmente em JSON

## 📝 API Endpoints

### Autenticação
- `POST /api/admin/login` - Fazer login
- `POST /api/admin/logout` - Fazer logout
- `GET /api/admin/check` - Verificar autenticação

### Configurações
- `GET /api/admin/settings` - Obter configurações
- `POST /api/admin/settings` - Atualizar configurações

### Senha
- `POST /api/admin/change-password` - Alterar senha

### Health Check
- `GET /health` - Status do servidor

## 🛠️ Desenvolvimento

Para desenvolvimento:
```bash
npm run dev
```

## 📄 Licença

MIT

## 👤 Autor

Anderson Adelino

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

