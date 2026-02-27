# CCPanel — The Ultimate Valheim Dedicated Server Manager

<div align="center">
  <img src="https://ui-avatars.com/api/?name=CCPanel&background=1e293b&color=D4AF37&size=128" alt="CCPanel Logo">
  <p><strong>A zero-dependency, ultra-lightweight, distributed panel designed specifically for modern Valheim hosting.</strong></p>
</div>

## 🌟 Why CCPanel?

There are many generic server panels out there (Pterodactyl, AMP), but they are often convoluted and heavyweight. **CCPanel** is purpose-built for Valheim using the industry-leading [`lloesche/valheim-server-docker`](https://github.com/lloesche/valheim-server-docker) logic. 

Our panel acts as a beautiful, high-performance orchestration layer that translates your clicks into powerful environment variables, turning hours of server administration into seconds.

### 🎮 For Server Owners (The Experience)
- **One-Click Deploy**: Launching a server takes 3 seconds. Enter a name and password, and we handle the containerization.
- **Unified RCON Console**: Chat, kick, ban, or manually save the world directly from our web terminal.
- **Visual World Modifier**: Want to turn off portals or make death permanent? Adjust sliders in the UI; we instantly hot-swap the game rules. *(In Development)*
- **Crossplay & Mod Support**: Native toggles for Xbox Crossplay and framework injections like BepInEx / ValheimPlus.

### ⚙️ For System Administrators (The Architecture)
- **Zero Heavy Dependencies**: No Redis, no MySQL, no bulky queues. We use a single concurrent **SQLite WAL** database for absolute portability.
- **Distributed by Nature**: One `Master` API controls multiple `Agent` daemons across different bare-metal machines using secure gRPC channels.
- **Real-Time Telemetry**: Millisecond-accurate CPU, RAM, and Docker status streamed via WebSockets. No more F5-refreshing to know if your server is choking.
- **Hands-Free Ops**: Powered by the underlying image's event hooks, the panel inherently supports auto-updates when idle and internal automated backups (retention & crons).

---

## 🚀 Getting Started (Testing & Dev)

### Prerequisites
- Node.js (v20+)
- Go (1.23+)
- Docker (API v1.41+)

### 1. Compile the Backend (Master API & Agent)
```bash
cd ccpanel
# Compile services
go build -o ./bin/ccmaster ./backend/cmd/backend
go build -o ./bin/ccagent ./agent/cmd/agent
```

### 2. Start the Master Server
The Master handles the SQLite database and the REST API.
```bash
./bin/ccmaster
```
*The API will start on `http://localhost:8080`. Your default login is `admin` / `password123`.*

### 3. Connect a Local Agent Daemon
The Agent runs locally or on remote machines, directly managing Docker containers.
```bash
# Obtain your Node Token from the Web Dashboard (Nodes -> Add Node)
# Set your data directory (where game data is mapped)
./bin/ccagent -token "YOUR_NODE_TOKEN" -master "localhost:50051" -data "./data"
```

### 4. Run the Cyberpunk UI (Frontend)
```bash
cd ccpanel/ccpanel-web
npm install
npm run dev
```

---

## 🧠 Architecture Overview

CCPanel follows a strictly decoupled, event-driven pattern:
- **`ccpanel-web`**: React 18, Vite, Tailwind CSS v4, Zustand. Deep dark glassmorphism aesthetic.
- **`backend`**: Gin-Gonic REST API, Gorilla websocket broadcaster, gRPC server for receiving Agent heartbeats.
- **`agent`**: Headless daemon written in Go. Links directly to `/var/run/docker.sock` to orchestrate Valheim containers. Exposes standard RCON client dialing out to containers.

---

## 🤝 Contributing
Welcome, builders! We are heavily dependent on a **Documentation-Driven Development** flow. 
- Please read `docs/ROADMAP.md` and `docs/PRD.md` before picking up an issue. 
- All architecture changes must be logged in PR discussions.
- Follow conventional commits (`feat:`, `fix:`, `docs:`).

*Note: CCPanel is currently in **Phase 2 Development**. We are rolling out our World Modifiers (ENV Hot-reloading) module.*
