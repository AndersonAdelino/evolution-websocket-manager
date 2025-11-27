# Docker Swarm - Guia de Deploy

Este guia explica como fazer deploy do Evolution WebSocket Manager em Docker Swarm.

## 📋 Pré-requisitos

- Docker Swarm inicializado
- Acesso ao Docker Hub para baixar a imagem
- Variáveis de ambiente configuradas

## 🚀 Deploy Rápido

### 1. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto ou configure as variáveis no Docker Swarm:

```env
EVOLUTION_API_URL=https://sua-api-evolution.com
EVOLUTION_API_KEY=sua_api_key_aqui
PORT=3000
SESSION_SECRET=seu_secret_key_seguro_aqui
NODE_ENV=production
```

### 2. Usar Docker Secrets (Recomendado)

Para maior segurança, use Docker Secrets para variáveis sensíveis:

```bash
# Criar secrets
echo "sua_api_key_aqui" | docker secret create evolution_api_key -
echo "seu_secret_key_seguro_aqui" | docker secret create session_secret -
```

### 3. Deploy no Swarm

```bash
# Deploy do stack
docker stack deploy -c docker-compose.yml evolution-websocket-manager

# Verificar status
docker stack services evolution-websocket-manager

# Ver logs
docker service logs evolution-websocket-manager_evolution-websocket-manager -f
```

## 📦 Estrutura do Deploy

### Volumes
- `evolution-config`: Armazena o arquivo `config.json` com configurações e autenticação

### Networks
- `evolution-network`: Rede overlay para comunicação entre serviços

### Healthcheck
- Verifica `/health` a cada 30 segundos
- Timeout de 10 segundos
- 3 tentativas antes de marcar como não saudável

## 🔧 Comandos Úteis

```bash
# Ver status do serviço
docker service ps evolution-websocket-manager_evolution-websocket-manager

# Escalar serviço (se necessário)
docker service scale evolution-websocket-manager_evolution-websocket-manager=2

# Atualizar imagem
docker service update --image andersonadelino/evolution-websocket-manager:latest evolution-websocket-manager_evolution-websocket-manager

# Remover stack
docker stack rm evolution-websocket-manager

# Ver logs em tempo real
docker service logs -f evolution-websocket-manager_evolution-websocket-manager
```

## 🔐 Segurança

### Usando Docker Secrets

Atualize o `docker-compose.yml` para usar secrets:

```yaml
secrets:
  evolution_api_key:
    external: true
  session_secret:
    external: true

services:
  evolution-websocket-manager:
    secrets:
      - evolution_api_key
      - session_secret
    environment:
      - EVOLUTION_API_KEY_FILE=/run/secrets/evolution_api_key
      - SESSION_SECRET_FILE=/run/secrets/session_secret
```

E ajuste o código para ler dos arquivos de secrets se necessário.

## 📊 Monitoramento

O serviço expõe um endpoint de health check em `/health` que retorna:
- Status do WebSocket
- Uptime
- Configurações ativas
- Estatísticas da fila de webhooks
- Métricas do sistema

## 🔄 Atualizações

O Docker Swarm suporta atualizações sem downtime:
- `order: start-first`: Inicia novo container antes de parar o antigo
- `failure_action: rollback`: Reverte automaticamente em caso de falha
- `parallelism: 1`: Atualiza um container por vez

## 🐛 Troubleshooting

### Verificar logs
```bash
docker service logs evolution-websocket-manager_evolution-websocket-manager
```

### Verificar healthcheck
```bash
docker service inspect evolution-websocket-manager_evolution-websocket-manager --pretty
```

### Acessar container
```bash
docker exec -it $(docker ps -q -f name=evolution-websocket-manager) sh
```

## 📝 Notas

- O volume `evolution-config` persiste as configurações entre restarts
- A primeira execução criará o `config.json` automaticamente
- Senha padrão do admin: `admin123` (altere após primeiro login)
- O serviço roda apenas em nós manager por padrão

