# Codex Docker Orchestrator

A local backend + UI that manages Codex tasks executed via `codex-docker`. It creates isolated worktrees per task, stores resume tokens, and lets you resume or push later.

## Why this exists
- **Problem:** Codex Web consumes 5 times more than Codex CLI or Codex in VS Code locally. But you super want to hand off tasks to it being in a cafe with only your phone in your pocket.
- **Solution:** Run Codex CLI backed by slick (ish) UI in the same container that Codex Web uses, which is ephemeral and disposable. Leave your laptop on, make it reachable from outside (remember IP + open ports, or use Tailscale) and give it what you want to do. I run it in my Raspberry PI 5 16Gb which is enough for all my tasks.

## Quick start

## Dependencies
- It uses "codex-docker" command from "https://github.com/AndreiMarhatau/codex-docker.git" repo, check it out on how to install it and set to be available everywhere.

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
