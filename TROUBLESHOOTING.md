# Troubleshooting - Problemas de Acesso

## ⚠️ Erro: "network traefik-public is declared as external, but could not be found"

### Solução 1: Criar a rede traefik-public

Execute no servidor Docker Swarm:

```bash
docker network create --driver overlay --attachable traefik-public
```

### Solução 2: Verificar o nome correto da rede do Traefik

Se você já tem o Traefik rodando, verifique o nome da rede:

```bash
docker network ls | grep traefik
```

Depois, atualize o `docker-compose.yml` na seção `networks`:

```yaml
networks:
  traefik-public:
    external: true
    name: NOME_DA_REDE_TRAEFIK  # Substitua pelo nome real encontrado
```

### Solução 3: Verificar no Portainer

1. Acesse o Portainer
2. Vá em **Networks**
3. Procure pela rede do Traefik
4. Use o nome exato encontrado no `docker-compose.yml`

---

## Problema: 404 Page Not Found ao acessar o domínio

### Verificar se o serviço está respondendo

```bash
# Testar diretamente no container
docker exec -it $(docker ps -q -f name=evolution-websocket-manager) wget -qO- http://localhost:3000/health

# Ou testar via curl do servidor
curl http://localhost:3000/health
```

### Verificar configuração do Traefik

1. Verifique se o router está criado no Traefik:
```bash
# Ver routers do Traefik
docker service logs traefik | grep evolution-websocket-manager
```

2. Verifique se o serviço está na mesma rede que o Traefik:
```bash
docker service inspect evolution-websocket-manager_evolution-websocket-manager --pretty | grep -A 10 Networks
```

3. Verifique se o Traefik está conseguindo descobrir o serviço:
```bash
# Ver logs do Traefik
docker service logs -f traefik | grep evolution
```

### Verificar labels do Traefik

Certifique-se de que as labels estão corretas no `docker-compose.yml`:
- `traefik.enable=1` está presente
- `traefik.http.routers.*.rule=Host(...)` está correto
- `traefik.http.services.*.loadbalancer.server.port=3000` está correto

### Verificar se o domínio está correto

No `docker-compose.yml`, verifique se o domínio na label do Traefik corresponde ao domínio que você está acessando:
```yaml
- traefik.http.routers.evolution-websocket-manager.rule=Host(`ws.andersonadelino.com.br`)
```

**IMPORTANTE**: Se você está acessando `ws.andersonadelino.com.br`, mas no docker-compose está `websocket.seudominio.com`, você precisa atualizar a label do Traefik para o domínio correto.

### Solução: Recriar o serviço

Se nada funcionar, tente recriar o serviço:
```bash
docker service update --force evolution-websocket-manager_evolution-websocket-manager
```

---

## Problema: Não consigo acessar o painel pela URL configurada

### 1. Verificar se o serviço está rodando

```bash
# Verificar serviços do stack
docker stack services evolution-websocket-manager

# Ver logs do serviço
docker service logs -f evolution-websocket-manager_evolution-websocket-manager

# Verificar status detalhado
docker service ps evolution-websocket-manager_evolution-websocket-manager
```

### 2. Verificar configuração da URL

No `docker-compose.yml`, certifique-se de que:
- A URL está com o protocolo correto: `https://ws.andersonadelino.com.br`
- Não há espaços ou caracteres especiais
- A porta não está na URL (o Docker Swarm gerencia isso)

### 3. Verificar porta exposta

O serviço expõe a porta 3000. Verifique se:
- A porta está configurada corretamente no `docker-compose.yml`
- Não há conflito com outros serviços

```yaml
ports:
  - target: 3000
    published: 3000
    protocol: tcp
    mode: ingress
```

### 4. Verificar Proxy Reverso (Nginx/Traefik)

Se você está usando um proxy reverso (Nginx, Traefik, etc.), verifique:

#### Nginx:
```nginx
server {
    listen 80;
    server_name ws.andersonadelino.com.br;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Traefik (labels no docker-compose.yml):
```yaml
deploy:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.evolution-websocket-manager.rule=Host(`ws.andersonadelino.com.br`)"
    - "traefik.http.routers.evolution-websocket-manager.entrypoints=websecure"
    - "traefik.http.routers.evolution-websocket-manager.tls.certresolver=letsencrypt"
    - "traefik.http.services.evolution-websocket-manager.loadbalancer.server.port=3000"
```

### 5. Verificar DNS

Certifique-se de que o DNS está apontando corretamente:
```bash
# Verificar DNS
nslookup ws.andersonadelino.com.br

# Ou
dig ws.andersonadelino.com.br
```

### 6. Verificar Firewall

Certifique-se de que as portas estão abertas:
- Porta 80 (HTTP)
- Porta 443 (HTTPS)
- Porta 3000 (se acessar diretamente)

### 7. Testar acesso direto

Teste se o serviço está respondendo na porta 3000:
```bash
# De dentro do servidor
curl http://localhost:3000/health

# Ou do seu computador (se a porta estiver exposta)
curl http://SEU_IP_SERVIDOR:3000/health
```

### 8. Verificar logs de erro

```bash
# Logs do serviço
docker service logs evolution-websocket-manager_evolution-websocket-manager

# Logs do container específico
docker logs $(docker ps -q -f name=evolution-websocket-manager)
```

### 9. Verificar variáveis de ambiente

Certifique-se de que todas as variáveis estão configuradas:
```bash
docker service inspect evolution-websocket-manager_evolution-websocket-manager --pretty
```

### 10. Recriar o serviço

Se necessário, recrie o serviço:
```bash
# Atualizar o stack
docker stack deploy -c docker-compose.yml evolution-websocket-manager

# Ou remover e recriar
docker stack rm evolution-websocket-manager
docker stack deploy -c docker-compose.yml evolution-websocket-manager
```

## Checklist Rápido

- [ ] Serviço está rodando (`docker service ls`)
- [ ] URL configurada corretamente no docker-compose.yml
- [ ] DNS apontando para o servidor correto
- [ ] Proxy reverso configurado (se aplicável)
- [ ] Portas abertas no firewall
- [ ] Health check respondendo (`/health`)
- [ ] Logs sem erros críticos

## Erros Comuns

### "Connection refused"
- Serviço não está rodando
- Porta não está exposta
- Firewall bloqueando

### "502 Bad Gateway"
- Proxy reverso não consegue conectar ao serviço
- Serviço não está respondendo na porta 3000

### "404 Not Found"
- Rota não configurada no proxy reverso
- URL incorreta

### "SSL/TLS Error"
- Certificado SSL não configurado
- URL usando HTTPS mas sem certificado

