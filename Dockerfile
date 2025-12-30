FROM node:20-bullseye

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    file \
    build-essential \
    gpg \
    procps \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    docker.io \
    gh \
  && rm -rf /var/lib/apt/lists/*

RUN git config --system credential.helper "!/usr/bin/gh auth git-credential"

WORKDIR /app

RUN useradd -m -s /bin/bash linuxbrew
ENV HOMEBREW_PREFIX=/home/linuxbrew/.linuxbrew
ENV PATH="${HOMEBREW_PREFIX}/bin:${HOMEBREW_PREFIX}/sbin:${PATH}"
ENV HOMEBREW_NO_ANALYTICS=1
ENV HOMEBREW_NO_AUTO_UPDATE=1

USER linuxbrew
RUN NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
  && brew tap andreimarhatau/codex-docker \
  && brew install codex-docker
USER root

COPY backend/package*.json ./backend/
COPY ui/package*.json ./ui/
RUN npm -C backend ci
RUN npm -C ui ci

COPY . .
RUN npm -C ui run build

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "backend/src/server.js"]
