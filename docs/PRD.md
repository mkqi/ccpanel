# Product Requirements Document (PRD)

*This is the unified, single-source-of-truth reference for CCPanel development.*

## 🎯 1. The Core Objective
CCPanel exists to simplify and streamline the chaotic process of running and managing dedicated Valheim servers on Linux. The goal is an "invisible" infrastructure backend and a striking, cyberpunk-themed frontend that offers instant "aha!" moments to game administrators.

## 🧭 2. The Three Dimensions of Features

### A. The End-User Game Hosting (The "Wow" Layer)
**Target**: Gamers and Guild Masters who want simple controls without Linux knowledge.
- **Visual Instantiation**: Create servers rapidly using a 3-field UI form.
- **Unified Master Console**: A live, web-based terminal sending raw RCON commands (`save`, `kick`, `ban`) to isolated Docker containers. *(✅ Completed)*
- **World Modification UI**: Direct toggle logic to modify Valheim's internal systems (No Maps, Increased Ore, Hardcore Death) without editing config files. *(In Progress)*
- **Crossplay Expansion**: Checkbox activation for `CROSSPLAY=true` and port adjustments `2458 UDP`. *(In Progress)*

### B. Infrastructure & System (The "Muscle" Layer)
**Target**: System Administrators and Homelab users handling multiple machines.
- **Node-Agent Distributed Topology**: Master acts as a brain, Agent handles Docker execution. Secure RPC links. *(✅ Completed)*
- **Zero-Friction Dependencies**: Entire configuration relies on `sqlite3` in WAL mode. Absolute avoidance of Redis or standalone SQL servers. *(✅ Completed)*
- **Leveraging External Mastery**: Unlike generic panels, we heavily abuse the robust feature set of the famous `lloesche/valheim-server-docker` image.
  - We **do not write** custom backup crons in Go. We map UI variables to Docker `ENV` fields (`BACKUPS=true`, `BACKUPS_CRON=0 5 * * *`) and let the container do the work.
  - We **do not script** update checks. We map `UPDATE_CRON` into the container.

### C. Advanced Administrative Control (The "God Mode" Layer)
**Target**: Serious community organizers orchestrating 50+ player clusters.
- **Container Metric Streaming**: Websocket delivery of CPU and memory chunks. *(✅ Completed)*
- **Live Roster Polling**: Periodically querying RCON to extract online player SteamIDs to display on the dashboard UI.
- **Resource Sandboxing**: Setting hard memory and core limits via Docker Cgroups to protect the host Node. *(Future)*
- **Mod Management Framework**: Exposing toggles for `BEPINEX=true` and `VALHEIM_PLUS=true`, allowing users to build custom frameworks on creation.

---

## 🛠️ 3. Immediate Implementation Priorities (The "Env Rebuilder")
Since we are offloading significant logic to the Docker container itself via Environmental Variables, our **primary functional necessity** right now is:

**The Docker Environment Rebuilder Pipeline**:
1. When a user changes settings on the Web Panel (e.g. World Variables, Modifiers, Passwords).
2. The Database updates the stored JSON structure for `extra_env`.
3. The Backend transmits an `UPDATE/REBUILD` gRPC command to the node.
4. The Node's Agent smoothly executes:
   - Save via RCON (`/save`).
   - Stop and Remove Container (`docker stop && docker rm`).
   - Recreate the exact identical Container mapping with newly parsed ENV arrays.
   - Restart the Container.
5. Emits "Rebuild Complete" telemetry to UI.

Once the "Env Rebuilder" is complete, **adding features like backups, crossplay, and game difficulty takes a few lines of frontend code instead of backend overhauls**.
