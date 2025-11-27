# Usar imagem Node.js oficial
FROM node:18-alpine

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar código da aplicação
COPY --chown=nodejs:nodejs . .

# Criar diretório para config com permissões corretas
RUN mkdir -p /app/config && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app/config

# Mudar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Comando para iniciar a aplicação
CMD ["node", "index.js"]