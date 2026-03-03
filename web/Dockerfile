FROM node:20-alpine

WORKDIR /app

COPY package.json package.json
COPY server.js server.js
COPY public/ public/
COPY .env .env

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
