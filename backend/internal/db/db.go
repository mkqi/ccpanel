package db

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init(path string) error {
	var err error
	DB, err = sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	DB.SetMaxOpenConns(1)
	if err := migrate(); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	log.Println("[DB] SQLite initialized:", path)
	return nil
}

func migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS nodes (
			id             TEXT PRIMARY KEY,
			name           TEXT NOT NULL,
			address        TEXT NOT NULL,
			token          TEXT NOT NULL,
			status         TEXT DEFAULT 'offline',
			cpu_usage      REAL DEFAULT 0,
			mem_usage      REAL DEFAULT 0,
			disk_free      INTEGER DEFAULT 0,
			disk_total     INTEGER DEFAULT 0,
			instance_count INTEGER DEFAULT 0,
			os_info        TEXT DEFAULT '',
			kernel_version TEXT DEFAULT '',
			docker_version TEXT DEFAULT '',
			hostname       TEXT DEFAULT '',
			uptime_secs    INTEGER DEFAULT 0,
			last_heartbeat DATETIME,
			created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS instances (
			id             TEXT PRIMARY KEY,
			node_id        TEXT NOT NULL REFERENCES nodes(id),
			name           TEXT NOT NULL,
			world_name     TEXT NOT NULL,
			password       TEXT NOT NULL,
			game_port      INTEGER NOT NULL,
			status_port    INTEGER NOT NULL,
			rcon_port      INTEGER NOT NULL DEFAULT 0,
			rcon_password  TEXT DEFAULT '',
			status         TEXT DEFAULT 'stopped',
			docker_id      TEXT DEFAULT '',
			image          TEXT NOT NULL,
			connect_address TEXT DEFAULT '',
			cpu_percent    REAL DEFAULT 0,
			mem_bytes      INTEGER DEFAULT 0,
			uptime_secs    INTEGER DEFAULT 0,
			player_count   INTEGER DEFAULT 0,
			max_players    INTEGER DEFAULT 0,
			game_version   TEXT DEFAULT '',
			world_time     TEXT DEFAULT '',
			docker_status  TEXT DEFAULT '',
			env_vars       TEXT DEFAULT '{}',
			created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS backups (
			id             TEXT PRIMARY KEY,
			instance_id    TEXT NOT NULL REFERENCES instances(id),
			type           TEXT NOT NULL,
			file_path      TEXT NOT NULL,
			size_bytes     INTEGER NOT NULL DEFAULT 0,
			note           TEXT DEFAULT '',
			created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS operation_logs (
			id             TEXT PRIMARY KEY,
			instance_id    TEXT DEFAULT '',
			node_id        TEXT DEFAULT '',
			action         TEXT NOT NULL,
			detail         TEXT DEFAULT '',
			result         TEXT NOT NULL,
			instance_name  TEXT DEFAULT '',
			node_name      TEXT DEFAULT '',
			created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}
	for _, s := range stmts {
		if _, err := DB.Exec(s); err != nil {
			return fmt.Errorf("exec %q: %w", s[:40], err)
		}
	}

	// For compatibility with existing databases
	DB.Exec(`ALTER TABLE nodes ADD COLUMN hostname TEXT DEFAULT ''`)
	DB.Exec(`ALTER TABLE instances ADD COLUMN max_players INTEGER DEFAULT 0`)
	DB.Exec(`ALTER TABLE instances ADD COLUMN game_version TEXT DEFAULT ''`)
	DB.Exec(`ALTER TABLE instances ADD COLUMN world_time TEXT DEFAULT ''`)
	DB.Exec(`ALTER TABLE instances ADD COLUMN docker_status TEXT DEFAULT ''`)

	return nil
}
