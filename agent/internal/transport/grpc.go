package transport

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"sync"
	"time"

	"bufio"
	"os"
	"strings"

	"github.com/shirou/gopsutil/v3/host"

	"ccpanel/proto/gen/ccpanel"
	"ccpanel/agent/internal/config"
	"ccpanel/agent/internal/monitor"
	"ccpanel/agent/internal/docker"
	"ccpanel/agent/internal/rcon"
	"ccpanel/agent/internal/backup"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func Start(cfg *config.Config) {
	conn, err := grpc.NewClient(cfg.BackendAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatal("[gRPC] connect failed:", err)
	}
	defer conn.Close()

	client := ccpanel.NewAgentServiceClient(conn)

	// Keep trying to connect
	for {
		log.Println("[gRPC] Attempting to connect to", cfg.BackendAddr)
		stream, err := client.ConnectStream(context.Background())
		if err != nil {
			log.Println("[gRPC] failed to connect stream:", err)
			time.Sleep(5 * time.Second)
			continue
		}

		err = runStream(stream, cfg)
		log.Println("[gRPC] stream error/end:", err)
		time.Sleep(5 * time.Second)
	}
}

func getPrettyOSName() string {
	f, err := os.Open("/etc/os-release")
	if err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "PRETTY_NAME=") {
				return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), "\"")
			}
		}
	}
	if hInfo, err := host.InfoWithContext(context.Background()); err == nil {
		return hInfo.Platform + " " + hInfo.PlatformVersion
	}
	return "Unknown OS"
}

type SafeStream struct {
	mu sync.Mutex
	stream ccpanel.AgentService_ConnectStreamClient
}

func (s *SafeStream) SendMsg(m *ccpanel.AgentMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stream.Send(m)
}

var (
	rconClients = make(map[string]*rcon.Client)
	rconMu      sync.Mutex
	logStreams  = make(map[string]context.CancelFunc)
	logMu       sync.Mutex
)

func runStream(stream ccpanel.AgentService_ConnectStreamClient, cfg *config.Config) error {
	var osInfo, kernelVer string
	safeStream := &SafeStream{stream: stream}
	osInfo = getPrettyOSName()
	if hInfo, err := host.InfoWithContext(context.Background()); err == nil {
		kernelVer = hInfo.KernelVersion
	}
	dockerVer := docker.GetVersion(context.Background())
	hostnameStr, _ := os.Hostname()

	// First message: Register Node
	req := &ccpanel.AgentMessage{
		Payload: &ccpanel.AgentMessage_NodeInfo{
			NodeInfo: &ccpanel.NodeInfo{
				Token:   cfg.NodeToken,
				Name:    cfg.NodeName,
				Address: cfg.NodeAddress,
				Status:  "online",
				OsInfo:  osInfo,
				KernelVersion: kernelVer,
				DockerVersion: dockerVer,
				Hostname: hostnameStr,
			},
		},
	}
	if err := safeStream.SendMsg(req); err != nil {
		return err
	}

	// Ticker for metrics
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// Handle heartbeat and metrics
	go func() {
		for {
			select {
			case <-ticker.C:
				metrics, _ := monitor.CollectMetrics(context.Background(), cfg.DataPath)
				if metrics != nil {
					hb := &ccpanel.AgentMessage{
						Payload: &ccpanel.AgentMessage_Heartbeat{
							Heartbeat: &ccpanel.HeartbeatData{
								Token:      cfg.NodeToken,
								CpuUsage:   metrics.CPUUsage,
								MemUsage:   metrics.MemUsage,
								DiskFree:   metrics.DiskFree,
								DiskTotal:  metrics.DiskTotal,
								UptimeSecs: metrics.UptimeSecs,
							},
						},
					}
					_ = safeStream.SendMsg(hb)
				}

				// Fetch instance stats and send sync to backend
				instStats, err := docker.GetInstancesSyncStats(context.Background())
				if err != nil {
					log.Printf("[gRPC] docker.GetInstancesSyncStats error: %v", err)
				}
				if instStats != nil {
					var pbStats []*ccpanel.InstanceStats
					for _, st := range instStats {
						pbStats = append(pbStats, &ccpanel.InstanceStats{
							InstanceId:   st.InstanceID,
							Status:       st.Status,
							CpuPercent:   st.CPUPercent,
							MemBytes:     st.MemBytes,
							UptimeSecs:   st.UptimeSecs,
							DockerStatus: st.DockerStatus,
							PlayerCount:  int32(st.PlayerCount),
							MaxPlayers:   int32(st.MaxPlayers),
							GameVersion:  st.GameVersion,
							WorldTime:    st.WorldTime,
						})
					}
					syncMsg := &ccpanel.AgentMessage{
						Payload: &ccpanel.AgentMessage_Sync{
							Sync: &ccpanel.InstanceSyncData{
								Token:     cfg.NodeToken,
								Instances: pbStats,
							},
						},
					}
					_ = safeStream.SendMsg(syncMsg)
				}
			}
		}
	}()

	// Read commands from Backend
	for {
		cmd, err := stream.Recv()
		if err != nil {
			return err
		}

		go handleCommand(safeStream, cmd, cfg)
	}
}

