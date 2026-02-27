package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"ccpanel/agent/internal/config"
	"ccpanel/agent/internal/docker"
	"ccpanel/agent/internal/transport"
)

func main() {
	log.Println("[INFO] CCPanel Agent starting...")
	cfg := config.Load()

	// Initialize Docker client
	if err := docker.Init(); err != nil {
		log.Fatalf("[FATAL] Failed to initialize Docker client: %v", err)
	}

	// Start Transport (gRPC connection to Backend)
	go transport.Start(cfg)

	// Wait for termination signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigChan

	log.Printf("[INFO] Received signal %v, shutting down Agent...", sig)
}
