package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"ccpanel/backend/internal/auth"
	"ccpanel/backend/internal/config"
	"ccpanel/backend/internal/db"
	importGrpc "ccpanel/backend/internal/grpc"
	"ccpanel/proto/gen/ccpanel"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	// Auth
	r.POST("/api/v1/auth/login", loginHandler(cfg))

	// Authenticated routes
	api := r.Group("/api/v1")
	api.Use(auth.JWTMiddleware())
	{
		// Nodes
		api.GET("/nodes", listNodes)
		api.GET("/nodes/:id", getNode)
		api.POST("/nodes", createNode)
		api.DELETE("/nodes/:id", deleteNode)
		api.POST("/nodes/:id/stop-all", stopAllInstances)
		api.POST("/nodes/:id/start-all", startAllInstances)

		// Instances
		api.GET("/instances", listInstances)
		api.GET("/instances/:id", getInstance)
		api.POST("/instances", createInstance)
		api.PUT("/instances/:id", updateInstance)
		api.DELETE("/instances/:id", deleteInstance)
		api.POST("/instances/:id/start", startInstance)
		api.POST("/instances/:id/stop", stopInstance)
		api.POST("/instances/:id/restart", restartInstance)
		api.POST("/instances/:id/kill", killInstance)
		api.POST("/instances/:id/rcon", sendRconCommand)
		api.POST("/instances/:id/logs/start", streamLogsStart)
		api.POST("/instances/:id/logs/stop", streamLogsStop)

		// Backups
		api.GET("/instances/:id/backups", listBackups)
		api.POST("/instances/:id/backups", createBackup)
		api.POST("/instances/:id/backups/:bid/restore", restoreBackup)
		api.DELETE("/instances/:id/backups/:bid", deleteBackup)

		// Logs
		api.GET("/logs", listLogs)
	}

	return r
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization,Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func loginHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Username string `json:"username" binding:"required"`
			Password string `json:"password" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		if req.Username != cfg.AdminUser || req.Password != cfg.AdminPass {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		token, exp, err := auth.GenerateToken(req.Username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token":      token,
			"expires_at": exp.Format(time.RFC3339),
		})
	}
}

// ---- Node handlers ----

func listNodes(c *gin.Context) {
	rows, err := db.DB.Query(`SELECT id,name,address,token,status,cpu_usage,mem_usage,disk_free,disk_total,
		(SELECT COUNT(*) FROM instances WHERE node_id=nodes.id),os_info,kernel_version,docker_version,uptime_secs,COALESCE(last_heartbeat,''),created_at,hostname FROM nodes ORDER BY created_at`)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var nodes []gin.H
	for rows.Next() {
		var id, name, addr, token, status, hb, ca, osInfo, kernel, dockerVer, hostname string
		var cpu, mem float64
		var df, dt, ic, uptime int64
		rows.Scan(&id, &name, &addr, &token, &status, &cpu, &mem, &df, &dt, &ic, &osInfo, &kernel, &dockerVer, &uptime, &hb, &ca, &hostname)
		nodes = append(nodes, gin.H{
			"id": id, "name": name, "address": addr, "status": status,
			"cpu_usage": cpu, "mem_usage": mem, "disk_free": df, "disk_total": dt,
			"instance_count": ic, "os_info": osInfo, "kernel_version": kernel,
			"docker_version": dockerVer, "uptime_secs": uptime,
			"last_heartbeat": hb, "created_at": ca, "hostname": hostname,
		})
	}
	if nodes == nil {
		nodes = []gin.H{}
	}
	c.JSON(200, nodes)
}

func getNode(c *gin.Context) {
	id := c.Param("id")
	var name, addr, token, status, hb, ca, osInfo, kernel, dockerVer, hostname string
	var cpu, mem float64
	var df, dt, ic, uptime int64
	err := db.DB.QueryRow(`SELECT id,name,address,token,status,cpu_usage,mem_usage,disk_free,disk_total,
		(SELECT COUNT(*) FROM instances WHERE node_id=nodes.id),os_info,kernel_version,docker_version,uptime_secs,COALESCE(last_heartbeat,''),created_at,hostname FROM nodes WHERE id=?`, id).
		Scan(&id, &name, &addr, &token, &status, &cpu, &mem, &df, &dt, &ic, &osInfo, &kernel, &dockerVer, &uptime, &hb, &ca, &hostname)
	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "node not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{
		"id": id, "name": name, "address": addr, "status": status,
		"cpu_usage": cpu, "mem_usage": mem, "disk_free": df, "disk_total": dt,
		"instance_count": ic, "os_info": osInfo, "kernel_version": kernel,
		"docker_version": dockerVer, "uptime_secs": uptime,
		"last_heartbeat": hb, "created_at": ca, "hostname": hostname,
	})
}

func createNode(c *gin.Context) {
	var req struct {
		Name    string `json:"name" binding:"required"`
		Address string `json:"address" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "name and address required"})
		return
	}
	var existing int
	err := db.DB.QueryRow(`SELECT COUNT(*) FROM nodes WHERE address=?`, req.Address).Scan(&existing)
	if err == nil && existing > 0 {
		c.JSON(409, gin.H{"error": "A node with this IP address already exists"})
		return
	}

	id := uuid.New().String()
	token := uuid.New().String()
	_, err = db.DB.Exec(`INSERT INTO nodes(id,name,address,token) VALUES(?,?,?,?)`, id, req.Name, req.Address, token)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	logOperation("", id, "create_node", req.Name, "success")
	c.JSON(201, gin.H{"id": id, "name": req.Name, "address": req.Address, "token": token, "status": "offline"})
}

