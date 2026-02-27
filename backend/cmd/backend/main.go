package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"ccpanel/backend/internal/api"
	"ccpanel/backend/internal/auth"
	"ccpanel/backend/internal/config"
	"ccpanel/backend/internal/cron"
	"ccpanel/backend/internal/db"
	importGrpc "ccpanel/backend/internal/grpc"
	"ccpanel/backend/internal/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	// Init auth
	auth.Init(cfg.JWTSecret)

	// Init database
	if err := db.Init(cfg.DBPath); err != nil {
		log.Fatal("[FATAL] Database init failed:", err)
	}

	// Init Cron
	cron.Init()

	// Setup gRPC Server
	if err := importGrpc.Init(":9090"); err != nil {
		log.Printf("[gRPC] Warning: failed to start gRPC on :9090: %v", err)
	}
	importGrpc.LogCallback = ws.BroadcastLogChunk

	// Setup HTTP router
	router := api.SetupRouter(cfg)

	// WebSocket endpoints
	router.GET("/ws/v1/monitor", ws.HandleWs("monitor"))
	router.GET("/ws/v1/logs/:id", ws.HandleDynamicWs("logs"))
	router.GET("/ws/v1/rcon/:id", ws.HandleRconWs())

	// Start monitor broadcast loop
	ws.StartMonitorPusher()

	// Serve SPA static files
	if _, err := os.Stat(cfg.StaticDir); err == nil {
		log.Println("[HTTP] Serving static files from:", cfg.StaticDir)
		router.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path
			// API and WS routes should 404
			if strings.HasPrefix(path, "/api/") || strings.HasPrefix(path, "/ws/") {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			// Try to serve the file
			fullPath := filepath.Join(cfg.StaticDir, path)
			if info, err := os.Stat(fullPath); err == nil && !info.IsDir() {
				c.File(fullPath)
				return
			}
			// SPA fallback: serve index.html for all other routes
			c.File(filepath.Join(cfg.StaticDir, "index.html"))
		})
	}

	addr := fmt.Sprintf(":%d", cfg.HTTPPort)
	log.Printf("[HTTP] CCPanel Backend starting on %s", addr)
	log.Printf("[HTTP] Admin: %s / %s", cfg.AdminUser, cfg.AdminPass)

	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatal("[FATAL] HTTP server failed:", err)
	}
}
