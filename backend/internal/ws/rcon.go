package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"ccpanel/backend/internal/auth"
	"ccpanel/backend/internal/db"
	importGrpc "ccpanel/backend/internal/grpc"
	"ccpanel/proto/gen/ccpanel"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleRconWs() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}
		if _, err := auth.ValidateToken(token); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Println("[WS] RCON upgrade error:", err)
			return
		}
		defer conn.Close()

		// Fetch instance info to get RCON port
		var nodeToken, rconPass string
		var rconPort int
		err = db.DB.QueryRow(`
			SELECT n.token, i.rcon_port, i.rcon_password 
			FROM instances i 
			JOIN nodes n ON i.node_id = n.id 
			WHERE i.id = ?`, id).Scan(&nodeToken, &rconPort, &rconPass)
		
		if err != nil {
			conn.WriteJSON(gin.H{"type": "error", "data": "instance not found"})
			return
		}

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}

			var req struct {
				Type string `json:"type"`
				Data string `json:"data"`
			}
			if err := json.Unmarshal(msg, &req); err != nil || req.Type != "command" {
				continue
			}

			cmd := &ccpanel.BackendCommand{
				CommandId: uuid.New().String(),
				Command:   ccpanel.BackendCommand_RCON,
				Config: &ccpanel.InstanceConfig{
					InstanceId:   id,
					RconPort:     int32(rconPort),
					RconPassword: rconPass,
				},
				Payload: req.Data,
			}

			// Send to Agent and Wait
			ack, err := importGrpc.GetServer().WaitForResult(nodeToken, cmd, 10*time.Second)
			if err != nil {
				conn.WriteJSON(gin.H{"type": "response", "data": gin.H{"error": err.Error()}})
				continue
			}

			if !ack.Success {
				conn.WriteJSON(gin.H{"type": "response", "data": gin.H{"error": ack.Error}})
			} else {
				// Valheim RCON output sometimes has trailing newlines
				output := strings.TrimSpace(ack.Result)
				conn.WriteJSON(gin.H{"type": "response", "data": gin.H{"output": output}})
			}
		}
	}
}
