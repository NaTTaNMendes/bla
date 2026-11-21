FROM node:24-slim
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/mapa.db
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
