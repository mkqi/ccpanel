# CCPanel Architecture Document
> Extracted from active source code on 2026-02-27.

## 1. System Overview
CCPanel is a modern, lightweight, high-performance Valheim dedicated server management panel. The architecture is intentionally decoupled into three core tiers to support multi-node deployments while remaining extremely fast and easy to run.

### Tiers
1. **Frontend (Dashboard)**: React 18 + Vite SPA, styled with Tailwind CSS v4 in a Cyberpunk/Deep-Sea Glassmorphic design.
2. **Backend (Master API)**: Golang 1.23+ process exposing REST APIs and WebSocket endpoints on Port 8080.
3. **Agent (Node Daemon)**: Golang 1.23+ process running directly on the Docker host, exposing a gRPC service on Port 9090.

---

## 2. Communication Topology

### 2.1 Agent <-> Backend (gRPC Bidirectional Stream)
The Agent initiates a single connection to the Backend and upgrades it to a Bidirectional Stream (`ConnectStream`).
- **Direction (Up) Agent -> Backend**: Sends `NodeInfo`, `Heartbeat` (Host metrics), `InstanceSyncData` (Docker container bounds & stats), `LogChunk` (Raw Docker Logs), and `CommandAck` (Action responses).
- **Direction (Down) Backend -> Agent**: Sends `BackendCommand` objects representing Start, Stop, Delete, Create, RCON, etc.

*Benefit*: NAT transversal is implicitly solved because the Agent connects *to* the Master. The Master does not dial out to the Agent.

### 2.2 Frontend <-> Backend (REST + WebSockets)
- **REST APIs**: Standard JSON HTTP requests for synchronous mutations (`/api/v1/auth`, `/api/v1/nodes`, `/api/v1/instances`). 
- **Authentication**: JWT sent via `Authorization: Bearer <token>`.
- **WebSocket (`/monitor`)**: Instead of polling REST endpoints, the server pushes a `full_sync` JSON payload every 5 seconds containing arrays of Nodes and Instances with their vital telemetry. 

---

## 3. Storage (SQLite Schema)
Relies exclusively on `sqlite3` locally using WAL mode for concurrent safely.
- **`nodes`**: Tracks registered Daemons (ID, token, IP, Hostname, OS/Kernel/Docker versions, CPU/Mem telemetry).
- **`instances`**: The core configurations mapped 1:1 with Valheim Docker containers. Stores world names, modifiers (via JSON env_vars), Ports (game_port, status_port, rcon_port), Container ID, Passwords, etc.
- **`backups`**: Table storing archive paths of `/config/worlds_local` `.tar.gz` dumps.
- **`operation_logs`**: Audit trail of every lifecycle event (start, stop, delete).

---

## 4. State Management (Frontend Zustand)
The React Frontend relies on `zustand` to manage asynchronous decoupling.
- **Store Hydration**: When the root `AppShell` loads, `useDataBootstrap` triggers a REST API poll to load all data instantly and hydrate the store.
- **Store Merging**: The WebSockets channel asynchronously overwrites the store metrics with O(1) Map merging (`...existing, ...newInst`), safely avoiding React blank-out crashes while maintaining live telemetry for Gauge charts.
