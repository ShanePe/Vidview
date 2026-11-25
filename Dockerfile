FROM node:26-alpine

ARG BUILD_VERSION=

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY server.js ./server.js
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
ENV APP_BUILD_VERSION=${BUILD_VERSION}
EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
