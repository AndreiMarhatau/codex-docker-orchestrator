FROM node:20-bullseye

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    docker.io \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG CODEX_DOCKER_REF=v0.0.1
RUN git clone --depth 1 --branch "${CODEX_DOCKER_REF}" \
    https://github.com/AndreiMarhatau/codex-docker.git /opt/codex-docker \
  && ln -s /opt/codex-docker/codex-docker /usr/local/bin/codex-docker

COPY backend/package*.json ./backend/
COPY ui/package*.json ./ui/
RUN npm -C backend ci
RUN npm -C ui ci

COPY . .
RUN npm -C ui run build

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "backend/src/server.js"]
