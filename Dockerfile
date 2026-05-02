FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js ./server.js
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
