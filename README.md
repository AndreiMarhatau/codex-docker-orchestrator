# Codex Docker Orchestrator

A local backend + UI that manages Codex tasks executed via `codex-docker`. It creates isolated worktrees per task, stores resume tokens, and lets you resume or push later.

## Why this exists
- **Problem:** Codex Web consumes 5 times more than Codex CLI or Codex in VS Code locally. But you super want to hand off tasks to it being in a cafe with only your phone in your pocket.
- **Solution:** Run Codex CLI backed by slick (ish) UI in the same container that Codex Web uses, which is ephemeral and disposable. Leave your laptop on, make it reachable from outside (remember IP + open ports, or use Tailscale) and give it what you want to do. I run it in my Raspberry PI 5 16Gb which is enough for all my tasks.

## Quick start

## Dependencies
- The orchestrator uses the `codex-docker` helper to run Codex inside Docker.

### Prepare UI (backend will automatically serve it if you build it)
```
cd ui
npm install
npm run build
```

### Backend
```
cd backend
npm install
npm run start
```

Once the UI is built, start the backend and visit `http://localhost:8080`. The backend serves the UI bundle from `ui/dist`, and the UI makes same-origin API calls (no separate UI server needed).

### systemd (systemctl)
Copy `codex-docker-orchestrator.service` to `/etc/systemd/system/` and update the placeholders for your machine, then:
```
sudo systemctl daemon-reload
sudo systemctl enable --now codex-docker-orchestrator
```

What the bundled unit does on each start:
- Resets and pulls the latest changes for both `codex-docker` and `codex-docker-orchestrator`.
- Installs dependencies with `npm ci`, builds the UI, then starts the backend with `node src/server.js`.
- Restarts automatically on failure.

Placeholders you should update in the unit file:
- `User` and `WorkingDirectory`
- `CODEX_DOCKER_DIR` and `ORCH_DIR`
- `NODE_BIN` (and `PATH` if you need a custom Node location)

### UI (dev)
```
cd ui
npm install
npm run dev
```

The UI expects the backend at `http://localhost:8080` by default. To point the UI at a different backend (for example, on your LAN), set `VITE_API_BASE_URL` when running the dev server:
```
VITE_API_BASE_URL=http://192.168.1.x:8080 npm run dev
```

You can also set the variable in a `.env` file in `ui/` (for example, `VITE_API_BASE_URL=http://192.168.1.x:8080`) or pass it at build time.

## Scripts
- Backend tests: `npm -C backend test`
- UI tests: `npm -C ui test`

## Docker (host-path)
This runs the orchestrator in a container while using the host Docker engine. It keeps `codex-docker`
working and reuses your host Codex + GitHub credentials.

### Prereqs on the host
- Docker Engine running.
- GitHub auth already set up on the host (for HTTPS pushes), for example:
  - `gh auth login` (device/browser flow, stores token in `~/.config/gh`)

### One-time env setup
```
export HOST_HOME="$HOME"
export ORCH_IMAGE="ghcr.io/andreimarhatau/codex-docker-orchestrator:latest"
export UID="$(id -u)"
export GID="$(id -g)"
export DOCKER_GID="$(stat -c %g /var/run/docker.sock)"
```

### Build and run
```
docker compose up
```
The compose file pulls the published image on each start (`pull_policy: always`).
If the image is private, run `docker login ghcr.io` first.

### Why this works
- The orchestrator uses `docker` and `codex-docker` from inside the container.
- We mount your host home at the same absolute path, so `codex-docker` can bind-mount paths correctly.
- Codex credentials are reused by mounting your host `~/.codex` via the home mount.
- Git HTTPS auth is reused by mounting your host `~/.gitconfig` and `~/.config/gh` via the home mount.

### Notes
- `codex-docker` is baked into the image at a tagged release by default (`v0.0.1`).
- To pin a different release or a branch, set `CODEX_DOCKER_REF` during build.
- The CI workflow builds with a tagged `codex-docker` release; bump it there when you cut a new release.
