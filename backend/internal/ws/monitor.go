package ws

import (
	"log"
	"time"

	"ccpanel/backend/internal/db"
)

func StartMonitorPusher() {
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			pushFullSync()
		}
	}()
}

func pushFullSync() {
	// Mark dead nodes offline
	db.DB.Exec(`UPDATE nodes SET status='offline' WHERE status='online' AND last_heartbeat < datetime('now', '-30 seconds')`)
	// Mark instances offline if their node is offline
	db.DB.Exec(`UPDATE instances SET status='offline' WHERE status != 'offline' AND node_id IN (SELECT id FROM nodes WHERE status='offline')`)

	nRows, err := db.DB.Query(`SELECT id,status,cpu_usage,mem_usage,disk_free,disk_total,
		(SELECT COUNT(*) FROM instances WHERE node_id=nodes.id),os_info,kernel_version,docker_version,uptime_secs,last_heartbeat,hostname FROM nodes`)
	if err != nil {
		log.Println("[WS] query nodes error:", err)
		return
	}
	defer nRows.Close()

	var nodes []map[string]interface{}
	for nRows.Next() {
		var id, status, hb, osInfo, kernel, dockerVer, hostname string
		var cpu, mem float64
		var df, dt, ic, uptime int64
		nRows.Scan(&id, &status, &cpu, &mem, &df, &dt, &ic, &osInfo, &kernel, &dockerVer, &uptime, &hb, &hostname)
		nodes = append(nodes, map[string]interface{}{
			"id": id, "status": status, "cpu_usage": cpu,
			"mem_usage": mem, "disk_free": df, "disk_total": dt,
			"instance_count": ic, "os_info": osInfo, "kernel_version": kernel,
			"docker_version": dockerVer, "uptime_secs": uptime,
			"last_heartbeat": hb, "hostname": hostname,
		})
	}

	// Read instances
	iRows, err := db.DB.Query(`SELECT id,node_id,name,world_name,game_port,connect_address,status,cpu_percent,mem_bytes,uptime_secs,player_count,max_players,game_version,world_time,docker_status,created_at FROM instances`)
	if err != nil {
		log.Println("[WS] query instances error:", err)
		return
	}
	defer iRows.Close()

	var instances []map[string]interface{}
	for iRows.Next() {
		var id, nodeID, name, worldName, connAddr, status, ver, wt, dockerStatus, ca string
		var gamePort int
		var cpu float64
		var mem, up int64
		var pc, mp int
		iRows.Scan(&id, &nodeID, &name, &worldName, &gamePort, &connAddr, &status, &cpu, &mem, &up, &pc, &mp, &ver, &wt, &dockerStatus, &ca)
		instances = append(instances, map[string]interface{}{
			"id": id, "node_id": nodeID, "name": name, "world_name": worldName,
			"game_port": gamePort, "connect_address": connAddr,
			"status": status, "cpu_percent": cpu,
			"mem_bytes": mem, "uptime_secs": up, "player_count": pc,
			"max_players": mp, "game_version": ver, "world_time": wt,
			"docker_status": dockerStatus, "created_at": ca,
		})
	}

	msg := Message{
		Type: "full_sync",
		Data: map[string]interface{}{
			"nodes":     nodes,
			"instances": instances,
		},
		Ts: time.Now().Unix(),
	}

	GlobalHub.GetChannel("monitor").Broadcast(msg)
}
