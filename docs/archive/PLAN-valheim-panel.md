# CCPanel — Valheim 实时服务器管理面板 · 项目计划

> **计划创建**：2026-02-25  
> **项目类型**：WEB (Full-stack SPA)  
> **状态**：🟡 待审核

---

## Goal

从零构建一个基于 Docker 的 Valheim 专用服务器管理面板（CCPanel），采用无侧边栏的科技风上中下布局 SPA，通过 WebSocket 实现资源监控与日志流的实时推送，集成 RCON 控制台、游戏存档管理、自动化运维，Phase 1 为单管理员，Phase 2 扩展为多用户 RBAC。

---

## 用户决策记录

| # | 问题 | 决策 |
|---|------|------|
| 1 | 项目定位 | **全新项目**，不复用 Vallen 代码，重新选型 |
| 2 | 前端技术 | **Vite + React (TS)**，纯 SPA，Go Backend 托管静态文件 |
| 3 | RCON 方案 | **标准 TCP Source RCON 协议**，失败时报错提示，无 fallback |
| 4 | 多用户权限 | **Phase 1 单管理员** → Phase 2 加多用户 RBAC |
| 5 | UI 风格 | **现代 DevOps 风**（Grafana/Portainer 深色主题 + clean cards） |
| 6 | WS 断线策略 | **自动重连 + "连接中"状态条 + 恢复后补推缺失数据** |
| 7 | RCON Fallback | **不做 fallback**，RCON 不可用时显示错误提示 |

---

## Success Criteria

- [ ] 单管理员 JWT 登录 → 进入 SPA Dashboard
- [ ] 一个面板管理多台机器上的 Valheim Docker 实例（创建/启动/停止/重启/删除）
- [ ] WebSocket 实时推送节点资源（CPU/Mem/Disk）+ 实例状态，断线自动重连并补推
- [ ] RCON 控制台可向运行中实例发送命令并接收响应
- [ ] Xterm.js 实时日志终端流式展示容器日志
- [ ] 手动/停前自动备份 + 备份列表 + 一键恢复
- [ ] Graceful Shutdown: save → 等待落盘 → 自动备份 → stop
- [ ] `docker compose up` 一键启动 Backend，单行脚本安装 Agent
- [ ] 全程无侧边栏，科技风上中下布局，DevOps 深色主题

---

## Tech Stack

| 层 | 技术 | 选型理由 |
|----|------|---------|
| **Agent** | Go 1.22+ | 单二进制、Docker SDK 成熟、并发强 |
| **Backend API** | Go + Gin | 统一技术栈、Gin 生态成熟 |
| **数据库** | SQLite (go-sqlite3) | 零依赖、数据量小、个人工具 |
| **内部通信** | gRPC (proto3) | 类型安全、双向流传日志 |
| **实时推送** | gorilla/websocket | Go 标准 WS 库、支持断线重连 + 补推 |
| **定时任务** | robfig/cron v3 | 零外部依赖、嵌入 Backend |
| **RCON** | go Source RCON client | 标准 TCP RCON 协议 |
| **前端框架** | Vite 6 + React 19 + TypeScript | 快速 HMR、纯 SPA |
| **前端 UI 库** | Shadcn/ui + Radix + Tailwind CSS v4 | 可定制深色主题、无运行时 |
| **终端** | Xterm.js | 容器日志终端 |
| **图表** | Recharts | 轻量、React 原生 |
| **状态管理** | Zustand | 轻量、无 boilerplate |
| **HTTP 客户端** | ky / fetch | 轻量 |
| **容器镜像** | lloesche/valheim-server | 社区活跃、BepInEx 支持 |

---

## Architecture

