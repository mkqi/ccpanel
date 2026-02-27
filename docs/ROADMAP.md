# CCPanel Roadmap and Execution State
> Generated on 2026-02-27 based on live UI gaps.

## ✅ Currently Completed & Stable (Phase 1)
- **Monorepo Structure**: Full `go.work` linking Agent, Master, and Proto.
- **REST Initialization**: Fast Bootstrapping of Dashboard telemetry data.
- **WebSocket Streaming**: Master-pushed CPU, RAM, Disk, Docker Uptime metrics without pulling.
- **Microservices Coupling**: Master API `<->` Agent gRPC (Docker CLI wrapping) stable.
- **UI Architecture**: Glassmorphic Cyberpunk deep-sea styling, sidebar, metric shards.
- **SQL Backend**: Full node tracking, basic instance metrics, JWT auth.
- **Node Environment**: OS-Release parsing, Kernel/Docker version injection, and graceful reconnect handlers.

---

## 🏗️ Phase 2: Interactivity & Depth (Current Needs)

These features have placeholder UIs / frontend buttons but **lack full backend implementation**:

### 1. Terminal Console & RCON Control 
The `/instance/:id/console` page is currently a mock layout.
*   **Gap**: No `docker logs -f` stream piped into the UI.
*   **Gap**: The "Quick Command" text input at the bottom of the Overview does not forward to the RCON client inside the Agent.
*   **Target**: Direct TCP-RCON forwarding proxy and bi-directional WebSocket tail.

### 2. Configuration & Parameter Editing
The `InstanceOverview.tsx` has a button titled `UPDATE INSTANCE CONFIG`. 
*   **Gap**: Pressing this does nothing. We need a modal/slider pane for modifying Docker `ENV` variables (like Modifiers `MODIFIER_PRESET`, `WORLD_NAME`).
*   **Target**: API endpoint to replace environment payload -> Trigger Agent to `docker run/restart` with the new arguments -> Wait for Game Server Init -> Report back successful change.

### 3. Active Players Tracking
The `Dashboard` has a donut chart showing "Active Players".
*   **Gap**: The backend assumes Steam UDP Query API fallback or static numbers (`max_players`).
*   **Target**: Inject a 30s-interval routine that leverages the Go-RCON client on the Agent to dispatch `listplayers`, slice the output strings, and pipe structured JSON names back to the SQLite layer for presentation in the panel.

### 4. Direct Archiving (World Backups)
There is a "Backup" or "Snapshot" mechanism planned inside `InstanceHub`.
*   **Gap**: The frontend handles `CreateInstance` and `Delete`, but there is no API logic or script to natively target a world's `/config/worlds_local` volume mounting and package a compressed `.tar` inside the daemon.
*   **Target**: Develop `tar.gz` script -> Execute via gRPC wrapper -> Ship byte streams or store local volume pathways inside the DB -> Supply a Download Link/Button.

---

## 🚀 Phase 3: Community & Scaling (Future Ideas)
- Multi-User Roles (Owner, Administrator, Spectator)
- Automatic Upgrades & Patches
- Mod Manager (BepInEx Plugin Web UI)
- Discord Webhook Integrations for Crash Tracking
