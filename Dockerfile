FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build

ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["npx", "tsx", "api/server.ts"]
