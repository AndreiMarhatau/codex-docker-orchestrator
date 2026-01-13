FROM node:20-bullseye

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gpg \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
  && curl -fsSL https://download.docker.com/linux/debian/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release; echo \"$VERSION_CODENAME\") stable" \
    > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
    docker-ce-cli \
    gh \
  && rm -rf /var/lib/apt/lists/*

RUN git config --system credential.helper "!/usr/bin/gh auth git-credential"

WORKDIR /app

ARG CODEX_DOCKER_REF=latest
RUN if [ "${CODEX_DOCKER_REF}" = "latest" ]; then \
      CODEX_DOCKER_REF="$(git ls-remote --tags --sort="v:refname" https://github.com/AndreiMarhatau/codex-docker.git \
        | awk -F/ '/refs\\/tags\\// && $NF !~ /\\^\\{\\}$/{print $NF}' \
        | tail -n1)"; \
    fi \
  && if [ -z "${CODEX_DOCKER_REF}" ]; then \
      CODEX_DOCKER_REF="main"; \
    fi \
  && git clone --depth 1 --branch "${CODEX_DOCKER_REF}" \
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
