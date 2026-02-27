package config

import (
	"os"
	"strconv"
)

type Config struct {
	HTTPPort   int
	GRPCPort   int
	DBPath     string
	JWTSecret  string
	AdminUser  string
	AdminPass  string
	StaticDir  string
}

func Load() *Config {
	return &Config{
		HTTPPort:  envInt("CCPANEL_HTTP_PORT", 8080),
		GRPCPort:  envInt("CCPANEL_GRPC_PORT", 9090),
		DBPath:    envStr("CCPANEL_DB_PATH", "./ccpanel.db"),
		JWTSecret: envStr("CCPANEL_JWT_SECRET", "change-me-in-production"),
		AdminUser: envStr("CCPANEL_ADMIN_USER", "admin"),
		AdminPass: envStr("CCPANEL_ADMIN_PASS", "admin"),
		StaticDir: envStr("CCPANEL_STATIC_DIR", "./ccpanel-web/dist"),
	}
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