```
Browser (SPA)
  │
  ├── REST API (CRUD, Auth)
  ├── WebSocket /ws/v1/monitor    ← 资源监控实时推送
  ├── WebSocket /ws/v1/logs/:id   ← 实例日志流
  └── WebSocket /ws/v1/rcon/:id   ← RCON 控制台
  │
Backend API (Go · Gin · SQLite)
  ├── gRPC Server ←→ Agent 注册 + 心跳 + 指令
  ├── Cron Scheduler (robfig/cron)
  ├── WS Hub (gorilla/websocket + 断线补推)
  └── Static File Server → serves Vite build
  │
Agent (Go · 单二进制 · 每台游戏机)
  ├── Docker SDK → 容器生命周期
  ├── RCON Client → Valheim RCON 端口
  ├── /proc 采集 → CPU/Mem/Disk
  ├── Backup Module → tar.gz 存档
  └── gRPC Client → 连接 Backend
```

---

## File Structure

```
ccpanel/
├── agent/                        # Agent 守护进程
│   ├── cmd/agent/main.go
│   ├── internal/
│   │   ├── config/               # 配置加载
│   │   ├── docker/               # Docker SDK 封装
│   │   ├── rcon/                 # RCON 客户端
│   │   ├── monitor/              # 资源采集 (CPU/Mem/Disk)
│   │   ├── backup/               # 备份管理
│   │   └── transport/            # gRPC Client
│   └── go.mod
├── backend/                      # Backend API 服务
│   ├── cmd/backend/main.go
│   ├── internal/
│   │   ├── config/               # 配置加载
│   │   ├── api/                  # REST API handlers (Gin)
│   │   ├── grpc/                 # gRPC Server (管 Agent)
│   │   ├── ws/                   # WebSocket Hub + 断线补推
│   │   ├── db/                   # SQLite 数据层 + migrations
│   │   ├── scheduler/            # 实例调度 (端口分配)
│   │   ├── cron/                 # 定时任务
│   │   ├── auth/                 # JWT 认证
│   │   └── rcon/                 # RCON 代理 (转发到 Agent)
│   └── go.mod
├── proto/                        # Protobuf 定义
│   ├── agent.proto
│   └── gen/                      # 生成代码
├── web/                          # Vite + React SPA
│   ├── index.html
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── stores/               # Zustand stores
│   │   ├── hooks/                # Custom hooks (useWebSocket, useRcon)
│   │   ├── components/
│   │   │   ├── layout/           # Header, Footer, StatusBar
│   │   │   ├── dashboard/        # StatCards, NodeCards, InstanceCards
│   │   │   ├── instance/         # InstanceDetail, ConfigEditor
│   │   │   ├── terminal/         # LogTerminal (Xterm.js), RconConsole
│   │   │   ├── backup/           # BackupList, RestoreDialog
│   │   │   ├── monitoring/       # ResourceCharts (Recharts)
│   │   │   └── ui/               # Shadcn/ui components
│   │   ├── lib/
│   │   │   ├── api.ts            # REST API client
│   │   │   ├── ws.ts             # WebSocket client + reconnect + backfill
│   │   │   └── auth.ts           # JWT token management
│   │   └── styles/
│   │       └── globals.css       # Tailwind + 深色主题 tokens
│   ├── tailwind.config.ts
│   └── package.json
├── deploy/                       # 部署配置
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   └── install-agent.sh
├── docs/                         # 项目文档
│   ├── PLAN-valheim-panel.md     # 本文件
│   ├── prd.md
│   ├── architecture-decisions.md
│   ├── change-log.md
│   ├── conversation-log.md
│   └── roadmap.md
├── tasks/                        # 任务追踪
└── go.work                       # Go Workspace
```

---

## Tasks

### Task 1: 项目脚手架 + Proto 定义
**Agent**: `backend-specialist`  
**Skills**: `clean-code`, `api-patterns`  
**Priority**: P0 (Foundation)  
**Dependencies**: None

