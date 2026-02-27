package config

import (
	"os"
)

type Config struct {
	BackendAddr string
	NodeName    string
	NodeAddress string
	NodeToken   string
	DataPath    string
}

func Load() *Config {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "UnknownNode"
	}

	return &Config{
		BackendAddr: envStr("CCPANEL_BACKEND_ADDR", "localhost:9090"),
		NodeName:    envStr("CCPANEL_NODE_NAME", hostname),
		NodeAddress: envStr("CCPANEL_NODE_ADDR", "127.0.0.1"),
		NodeToken:   envStr("CCPANEL_NODE_TOKEN", "agent-token-123"),
		DataPath:    envStr("CCPANEL_DATA_PATH", "/opt/ccpanel/data"),
	}
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
