# Task: Advanced Features & Instance Deep Interaction

## 🎯 Objective
Complete the "Phase 2" implementation by bringing functionality to the empty UI placeholders currently present in `InstanceOverview` and `InstanceHub`. This involves plumbing the RCON tunnel, Dynamic Configuration, Player Polling, and Archive (Backup) generation systems all the way down to the Go Backend and Agent.

## 📋 Task Breakdown

### 1. Unified Console & RCON Invocation (✅ DONE)
- **Backend**: Expose a REST API or gRPC bridge to accept raw text strings (e.g., `save`, `kick <player>`).
- **Agent**: Forward these strings through the RCON TCP connection on the assigned Docker instance. Provide a robust timeout in case the game loop is frozen.
- **Frontend**: Connect the "Quick Command" text input and the `Terminal` component to this new system, streaming the responses back up via the `logs` WebSocket.

### 2. Live World Metadata & Dynamic Modification
- **Frontend**: The `UPDATE INSTANCE CONFIG` button needs to open a dialog or directly alter the state of `MODIFIER_PRESET`, `WORLD_NAME`, etc.
- **Backend**: Implement the `PUT /api/v1/instances/:id` route handler. Replace SQLite values and queue a `RESTART` command to the Agent.
- **Agent**: Destroy the current container mapping and spawn a new one with the updated `ENV` variables parsed securely.

### 3. Granular Online Player Feed
- **Agent**: Spawn a persistent goroutine for each active (`running`) instance. Every 30-60 seconds, fire an RCON `listplayers` or A2S query.
- **Backend / DB**: Collect this structured player payload (e.g., Name, Ping, SteamID) and emit it via the `full_sync` WebSocket message or push it to SQLite.
- **Frontend**: Wire the existing `Active Players` card/donut chart to this real data, replacing the static `/ 10` mock limit.

### 4. Direct Instance Backups (World Preservation)
- **Agent**: Create a handler for archiving. Execute `tar -czvf` on the host mapping (e.g., `/home/ccpanel/data/instances/{id}/config/worlds_local`). 
- **Backend**: Surface `POST /api/v1/instances/:id/backups` and `GET`/`DELETE` variants.
- **Frontend**: Activate the "Download Backup" button in the `Files` / `Backups` Tab so admins can manually save historical milestones or pull the `.fwl`/`.db` chunks to their local machines.

## ✅ Verification Criteria
- [x] Typing `/save` into the Dashboard UI results in a verified RCON "World saved" echo.
- [ ] Changing basic server modifiers triggers an automatic reboot, and the new settings are correctly reflected inside the game.
- [ ] Real-time player arrays populate the "Active Players" graphic automatically upon game entry.
- [ ] A generated Backup is verified valid via `tar -tzf archive.tar.gz`.

## 📅 Timeline
- **Start**: (Action Required)
- **Status**: Ready for Implementation