- [ ] 初始化 Go workspace (`go.work`) + `agent/go.mod` + `backend/go.mod`
- [ ] 编写 `proto/agent.proto`（节点注册、心跳、实例控制、日志流、备份、RCON）
- [ ] `protoc` 生成 Go 代码到 `proto/gen/`
- [ ] 初始化 `web/` Vite + React + TypeScript 项目
- [ ] 配置 Tailwind v4 + Shadcn/ui + 深色主题 token

→ **Verify**: `go build ./...` 各模块编译通过；`cd web && npm run build` 构建成功；proto gen 代码存在

---

### Task 2: Agent 核心（Docker + 监控 + 心跳）
**Agent**: `backend-specialist`  
**Skills**: `clean-code`  
**Priority**: P0 (Core)  
**Dependencies**: Task 1

- [ ] 配置加载 (`/etc/ccpanel/agent.yaml`)
- [ ] Docker SDK 封装：Create / Start / Stop (Graceful) / Restart / Kill / Delete
- [ ] Graceful Shutdown: `docker exec stdin "save"` → 轮询日志 `"World saved"` (30s timeout) → `docker stop`
- [ ] 资源采集：`/proc/stat` CPU、`/proc/meminfo` MEM、`syscall.Statfs` Disk，每 10s
- [ ] 容器 Stats：Docker API `ContainerStats` 每 10s
- [ ] gRPC Client：连接 Backend、Register、Heartbeat 双向流

→ **Verify**: Agent 二进制启动 → 连接 mock gRPC server → 心跳上报正常；手动创建/启停 Valheim 容器成功

---

### Task 3: Backend 核心（gRPC + REST + SQLite + Auth）
**Agent**: `backend-specialist`  
**Skills**: `clean-code`, `api-patterns`, `database-design`  
**Priority**: P0 (Core)  
**Dependencies**: Task 1

- [ ] SQLite 初始化 + auto-migrate（nodes, instances, backups, operation_logs 表）
- [ ] gRPC Server：Agent Register + Heartbeat 接收 + 实例控制指令转发
- [ ] REST API (Gin)：
  - `POST /api/v1/auth/login` → JWT 签发
  - `GET/POST/DELETE /api/v1/nodes` → 节点 CRUD
  - `GET/POST/PUT/DELETE /api/v1/instances` → 实例 CRUD
  - `POST /api/v1/instances/:id/{start,stop,restart,kill}` → 实例控制
  - `POST /api/v1/nodes/:id/{start-all,stop-all}` → 批量操作
- [ ] JWT 中间件鉴权
- [ ] 实例调度器：端口池分配（game_port + status_port）
- [ ] 操作日志记录

→ **Verify**: `curl POST /api/v1/auth/login` 返回 JWT；`curl GET /api/v1/nodes` 返回节点列表；Agent 注册后节点状态变 online

---

### Task 4: WebSocket 实时层（监控 + 日志 + 断线补推）
**Agent**: `backend-specialist`  
**Skills**: `clean-code`  
**Priority**: P0 (Core)  
**Dependencies**: Task 2, Task 3

- [ ] WebSocket Hub 架构：连接管理、房间订阅、消息广播
- [ ] `/ws/v1/monitor` — 全局资源监控推送（所有节点 CPU/Mem/Disk + 实例状态），每 10s
- [ ] `/ws/v1/logs/:id` — 实例日志流（gRPC StreamLogs → WS 转发）
- [ ] 断线补推机制：
  - Backend 维护最近 N 条消息的环形缓冲区（per channel）
  - 客户端重连时携带 `last_received_seq`
  - Backend 从缓冲区补推缺失消息
- [ ] 心跳保活：客户端每 30s ping，服务端 pong，超时断开

→ **Verify**: 打开 WebSocket → 收到实时监控数据；断开 WiFi → 重连 → 收到断线期间缺失的消息；日志流实时显示

---

### Task 5: RCON 集成
**Agent**: `backend-specialist`  
**Skills**: `clean-code`  
**Priority**: P1  
**Dependencies**: Task 2, Task 3