func handleCommand(stream *SafeStream, cmd *ccpanel.BackendCommand, cfg *config.Config) {
	ack := &ccpanel.AgentMessage{
		Payload: &ccpanel.AgentMessage_Ack{
			Ack: &ccpanel.CommandAck{
				CommandId: cmd.CommandId,
				Success:   true,
			},
		},
	}

	if cmd.Config != nil {
		id := cmd.Config.InstanceId
		var err error
		var result string

		log.Printf("[CMD] Executing %v for instance %s", cmd.Command, id)

		switch cmd.Command {
		case ccpanel.BackendCommand_CREATE:
			dcfg := docker.Config{
				InstanceID:   id,
				Name:         cmd.Config.Name,
				Image:        cmd.Config.Image,
				WorldName:    cmd.Config.WorldName,
				Password:     cmd.Config.Password,
				GamePort:     int(cmd.Config.GamePort),
				StatusPort:   int(cmd.Config.StatusPort),
				RconPort:     int(cmd.Config.RconPort),
				RconPassword: cmd.Config.RconPassword,
			}
			err = docker.CreateInstance(context.Background(), dcfg)
			if err == nil {
				err = docker.StartInstance(context.Background(), id)
			}
		case ccpanel.BackendCommand_START:
			err = docker.StartInstance(context.Background(), id)
		case ccpanel.BackendCommand_STOP:
			err = docker.StopInstance(context.Background(), id)
		case ccpanel.BackendCommand_RESTART:
			err = docker.RestartInstance(context.Background(), id)
		case ccpanel.BackendCommand_KILL:
			err = docker.KillInstance(context.Background(), id)
		case ccpanel.BackendCommand_DELETE:
			err = docker.DeleteInstance(context.Background(), id)
		case ccpanel.BackendCommand_RCON:
			rconMu.Lock()
			rc, ok := rconClients[id]
			if !ok {
				addr := fmt.Sprintf("%s:%d", cfg.NodeAddress, cmd.Config.RconPort)
				rc = rcon.NewClient(addr, cmd.Config.RconPassword)
				rconClients[id] = rc
			}
			rconMu.Unlock()
			result, err = rc.Execute(cmd.Payload)
		case ccpanel.BackendCommand_BACKUP:
			// Simple backup: save first via RCON
			rconMu.Lock()
			rc, ok := rconClients[id]
			if !ok {
				addr := fmt.Sprintf("%s:%d", cfg.NodeAddress, cmd.Config.RconPort)
				rc = rcon.NewClient(addr, cmd.Config.RconPassword)
				rconClients[id] = rc
			}
			rconMu.Unlock()
			_, _ = rc.Execute("save") // Try to save, ignore error if rcon not ready
			
			var path string
			var size int64
			path, size, err = backup.Create(id, cfg.DataPath, filepath.Join(cfg.DataPath, "backups"))
			if err == nil {
				result = fmt.Sprintf("%s|%d", path, size)
			}
		case ccpanel.BackendCommand_RESTORE:
			// TODO: Stop, replace, start
			err = fmt.Errorf("restore not implemented in agent yet")
		case ccpanel.BackendCommand_STREAM_LOGS_START:
			logMu.Lock()
			if cancel, exists := logStreams[id]; exists {
				cancel()
			}
			ctx, cancel := context.WithCancel(context.Background())
			logStreams[id] = cancel
			logMu.Unlock()

			go func(instanceID string) {
				_ = docker.StreamLogs(ctx, instanceID, func(line string) {
					msg := &ccpanel.AgentMessage{
						Payload: &ccpanel.AgentMessage_Log{
							Log: &ccpanel.LogChunk{
								InstanceId: instanceID,
								Content:    line,
							},
						},
					}
					_ = stream.SendMsg(msg)
				})
			}(id)
		case ccpanel.BackendCommand_STREAM_LOGS_STOP:
			logMu.Lock()
			if cancel, exists := logStreams[id]; exists {
				cancel()
				delete(logStreams, id)
			}
			logMu.Unlock()
		}

		if err != nil {
			ack.GetAck().Success = false
			ack.GetAck().Error = err.Error()
		} else {
			ack.GetAck().Result = result
		}
	}

	_ = stream.SendMsg(ack)
}
