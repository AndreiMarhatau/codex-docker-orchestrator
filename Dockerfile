FROM node:20-bullseye

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    docker.io \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./backend/
COPY ui/package*.json ./ui/
RUN npm -C backend ci
RUN npm -C ui ci

COPY . .
RUN npm -C ui run build

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "backend/src/server.js"]