- [ ] Agent 端：实现 Source RCON 协议客户端（TCP，packet format: size + id + type + body）
- [ ] Agent 端：RCON 连接池管理（per instance，空闲超时断开）
- [ ] gRPC 扩展：`RconCommand(instance_id, command)` → `RconResponse`
- [ ] Backend：`/ws/v1/rcon/:id` WebSocket 端点 → 转发到 Agent gRPC → RCON
- [ ] 错误处理：RCON 连接失败 → 返回 `{"error": "RCON unavailable", "reason": "..."}`，前端显示错误提示

→ **Verify**: 对运行中 Valheim 实例发送 RCON `save` 命令 → 收到响应；对未开启 RCON 的实例 → 收到明确错误提示

---

### Task 6: 备份系统
**Agent**: `backend-specialist`  
**Skills**: `clean-code`  
**Priority**: P1  
**Dependencies**: Task 2, Task 3

- [ ] Agent 备份模块：
  - 手动备份：save → tar.gz 压缩 world 文件 → 记录元数据
  - 停前自动备份：Graceful Stop 时 type=`pre-stop`
  - 备份保留策略：每实例 max_count（默认 20），超限删最旧
- [ ] Agent gRPC：CreateBackup, ListBackups, RestoreBackup, DeleteBackup
- [ ] Backend REST API：
  - `GET /api/v1/instances/:id/backups`
  - `POST /api/v1/instances/:id/backups`
  - `POST /api/v1/instances/:id/backups/:bid/restore`
  - `DELETE /api/v1/instances/:id/backups/:bid`
- [ ] Backend Cron：定时备份（默认每 6h）、备份清理（每日凌晨 3 点）

→ **Verify**: 手动备份 → 查看列表 → 大小正确；恢复备份 → 实例重启 → 世界文件已替换；停止实例 → 自动创建 pre-stop 类型备份

---

### Task 7: 前端 SPA（Dashboard + 实例管理 + 终端 + 备份）
**Agent**: `frontend-specialist`  
**Skills**: `frontend-design`, `clean-code`, `react-best-practices`  
**Priority**: P1  
**Dependencies**: Task 3, Task 4, Task 5, Task 6

**UI 布局**（无侧边栏，上中下结构）：
```
┌─────────────────────────────────────────────────────┐
│ [Header] Logo · CCPanel    [Tab Nav]    [Status] 🟢 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Content Area — Tab-based routing]                 │
│                                                     │
│  Tab: Overview    — 统计卡片 + 节点状态 + 实例列表  │
│  Tab: Instances   — 实例卡片网格 + 操作按钮         │
│  Tab: Terminal    — Xterm.js 日志 + RCON 终端       │
│  Tab: Backups     — 备份列表 + 恢复/删除            │
│  Tab: Logs        — 操作日志时间线                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [Footer] 连接状态条 · WS 🟢 · Agent 2/3 在线       │
└─────────────────────────────────────────────────────┘
```

- [ ] 登录页面：用户名+密码 → JWT → 存储 → 跳转 Dashboard
- [ ] Header：Logo + Tab 导航 + 全局连接状态指示灯
- [ ] Footer/StatusBar：WebSocket 连接状态 + Agent 在线数 + 最后更新时间
- [ ] Overview Tab：StatCards（节点数/实例数/运行中/已停止） + NodeCards（CPU/Mem/Disk 进度条） + InstanceCards（状态/端口/快捷操作）
- [ ] Instances Tab：实例卡片网格 + 创建实例 Modal + 实例详情面板（配置编辑 + 连接信息复制）
- [ ] Terminal Tab：Xterm.js 日志终端 + RCON 命令输入框 + 实例选择器
- [ ] Backups Tab：备份列表表格 + 手动备份按钮 + 恢复确认对话框
- [ ] Logs Tab：操作日志时间线（时间、操作、实例、结果）
- [ ] WebSocket Hook：`useWebSocket` 自动重连 + "连接中..."状态条 + 补推
- [ ] Zustand Stores：authStore, nodeStore, instanceStore, wsStore
- [ ] 深色主题：DevOps 风 dark tokens（slate-900 底色、emerald/cyan 强调色、无紫色）

