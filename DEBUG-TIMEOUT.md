# Debug: Gateway Timeout - Guia de Diagnóstico

## Problema
Gateway Timeout ao acessar o dashboard através do Traefik.

## Checklist de Diagnóstico

### 1. Verificar se o serviço está rodando
```bash
docker service ls | grep evolution-websocket-manager
docker service ps evolution-websocket-manager_evolution-websocket-manager
```

### 2. Verificar logs do serviço
```bash
docker service logs -f evolution-websocket-manager_evolution-websocket-manager
```

### 3. Verificar se o serviço está escutando na porta correta
```bash
# Dentro do container
docker exec -it <container_id> netstat -tlnp | grep 3000
# Ou
docker exec -it <container_id> ss -tlnp | grep 3000
```

### 4. Testar conexão direta ao container (bypass Traefik)
```bash
# Descobrir o IP do container
docker service ps evolution-websocket-manager_evolution-websocket-manager --format "{{.Node}}"
docker node inspect <node_name> --format "{{.Status.Addr}}"

# Testar diretamente
curl http://<container_ip>:3000/health
```

### 5. Verificar configuração do Traefik
```bash
# Verificar se o Traefik está descobrindo o serviço
docker service logs traefik | grep evolution-websocket-manager

# Verificar rotas do Traefik
docker exec -it <traefik_container> wget -qO- http://localhost:8080/api/http/routers | jq '.[] | select(.name | contains("evolution"))'
```

### 6. Verificar rede Docker
```bash
# Verificar se o serviço está na rede correta
docker service inspect evolution-websocket-manager_evolution-websocket-manager --format "{{.Spec.TaskTemplate.Networks}}"

# Verificar se o Traefik está na mesma rede (ou pode acessar)
docker network inspect WebsocketNet
```

### 7. Verificar DNS/Resolução de nomes
```bash
# Dentro do container do Traefik
docker exec -it <traefik_container> nslookup evolution-websocket-manager
docker exec -it <traefik_container> ping evolution-websocket-manager
```

### 8. Testar health check diretamente
```bash
# Do host
curl -v http://localhost:3000/health

# Através do Traefik (se possível)
curl -v https://websocket.seudominio.com/health
```

## Possíveis Causas

1. **Serviço não está escutando na porta 3000**
   - Verificar logs do serviço
   - Verificar se há erros na inicialização

2. **Traefik não está conseguindo descobrir o serviço**
   - Verificar labels do Traefik
   - Verificar se o Traefik está na mesma rede ou pode acessar

3. **Problema de rede Docker**
   - Verificar se o serviço está na rede correta
   - Verificar conectividade entre containers

4. **Timeout muito curto no Traefik**
   - Verificar configuração de timeout do Traefik
   - Aumentar timeout se necessário

5. **Servidor não está respondendo**
   - Verificar se há erros no código
   - Verificar se o servidor está realmente iniciando

## Soluções Aplicadas

1. ✅ Trust proxy configurado
2. ✅ Socket.IO configurado para proxy
3. ✅ Cookies ajustados
4. ✅ Rate limiter não bloqueia / e /health
5. ✅ WebSocket inicialização não bloqueia servidor
6. ✅ Health check simplificado
7. ✅ Rota / com tratamento de erro

## Próximos Passos

Se o problema persistir:

1. Verificar logs detalhados do Traefik
2. Testar conexão direta ao container
3. Verificar se há problemas de firewall
4. Verificar se o volume `evolution_config` existe e tem permissões corretas
5. Verificar se o arquivo `index.html` existe no container

