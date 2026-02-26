# 变更日志 (Change Log)

> 记录每次代码和文档变更。所有条目按时间倒序排列。

---

## 2026-02-25

### `ui:` Instance Mission Control 深度重构与导航扁平化
- **Mission Control 转型**: 
  - 彻底移除了侧边栏布局，变更为全宽“指挥官横幅”模式，最大化终端和列表视野。
  - **Overview Tab 重定义**: 引入“世界规则卡片”（包括密码开关、Mod 状态、世界倍率）与“活跃玩家列表”作为首屏核心。
  - **RCON 快捷入口**: 在 Overview 首页集成一键指令发送框，无需切页即可快速管理。
- **导航扁平化**: 
  - 移除了冗余的 `Instances` 列表页。
  - 实现从全局 `Overview` 直接下钻至实例详情的链路。
  - 简化 Header 逻辑，确保“Dashboard”即为唯一全局出口。
- **视觉语言对齐**: 实例详情页全面复用 Dashboard 的 `MetricCard` 与 `Table` 样式，确保全局 UI 节奏一致。

---

## 2026-02-26

### `fix:` 后端通信循环依赖阻塞修复 (Import Cycle Fix)
- **依赖解耦**: 通过在 `grpc` 服务中引入 `LogCallback func` 的回调注入方式，彻底解除了 `api` -> `grpc` -> `ws` -> `grpc` 的循环依赖问题。
- **稳定性恢复**: 解决了 Backend 因循环依赖导致 `go build` 崩溃，进而导致前端发至 8080 端口 `/api/v1/instances` 持续抛出 `500 Internal Server Error` 且 Agent (9090) 无法连接的问题。

### `feat:` Docker 容器实时日志 WebSocket 推流
- **Agent 流处理**: 新增 `StreamLogs` 函数，利用 `stdcopy` 处理 Docker 引擎原生 Stdout / Stderr 的多路复用，通过 `LogChunk` 逐行回传至 Backend。
- **Backend WebSocket**: 新增 `ws.BroadcastLogChunk` 将收集到的日志精准路由转发给特定实例的 WebSocket 频道 ('logs/{id}')。
- **前端 Console**: 深度集成 WebSocket API 到 Console 组件。实时流式渲染最新的 1000 行容器终端日志，完美取代了之前的 Mock 显示，具备日志级别类型染色 (INFO, WARN, ERROR)。

### `ui:` UI/UX "Pro Max" 视觉体系升级
- **Retro-Futurism 设计**: 引入霓虹紫/粉配色体系，全面应用玻璃拟态（Glassmorphism）视觉效果。
- **布局重构**: 将传统的顶部 Tab 导航升级为**侧边栏 (Sidebar)** 导航，提升操作效率。
- **字体标准**: 引入 Fira Sans (正文) 与 Fira Code (技术指标/端口)，强化专业感。
- **组件优化**:
  - 重塑 Login 登录页：加入 3D 视角网格背景与发光卡片。
  - 升级 Overview/Instances 列表：加入悬浮浮动、霓虹边框与性能指标色彩编码。
  - 优化 Terminal/Backups/Logs：采用分栏布局与时间轴组件，契合 DevOps 审美。
- **文档更新**: 生成并集成了 `design-system/ccpanel/MASTER.md` 视觉规范。

---

## 2026-02-25

### `feat:` 实现 Agent 核心与 RCON/备份功能
- 完成 Agent Docker 容器生命周期管理
- 实现 Source RCON 协议客户端与 gRPC 代理
- 实现基于 tar.gz 的世界存档备份模块
- 完成节点资源监控（CPU/Mem/Disk）采集

### `feat:` 实现 Backend 核心与 WebSocket 实时监控
- 实现基于 gRPC 的双向流通信架构（支持 NAT 穿透）
- 完成 REST API (Gin) 与 SQLite 持久化层
- 实现 WebSocket Monitor 推送，支持前端实时感知节点/实例状态
- 完成 JWT 认证与操作日志记录

### `feat:` 完成 Web 前端基础架构与 UI
- 基于 Vite + React + Tailwind 实现 DevOps 主题 UI
- 完成 Overview, Instances, Terminal, Backups, Logs 五大核心 Tab
- 集成 Xterm.js 实现控制台日志流与 RCON 交互
- 实现基于 Zustand 的状态管理与响应式数据流

### `docs:` 初始化项目文档体系
- 创建 `docs/PLAN-valheim-panel.md` — 完整项目计划
- 创建 `docs/conversation-log.md` — 对话记录
- 创建 `docs/change-log.md` — 变更日志（本文件）
- 创建 `docs/architecture-decisions.md` — ADR 架构决策
- 创建 `docs/roadmap.md` — 产品路线图

---
