# CCPanel API Reference
> Extracted directly from `lib/api.ts` and Backend router logic (2026-02-27)

This document serves as the true source of API endpoints for Master <-> Interface integrations moving forward.

## 1. Authentication
*All endpoints below (except Login) require an `Authorization: Bearer <JWT_TOKEN>` header.*

`POST /api/v1/auth/login`
- **Request**: `{ "username": "...", "password": "..." }`
- **Response**: `{ "token": "eyJ...", "expires_at": "..." }`

## 2. Node (Agent) Management

`GET /api/v1/nodes`
- Retrieves the global list of all registered physical agents.
- **Fields**: `id, name, address, status, cpu_usage, mem_usage, os_info, docker_version, etc.`

`GET /api/v1/nodes/:id`
- Retrieve single node details.

`POST /api/v1/nodes`
- Manually register or claim an IP into the local SQL index.
- **Request**: `{ "name": "...", "address": "..." }`

`DELETE /api/v1/nodes/:id`
- Drops the agent record (Note: Doesn't kill instances, just drops the management entry).

`POST /api/v1/nodes/:id/start-all` | `POST /api/v1/nodes/:id/stop-all`
- Bulk Operations.

## 3. Instances (Docker Container Management)

`GET /api/v1/instances?node_id=:id`
- Lists instances. Filter by node optionally.

`GET /api/v1/instances/:id`
- Single instance stats (and real-time metadata).

`POST /api/v1/instances`
- **Request**: `{ "name": "Valheim Server", "world_name": "earth", "password": "pass", "node_id": "...", "image": "lloesche/valheim-server", "extra_env": { "MODIFIER_PRESET": "Hard" } }`

`PUT /api/v1/instances/:id`
- **Important**: Allows dynamic modification of the InstanceConfig (password, world_name, env_vars). Triggers an update down to the agent.

`DELETE /api/v1/instances/:id?keep_data=false`
- Kills and removes Docker container volume paths unless `keep_data` is specified.

### Controls
`POST /api/v1/instances/:id/start` - Creates/Runs the Container
`POST /api/v1/instances/:id/stop` - Graceful Graceful Shutdown -> Wait -> Stop
`POST /api/v1/instances/:id/restart` - Stop -> Start pipeline.
`POST /api/v1/instances/:id/kill` - Force stop container.

## 4. Console & Logs Subsystem

`POST /api/v1/instances/:id/logs/start`
- Notifies the Backend to start piping the Docker CLI Stdout/Stderr multi-stream payload into the Global Broadcast Hub.

`POST /api/v1/instances/:id/logs/stop`
- Kills the log relaying gRPC context.

## 5. WebSockets Subsystem (Push-Only)

`ws://<domain>/ws/v1/monitor`
- The Frontend `useMonitorWs.ts` connects here. 
- Sent every 5 seconds.
- **Response Format**: 
```json
{
  "type": "full_sync",
  "data": {
    "nodes": [ { ... } ],
    "instances": [ { ... } ]
  }
}
```

## 6. Backups System
`GET /api/v1/instances/:instanceId/backups`
- Listed chronologically by `created_at`.

`POST /api/v1/instances/:instanceId/backups`
- Trigger a manual `tar.gz` archive snapshot immediately.

`POST /api/v1/instances/:instanceId/backups/:backupId/restore`
- Wipe current volume and extract specified archive timestamp.

`DELETE /api/v1/instances/:instanceId/backups/:backupId`
- Prune manual record + host file limit.
