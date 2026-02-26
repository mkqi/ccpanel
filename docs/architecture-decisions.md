# 架构决策记录 (Architecture Decision Records)

> 本文件记录 CCPanel 项目中所有重大架构决策。每条 ADR 一旦写入不可删除，只能追加新 ADR 来覆盖旧决策。

---

## ADR-001：采用 Backend-Agent 分布式架构

**日期**：2026-02-25  
**状态**：✅ 已采纳  

### 背景
需要管理分布在 2-5 台机器上的多个 Valheim Docker 实例，需要统一面板。

### 决策
采用 Backend-Agent 模式：
- **Backend**：集中管理面板，负责 API、WebSocket、调度、认证
- **Agent**：每台游戏机上的守护进程，操控 Docker、RCON、文件系统

### 理由
- 关注点分离：Backend 处理业务逻辑，Agent 处理底层资源
- 水平扩展：新增节点只需部署 Agent
- 故障隔离：单个 Agent 故障不影响其他节点

### 后果
- 需维护 Backend ↔ Agent gRPC 通信协议
- 需处理 Agent 离线/重连场景

---

## ADR-002：Backend-Agent 通信采用 gRPC

**日期**：2026-02-25  
**状态**：✅ 已采纳  

### 背景
Backend 与 Agent 之间需要高效、类型安全的双向通信，包括控制指令下发和日志流传输。

### 决策
使用 gRPC proto3，含双向流。

### 理由
- Protocol Buffers 强类型合约
- 双向流天然支持日志流式传输
- Go 生态 gRPC 支持优秀

### 后果
- 前端无法直连 Agent，必须通过 Backend 代理
- 调试比 REST 复杂，需 grpcurl

---

## ADR-003：前端采用 Vite + React SPA

**日期**：2026-02-25  
**状态**：✅ 已采纳  

### 背景
需要一个实时性强的管理面板，WebSocket 深度集成，多个实时数据流同时渲染。

### 决策
Vite 6 + React 19 + TypeScript，纯 SPA 模式，编译为静态文件由 Go Backend 托管。

### 理由
- SPA 模式适合管理面板：无需 SEO、状态保持好、WebSocket 连接稳定
- Vite HMR 极快，开发体验好
- 由 Go Backend 托管静态文件，减少部署复杂度
- 比 Next.js SSR 更轻量，纯管理工具不需要服务端渲染

### 后果
- 首屏加载需 JS bundle（管理面板可接受）
- 所有路由为前端路由，Backend 需配置 SPA fallback

---

## ADR-004：MVP 数据库采用 SQLite

**日期**：2026-02-25  
**状态**：✅ 已采纳  

### 背景
目标用户为个人管理 2-5 台机器，实例数 < 50。

### 决策
嵌入式 SQLite，不引入 PostgreSQL/Redis。

### 理由
- 零外部依赖，部署只需单一二进制
- 数据量极小，SQLite 性能完全够用
- 避免重部署体验

### 后果
- 不支持多 Backend 实例水平扩展
- 并发写入受限（个人场景可接受）

---

## ADR-005：RCON 采用标准 TCP Source RCON 协议

**日期**：2026-02-25  
**状态**：✅ 已采纳  

### 背景
需要向 Valheim 服务端发送控制命令（save、kick、ban 等）并接收响应。

### 决策
实现标准 TCP Source RCON 协议客户端，不提供 docker exec fallback。

### 理由
- Source RCON 是游戏行业标准协议
- 语义清晰：RCON 就是 RCON，不混淆
- 失败时明确报错，便于排查

### 后果
- 要求 Valheim 容器开启 RCON 端口（需要对应环境变量配置）
- 如果 RCON 不可用，控制台功能不可用（而非降级）

---

## ADR-006：WebSocket 断线补推机制

**日期**：2026-02-25  
**状态**：✅ 已采纳  

### 背景
实时监控面板依赖 WebSocket 推送，网络波动会导致数据断档。

### 决策
客户端自动重连 + 服务端环形缓冲区 + 序列号补推。

### 理由
- 保证实时数据连续性
- 环形缓冲区内存开销可控
- 客户端重连时携带 `last_received_seq`，服务端精确补推

### 后果
- 服务端需为每个 channel 维护缓冲区
- 极端长时间断线可能超出缓冲，只能推最新数据

---

## 📋 ADR 模板

```markdown
## ADR-XXX：[决策标题]

**日期**：YYYY-MM-DD  
**状态**：🟡 提议中 / ✅ 已采纳 / ❌ 已废弃 / 🔄 被 ADR-YYY 取代  
**关联文档**：（可选）

### 背景
（什么问题促使了这个决策？）

### 决策
（做出了什么决策？）

### 理由
（为什么选择这个方案？考虑过哪些替代方案？）

### 后果
（这个决策带来的正面和负面影响？）
```
