package cron

import (
	"log"
	"time"
	"fmt"
	"strings"
	"strconv"
	"github.com/robfig/cron/v3"
	"ccpanel/backend/internal/db"
	"ccpanel/backend/internal/grpc"
	"ccpanel/proto/gen/ccpanel"
	"github.com/google/uuid"
)

func Init() {
	c := cron.New()

	// Every 6 hours: Automated Backup
	c.AddFunc("0 */6 * * *", RunAutoBackups)

	// Daily at 3 AM: Backup Retention Cleanup
	c.AddFunc("0 3 * * *", RunBackupCleanup)

	c.Start()
	log.Println("[Cron] Scheduler started")
}

func RunAutoBackups() {
	log.Println("[Cron] Starting automated backups...")
	
	rows, err := db.DB.Query(`
		SELECT i.id, i.name, i.world_name, i.image, i.game_port, i.status_port, i.rcon_port, i.rcon_password, n.token 
		FROM instances i
		JOIN nodes n ON i.node_id = n.id
		WHERE i.status = 'running'
	`)
	if err != nil {
		log.Println("[Cron] query running instances error:", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, name, world, image, rconPass, nToken string
		var gameP, statusP, rconP int
		rows.Scan(&id, &name, &world, &image, &gameP, &statusP, &rconP, &rconPass, &nToken)

		log.Printf("[Cron] Triggering auto-backup for instance %s", id)
		
		cmd := &ccpanel.BackendCommand{
			CommandId: "cron-" + uuid.New().String(),
			Command:   ccpanel.BackendCommand_BACKUP,
			Config: &ccpanel.InstanceConfig{
				InstanceId: id,
				Name:       name,
				WorldName:  world,
				Image:      image,
				GamePort:   int32(gameP),
				StatusPort: int32(statusP),
				RconPort:   int32(rconP),
				RconPassword: rconPass,
			},
			Payload: "auto", // tell the agent it's an automated backup
		}

		go func(token string, command *ccpanel.BackendCommand, instID string) {
			ack, err := grpc.GetServer().WaitForResult(token, command, 5*time.Minute)
			if err != nil {
				log.Printf("[Cron] auto-backup failed for %s: %v", instID, err)
				return
			}
			if !ack.Success {
				log.Printf("[Cron] auto-backup agent error for %s: %s", instID, ack.Error)
				return
			}

			// Agent result format: "path|size"
			parts := strings.Split(ack.Result, "|")
			path := ""
			var size int64
			if len(parts) == 2 {
				path = parts[0]
				size, _ = strconv.ParseInt(parts[1], 10, 64)
			}
			
			bid := uuid.New().String()
			db.DB.Exec(`INSERT INTO backups(id,instance_id,type,file_path,size_bytes,note) VALUES(?,?,?,?,?,?)`,
				bid, instID, "auto", path, size, "Automated daily backup")
			log.Printf("[Cron] auto-backup completed for %s: %s (%d bytes)", instID, bid, size)
		}(nToken, cmd, id)
	}
}

func RunBackupCleanup() {
	log.Println("[Cron] Starting backup retention cleanup...")
	
	rows, err := db.DB.Query(`SELECT id FROM instances`)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var instID string
		rows.Scan(&instID)

		var count int
		db.DB.QueryRow(`SELECT COUNT(*) FROM backups WHERE instance_id=?`, instID).Scan(&count)

		if count > 20 {
			toDelete := count - 20
			log.Printf("[Cron] deleting %d old backups for %s", toDelete, instID)

			dRows, err := db.DB.Query(`SELECT id FROM backups WHERE instance_id=? ORDER BY created_at ASC LIMIT ?`, instID, toDelete)
			if err == nil {
				var ids []string
				for dRows.Next() {
					var bid string
					dRows.Scan(&bid)
					ids = append(ids, "'"+bid+"'")
				}
				dRows.Close()
				
				if len(ids) > 0 {
					db.DB.Exec(fmt.Sprintf(`DELETE FROM backups WHERE id IN (%s)`, strings.Join(ids, ",")))
				}
			}
		}
	}
}
