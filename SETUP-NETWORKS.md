# Setup de Redes - Docker Swarm

## Criar Rede Traefik-Public

Se você ainda não criou a rede `traefik-public`, execute:

```bash
docker network create --driver overlay --attachable traefik-public
```

## Verificar Redes Existentes

Para verificar quais redes existem:

```bash
docker network ls
```

## Se a Rede do Traefik Tiver Outro Nome

Se a rede do Traefik tiver outro nome (por exemplo, `traefik_web` ou `traefik_default`), você precisa:

1. Verificar o nome correto:
```bash
docker network ls | grep traefik
```

2. Atualizar o `docker-compose.yml` na seção `networks`:
```yaml
networks:
  traefik-public:
    external: true
    name: NOME_DA_REDE_TRAEFIK  # Substitua pelo nome real
```

## Criar Rede WebsocketNet (Opcional)

A rede `WebsocketNet` será criada automaticamente quando você fizer o deploy do stack, mas se quiser criá-la manualmente:

```bash
docker network create --driver overlay --attachable WebsocketNet
```

## Deploy do Stack

Após criar as redes necessárias, faça o deploy:

```bash
docker stack deploy -c docker-compose.yml evolution-websocket-manager
```

## Verificar Status

```bash
# Verificar serviços
docker stack services evolution-websocket-manager

# Verificar redes
docker network ls

# Ver logs
docker service logs -f evolution-websocket-manager_evolution-websocket-manager
```