→ **Verify**: 登录 → Overview 看到实时更新的节点和实例状态；点击实例卡片 → Terminal tab 看到实时日志；RCON 输入命令 → 收到响应；断开网络 → 显示"重连中"状态条 → 恢复后数据自动刷新

---

### Task 8: 部署 + 集成测试
**Agent**: `backend-specialist`  
**Skills**: `deployment-procedures`, `testing-patterns`  
**Priority**: P2 (Polish)  
**Dependencies**: Task 2-7 全部完成

- [ ] `deploy/Dockerfile.backend`：多阶段构建 Go Backend + 内嵌 Vite 静态文件
- [ ] `deploy/docker-compose.yml`：Backend 一键启动（env 配置）
- [ ] `deploy/install-agent.sh`：Agent 安装脚本（下载二进制 + 创建配置 + systemd 服务）
- [ ] 端到端测试：Backend + Agent + 真实 Valheim 容器完整链路
- [ ] 文档更新：README.md + 部署指南

→ **Verify**: `docker compose up -d` → Backend 启动 → 访问 `http://localhost:8080` 看到登录页；Agent 安装脚本执行 → 注册到 Backend → 节点在线

---

## Phase X: Final Verification

- [ ] `go build ./agent/cmd/agent` — Agent 编译成功
- [ ] `go build ./backend/cmd/backend` — Backend 编译成功
- [ ] `cd web && npm run build` — 前端构建无 error
- [ ] `go test ./...` — 所有 Go 测试通过
- [ ] `docker compose up` → 完整链路可用
- [ ] WebSocket 实时推送正常 + 断线重连 + 补推
- [ ] RCON 命令发送 + 响应接收
- [ ] 备份创建/列表/恢复/删除
- [ ] Graceful Stop → save + pre-stop 备份 + stop
- [ ] UI 无侧边栏、深色主题、上中下布局
- [ ] 无紫色/紫罗兰色（Purple Ban）
- [ ] 所有文档已更新（PRD, ADR, change-log, roadmap）

---

## Phase 2 预览（本计划不实施，记录于 002/003 任务中等待实施）

| 功能 | 说明 |
|------|------|
| RCON Live Console 面板 | 将 `docker logs -f` 转换进后端 WebSocket 流；支持前端下发指令验证 |
| 动态配置与实例参数编辑 | 点击“更新配置”后可修改世界名与 Modifier 倍率，并挂接重启容器 |
| 颗粒度单实例云端备份 | Agent 对单实例的 `/config/worlds_local` 打包 `tar.gz`；前端触发和下载管理 |
| 实时结构化在线玩家 | 利用 RCON `listplayers` 每分钟轮询推送到面板的 Active Players 列表 |
| 多用户 RBAC | admin / operator / viewer 三种角色 |
| Discord Webhook | 崩溃/启停通知 |
| Mod 管理 | BepInEx / ValheimPlus 一键安装 |

---

## Notes

- **参考项目**：Vallen (`/home/vagrant/vallen/`) 有丰富的领域知识（Graceful Shutdown 流程、端口分配规则、容器配置模板等），可作为**参考但不复用代码**
- **Valheim 特殊性**：不支持标准 SIGTERM 优雅退出，必须先 `save`；RCON 需要在容器启动时开启（`-rcon` 参数或环境变量）
- **容器镜像**：`lloesche/valheim-server` 支持 `SERVER_PASS`、`WORLD_NAME`、`STATUS_HTTP` 等环境变量
- **端口规则**：Valheim 占用 3 个连续 UDP 端口（如 2456/2457/2458），步长至少 10
