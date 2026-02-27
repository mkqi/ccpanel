# Task: Docker Instance Re-builder & Dynamic Configuration

## 🎯 Objective
Unlock the full potential of the `lloesche/valheim-server-docker` image by creating a robust **"Environment Rebuilder"** flow. Since advanced features like Backups, Updates, Crossplay, and Modifiers are all perfectly wrapped inside this base image via CLI arguments and ENVs, we simply need a mechanism to gracefully tear down an existing container and spin an identical one up with newly forged `env_vars`.

## 📋 Task Breakdown

### 1. The Environment Pipeline
- [x] **Frontend**: The `InstanceOverview.tsx` has a button titled `UPDATE INSTANCE CONFIG`. We must create a Slide-out Pane or settings grid where the admin can toggle Crossplay, adjust `MODIFIER_PRESET` (e.g. `hardcore`, `casual`), or change password/world name. Note: Creation modal uses exact `SERVER_ARGS` now.
- **Backend API**: The `PUT /api/v1/instances/:id` route handler must receive these preferences, compress them into `json`, update SQLite `env_vars`, and immediately queue an `UPDATE` command to the Agent.
- **Database Mod**: Confirm `env_vars` is properly parsing as a JSON dump on the `instances` table.

### 2. The Agent Recreate Lifecycles (The Rebuilder)
- **Agent Server**: When the Agent receives `ccpanel.BackendCommand_UPDATE`, it must:
   1. Connect via RCON and issue a `/save` to guarantee zero data loss.
   2. Stop the running Docker Container gracefully.
   3. **Remove (`docker rm`)** the old container mapping.
   4. Trigger `docker.CreateInstance` reusing the identical mapped volumes (`/config/worlds_local`, `/config/backups`, etc.), but injecting the newly requested Array of Environment Flags.
   5. Call `StartInstance`.
- **UI Feedback**: Present loading spinners or disable buttons until the gRPC channel acknowledges container rebuild success.

### 3. Rapid Feature Mapping (The Payoff)
Once the Rebuilder is stable, simply wire up these frontend fields to automatically pass into the JSON update payload:
- **World Backups**: `BACKUPS=true`, `BACKUPS_CRON=0 * * * *`, `BACKUPS_MAX_AGE=3`
- **Crossplay**: `CROSSPLAY=true` (Also ensuring port `2458` UDP is opened locally on the Node).
- **Public List**: `SERVER_PUBLIC=true`/`false`
- **Valheim Plus Mod**: `VALHEIM_PLUS=true`

## ✅ Verification Criteria
- [ ] Altering a "Server Password" or "World Modifier" via the UI results in the Docker container fully dropping and re-launching from the Dashboard point of view.
- [ ] Connecting via the game client verifies the new configuration (e.g. death penalty changed, or Mod active) without losing previous world data.
- [ ] The `env_vars` DB column correctly tracks all non-default values across Master restarts.

## 📅 Timeline
- **Start**: Next Development Session
- **Status**: Prioritized & Ready for Work
