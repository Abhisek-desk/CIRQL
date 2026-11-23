FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY server/package*.json ./

RUN npm ci --omit=dev

COPY server/src ./src

EXPOSE 5000

CMD ["node", "src/server.js"]
