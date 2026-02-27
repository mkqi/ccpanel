# Task: Backend Integration & Feature Polish (Phase 1 Extension)

## 🎯 Objective
Bridge the gap between the new UI/UX design and the actual backend data capabilities. Implement the missing metadata extraction and real-time interaction features.

## 📋 Task Breakdown

### 1. Metadata Extraction (Agent-side)
- [ ] Implement game version extraction from Valheim container logs or build.id files.
- [ ] Implement Mod detection (checking for BepInEx directories within container volumes).
- [ ] Implement world modifier parsing (reading `world_name.db` meta or startup arguments).

### 2. Real-time Interaction (Master-side)
- [ ] Implement a dedicated RCON command proxy for the "Quick Command" box.
- [ ] Implement periodic `listplayers` execution and transform output into a structured JSON feed for the frontend.
- [ ] Cache instance "peak load" (max CPU/Mem) in SQLite to display in the Dashboard table.

### 3. Frontend Polishing
- [ ] Bind real-time player data from the WebSocket feed to the Overview player table.
- [ ] Implement a Command History (stack) for the Quick Command input (Up/Down arrows).
- [ ] Add loading/success states for the "Create Manual Backup" action.

### 4. Infrastructure UX
- [ ] Implement the "Add Node" modal with backend validation.
- [ ] Implement the "Create Instance" modal with node capacity check.

## ✅ Verification Criteria
- [ ] Dashboard shows actual "Mods: Vanilla/Modded" and "Peak Load" status.
- [ ] Mission Control Overview displays the correct Server Password (revealed on click).
- [ ] Quick Commands successfully affect the game server (verified via logs).
- [ ] Online player list updates in near real-time.

## 📅 Timeline
- **Start**: 2026-02-26 09:00
- **Deadline**: 2026-02-26 18:00
