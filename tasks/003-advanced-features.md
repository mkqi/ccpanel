# Task: Advanced Features & Instance Deep Interaction (Phase 2 Additions)

## 🎯 Objective
Empower the Valheim panel with deep, real-time interactivity. Move beyond basic "start/stop" to rich operational management, console integration, and data lifecycle management directly from the new UI components.

## 📋 Task Breakdown

### 1. Unified Console & RCON Invocation
- [ ] Implement a bi-directional WebSocket system for Live Docker Logs (`docker logs -f`) connected to the Dashboard's Terminal View.
- [ ] Connect the "Quick Command" input component so it directly forwards player inputs to the active RCON tunnel.
- [ ] Handle RCON failure gracefully (e.g., if the user types `/save` but the server is offline or RCON isn't injected).

### 2. Live World Metadata & Dynamic Modification
- [ ] Ensure that hitting `UPDATE INSTANCE CONFIG` on the InstanceOverview page updates the specific Server Name, World Name, or Modifiers.
- [ ] Trigger an associated `docker restart {container}` via the `agent` gRPC service when applying these config overrides so the engine loads the new values.
- [ ] Add explicit Backend validation ensuring config payloads don't overwrite crucial Docker constraints (like image or exposed network ports) by accident.

### 3. Granular Online Player Feed
- [ ] Create a Backend routine that executes `listplayers` via RCON periodically (e.g. every 60 seconds).
- [ ] Feed structured arrays of `[{ name: "Odin", ping: 45 }]` back into the SQLite schema (or an in-memory Redis cache replacement).
- [ ] Wire the `Active Players` card on the dashboard to this explicit data instead of purely relying upon Steam query APIs.

### 4. Direct Instance Backups (World Preservation)
- [ ] Map an Action to trigger `tar.gz` packaging of `/config/worlds_local` targeting the exact `instance_id`.
- [ ] Surface a "Download Backup" button directly inside the Files/Archive tab of the UI.

## ✅ Verification Criteria
- [ ] Type an unexpected text into the Quick Command array and receive an "Unknown command" echo back in the Terminal/Logs UI tab.
- [ ] Modifying `Server Name` via `UPDATE INSTANCE CONFIG` visibly updates the main banner upon reload.
- [ ] A backup generated manually results in a `.zip` or `.tar` that is valid when extracted via standard OS tools.

## 📅 Timeline
- **Start**: (Awaiting Kickoff)
- **Status**: Planning
