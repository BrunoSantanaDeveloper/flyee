# Robô de atendimento do kit whatsapp-support. Sem dependências: só o Node.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY src ./src
# O ffmpeg separa o som, corta em partes, monta a grade de quadros do vídeo e reduz imagem grande, sem
# custo de API (D28). Sem ele, o robô ainda lê imagem pequena; áudio e vídeo vão para a equipe.
# O poppler-utils tira o texto do PDF e faz imagem das páginas de um PDF escaneado (D29). Sem ele,
# o robô ainda lê planilha, CSV e documento de texto; PDF vai para a equipe.
RUN apk add --no-cache ffmpeg poppler-utils
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "src/server.mjs"]