func deleteNode(c *gin.Context) {
	id := c.Param("id")
	res, err := db.DB.Exec(`DELETE FROM nodes WHERE id=?`, id)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(404, gin.H{"error": "node not found"})
		return
	}
	logOperation("", id, "delete_node", "", "success")
	c.Status(204)
}

func stopAllInstances(c *gin.Context)  { c.JSON(200, gin.H{"message": "stop-all queued"}) }
func startAllInstances(c *gin.Context) { c.JSON(200, gin.H{"message": "start-all queued"}) }

// ---- Instance handlers ----

func listInstances(c *gin.Context) {
	query := `SELECT i.id,i.node_id,i.name,i.world_name,i.password,i.game_port,i.status_port,i.rcon_port,i.status,i.docker_status,i.docker_id,i.image,i.connect_address,i.cpu_percent,i.mem_bytes,i.uptime_secs,i.player_count,i.env_vars,i.created_at,i.updated_at,COALESCE(n.name,'') FROM instances i LEFT JOIN nodes n ON i.node_id=n.id`
	args := []interface{}{}
	if nid := c.Query("node_id"); nid != "" {
		query += " WHERE i.node_id=?"
		args = append(args, nid)
	}
	query += " ORDER BY i.created_at"
	rows, err := db.DB.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var list []gin.H
	for rows.Next() {
		var id, nid, name, wn, pw, status, dstatus, did, img, ca, ua, nn, ev, conn string
		var gp, sp, rp int
		var cpu float64
		var mem, up int64
		var pc int
		rows.Scan(&id, &nid, &name, &wn, &pw, &gp, &sp, &rp, &status, &dstatus, &did, &img, &conn, &cpu, &mem, &up, &pc, &ev, &ca, &ua, &nn)
		list = append(list, gin.H{
			"id": id, "node_id": nid, "node_name": nn, "name": name, "world_name": wn,
			"password": pw, "game_port": gp, "status_port": sp, "rcon_port": rp, "status": status,
			"docker_status": dstatus, "docker_id": did, "image": img, "connect_address": conn,
			"cpu_percent": cpu, "mem_bytes": mem, "uptime_secs": up, "player_count": pc,
			"created_at": ca, "updated_at": ua,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, list)
}

func getInstance(c *gin.Context) {
	id := c.Param("id")
	var nid, name, wn, pw, status, dstatus, did, img, ca, ua, nn, ev, conn, ver, wt string
	var gp, sp, rp int
	var cpu float64
	var mem, up int64
	var pc, mp int
	err := db.DB.QueryRow(`SELECT i.id,i.node_id,i.name,i.world_name,i.password,i.game_port,i.status_port,i.rcon_port,i.status,i.docker_status,i.docker_id,i.image,i.connect_address,i.cpu_percent,i.mem_bytes,i.uptime_secs,i.player_count,i.env_vars,i.created_at,i.updated_at,COALESCE(n.name,''),i.max_players,i.game_version,i.world_time FROM instances i LEFT JOIN nodes n ON i.node_id=n.id WHERE i.id=?`, id).
		Scan(&id, &nid, &name, &wn, &pw, &gp, &sp, &rp, &status, &dstatus, &did, &img, &conn, &cpu, &mem, &up, &pc, &ev, &ca, &ua, &nn, &mp, &ver, &wt)
	if err == sql.ErrNoRows {
		c.JSON(404, gin.H{"error": "instance not found"})
		return
	}
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	var evMap map[string]string
	json.Unmarshal([]byte(ev), &evMap)

	c.JSON(200, gin.H{
		"id": id, "node_id": nid, "node_name": nn, "name": name, "world_name": wn,
		"password": pw, "game_port": gp, "status_port": sp, "rcon_port": rp, "status": status,
		"docker_status": dstatus, "docker_id": did, "image": img, "connect_address": conn,
		"cpu_percent": cpu, "mem_bytes": mem, "uptime_secs": up, "player_count": pc,
		"max_players": mp, "game_version": ver, "world_time": wt,
		"env_vars": evMap, "created_at": ca, "updated_at": ua,
	})
}

func createInstance(c *gin.Context) {
	var req struct {
		Name         string `json:"name" binding:"required"`
		WorldName    string `json:"world_name" binding:"required"`
		Password     string `json:"password" binding:"required"`
		NodeID       string `json:"node_id" binding:"required"`
		Image        string `json:"image"`
		RconPassword string `json:"rcon_password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "missing required fields"})
		return
	}
	if req.Image == "" {
		req.Image = "lloesche/valheim-server:latest"
	}

	// Allocate ports
	gamePort, statusPort, rconPort := allocatePorts(req.NodeID)

	id := uuid.New().String()
	_, err := db.DB.Exec(`INSERT INTO instances(id,node_id,name,world_name,password,game_port,status_port,rcon_port,rcon_password,image,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
		id, req.NodeID, req.Name, req.WorldName, req.Password, gamePort, statusPort, rconPort, req.RconPassword, req.Image, "creating")
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	var token string
	db.DB.QueryRow(`SELECT token FROM nodes WHERE id=?`, req.NodeID).Scan(&token)

	cmd := &ccpanel.BackendCommand{
		CommandId: id,
		Command:   ccpanel.BackendCommand_CREATE,
		Config: &ccpanel.InstanceConfig{
			InstanceId:   id,
			Name:         req.Name,
			WorldName:    req.WorldName,
			Password:     req.Password,
			Image:        req.Image,
			GamePort:     int32(gamePort),
			StatusPort:   int32(statusPort),
			RconPort:     int32(rconPort),
			RconPassword: req.RconPassword,
		},
	}
	importGrpc.SendCommandToNode(token, cmd)

	logOperation(id, req.NodeID, "create", req.Name, "queued")
	c.JSON(201, gin.H{"id": id, "name": req.Name, "game_port": gamePort, "status": "creating"})
}

func updateInstance(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}
	if req.Name != "" {
		db.DB.Exec(`UPDATE instances SET name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, req.Name, id)
	}
	if req.Password != "" {
		db.DB.Exec(`UPDATE instances SET password=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, req.Password, id)
	}
	c.JSON(200, gin.H{"message": "updated"})
}

func deleteInstance(c *gin.Context) {
	id := c.Param("id")
	
	var nid, token string
	db.DB.QueryRow(`SELECT node_id FROM instances WHERE id=?`, id).Scan(&nid)
	db.DB.QueryRow(`SELECT token FROM nodes WHERE id=?`, nid).Scan(&token)
	if token != "" {
		importGrpc.SendCommandToNode(token, &ccpanel.BackendCommand{
			CommandId: uuid.New().String(),
			Command:   ccpanel.BackendCommand_DELETE,
			Config:    &ccpanel.InstanceConfig{InstanceId: id},
		})
	}

	res, _ := db.DB.Exec(`DELETE FROM instances WHERE id=?`, id)
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(404, gin.H{"error": "instance not found"})
		return
	}
	logOperation(id, "", "delete", "", "success")
	c.Status(204)
}

func startInstance(c *gin.Context) {
	id := c.Param("id")
	db.DB.Exec(`UPDATE instances SET status='starting', docker_status='' WHERE id=?`, id)
	sendActionToAgent(id, ccpanel.BackendCommand_START)
	logOperation(id, "", "start", "", "success")
	c.JSON(200, gin.H{"message": "start requested"})
}

func stopInstance(c *gin.Context) {
	id := c.Param("id")
	db.DB.Exec(`UPDATE instances SET status='stopping', docker_status='' WHERE id=?`, id)
	sendActionToAgent(id, ccpanel.BackendCommand_STOP)
	logOperation(id, "", "stop", "", "success")
	c.JSON(200, gin.H{"message": "stop requested"})
}

func restartInstance(c *gin.Context) {
	id := c.Param("id")
	db.DB.Exec(`UPDATE instances SET status='stopping', docker_status='' WHERE id=?`, id)
	sendActionToAgent(id, ccpanel.BackendCommand_RESTART)
	logOperation(id, "", "restart", "", "success")
	c.JSON(200, gin.H{"message": "restart requested"})
}

func killInstance(c *gin.Context) {
	id := c.Param("id")
	sendActionToAgent(id, ccpanel.BackendCommand_KILL)
	logOperation(id, "", "kill", "", "success")
	c.JSON(200, gin.H{"message": "killed"})
}

func streamLogsStart(c *gin.Context) {
	id := c.Param("id")
	sendActionToAgent(id, ccpanel.BackendCommand_STREAM_LOGS_START)
	c.JSON(200, gin.H{"message": "log streaming started"})
}

func streamLogsStop(c *gin.Context) {
	id := c.Param("id")
	sendActionToAgent(id, ccpanel.BackendCommand_STREAM_LOGS_STOP)
	c.JSON(200, gin.H{"message": "log streaming stopped"})
}

func sendRconCommand(c *gin.Context) {
	instanceID := c.Param("id")
	var req struct {
		Command string `json:"command" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var nid, token string
	var rconPort int
	var rconPass sql.NullString
	err := db.DB.QueryRow(`
		SELECT i.node_id, n.token, i.rcon_port, i.rcon_password
		FROM instances i
		JOIN nodes n ON i.node_id = n.id
		WHERE i.id=?`, instanceID).Scan(&nid, &token, &rconPort, &rconPass)

	if err != nil || token == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "instance or node not found"})
		return
	}

	if rconPort == 0 || !rconPass.Valid || rconPass.String == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RCON is not configured for this instance"})
		return
	}

	cmd := &ccpanel.BackendCommand{
		CommandId: uuid.New().String(),
		Command:   ccpanel.BackendCommand_RCON,
		Payload:   req.Command,
		Config: &ccpanel.InstanceConfig{
			InstanceId:   instanceID,
			RconPort:     int32(rconPort),
			RconPassword: rconPass.String,
		},
	}

	ack, err := importGrpc.GetServer().WaitForResult(token, cmd, 10*time.Second)
	if err != nil {
		c.JSON(http.StatusGatewayTimeout, gin.H{"error": "RCON command timed out: " + err.Error()})
		return
	}

	if !ack.Success {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "RCON command failed", "detail": ack.Error})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Command executed", "result": ack.Result})
}

func sendActionToAgent(instanceID string, cmdType ccpanel.BackendCommand_CommandType) {
	var nid, token string
	db.DB.QueryRow(`SELECT node_id FROM instances WHERE id=?`, instanceID).Scan(&nid)
	db.DB.QueryRow(`SELECT token FROM nodes WHERE id=?`, nid).Scan(&token)
	if token != "" {
		importGrpc.SendCommandToNode(token, &ccpanel.BackendCommand{
			CommandId: uuid.New().String(),
			Command:   cmdType,
			Config:    &ccpanel.InstanceConfig{InstanceId: instanceID},
		})
	}
}

// ---- Backup handlers ----

func listBackups(c *gin.Context) {
	instanceID := c.Param("id")
	rows, err := db.DB.Query(`SELECT id,instance_id,type,file_path,size_bytes,note,created_at FROM backups WHERE instance_id=? ORDER BY created_at DESC`, instanceID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, iid, t, fp, note, ca string
		var sz int64
		rows.Scan(&id, &iid, &t, &fp, &sz, &note, &ca)
		list = append(list, gin.H{"id": id, "instance_id": iid, "type": t, "file_path": fp, "size_bytes": sz, "note": note, "created_at": ca})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, list)
}

func createBackup(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Note string `json:"note"`
	}
	c.ShouldBindJSON(&req)

	var nodeToken, rconPass string
	var rconPort int
	err := db.DB.QueryRow(`
		SELECT n.token, i.rcon_port, i.rcon_password 
		FROM instances i 
		JOIN nodes n ON i.node_id = n.id 
		WHERE i.id = ?`, id).Scan(&nodeToken, &rconPort, &rconPass)
	if err != nil {
		c.JSON(404, gin.H{"error": "instance not found"})
		return
	}

	cmd := &ccpanel.BackendCommand{
		CommandId: uuid.New().String(),
		Command:   ccpanel.BackendCommand_BACKUP,
		Config: &ccpanel.InstanceConfig{
			InstanceId:   id,
			RconPort:     int32(rconPort),
			RconPassword: rconPass,
		},
		Payload: req.Note,
	}

	ack, err := importGrpc.GetServer().WaitForResult(nodeToken, cmd, 30*time.Second)
	if err != nil {
		c.JSON(500, gin.H{"error": "backup failed: " + err.Error()})
		return
	}

	if !ack.Success {
		c.JSON(500, gin.H{"error": ack.Error})
		return
	}

	// Agent result format: "path|size"
	parts := strings.Split(ack.Result, "|")
	path := "/tmp/backup.tar.gz"
	var size int64
	if len(parts) == 2 {
		path = parts[0]
		importStr := parts[1]
		importSz, _ := json.Number(importStr).Int64()
		size = importSz
	}

	bid := uuid.New().String()
	db.DB.Exec(`INSERT INTO backups(id,instance_id,type,file_path,size_bytes,note) VALUES(?,?,?,?,?,?)`,
		bid, id, "manual", path, size, req.Note)
	
	logOperation(id, "", "backup", req.Note, "success")
	c.JSON(201, gin.H{"id": bid, "type": "manual", "size": size, "path": path})
}

func restoreBackup(c *gin.Context) {
	instanceID := c.Param("id")
	backupID := c.Param("bid")
	logOperation(instanceID, "", "restore", "backup_id="+backupID, "success")
	c.JSON(200, gin.H{"message": "restore initiated"})
}

func deleteBackup(c *gin.Context) {
	backupID := c.Param("bid")
	db.DB.Exec(`DELETE FROM backups WHERE id=?`, backupID)
	c.Status(204)
}

// ---- Logs handler ----

func listLogs(c *gin.Context) {
	limit := 50
	query := `SELECT id,instance_id,node_id,action,detail,result,instance_name,node_name,created_at FROM operation_logs`
	args := []interface{}{}
	if iid := c.Query("instance_id"); iid != "" {
		query += " WHERE instance_id=?"
		args = append(args, iid)
	}
	query += " ORDER BY created_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var list []gin.H
	for rows.Next() {
		var id, iid, nid, action, detail, result, iname, nname, ca string
		rows.Scan(&id, &iid, &nid, &action, &detail, &result, &iname, &nname, &ca)
		list = append(list, gin.H{
			"id": id, "instance_id": iid, "node_id": nid, "action": action,
			"detail": detail, "result": result, "instance_name": iname,
			"node_name": nname, "created_at": ca,
		})
	}
	if list == nil {
		list = []gin.H{}
	}
	c.JSON(200, list)
}

// ---- Helpers ----

func allocatePorts(nodeID string) (int, int, int) {
	var maxGame int
	err := db.DB.QueryRow(`SELECT COALESCE(MAX(game_port),2446) FROM instances WHERE node_id=?`, nodeID).Scan(&maxGame)
	if err != nil {
		maxGame = 2446
	}
	gamePort := maxGame + 10
	statusPort := gamePort + 4000
	rconPort := gamePort + 5000
	return gamePort, statusPort, rconPort
}

func logOperation(instanceID, nodeID, action, detail, result string) {
	id := uuid.New().String()
	var iname, nname string
	if instanceID != "" {
		db.DB.QueryRow(`SELECT name FROM instances WHERE id=?`, instanceID).Scan(&iname)
	}
	if nodeID != "" {
		db.DB.QueryRow(`SELECT name FROM nodes WHERE id=?`, nodeID).Scan(&nname)
	}
	_, err := db.DB.Exec(`INSERT INTO operation_logs(id,instance_id,node_id,action,detail,result,instance_name,node_name) VALUES(?,?,?,?,?,?,?,?)`,
		id, instanceID, nodeID, action, detail, result, iname, nname)
	if err != nil {
		log.Println("[LOG] failed to write operation log:", err)
	}
}
