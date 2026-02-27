package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/docker/go-connections/nat"
	"net"
	"bytes"
	"encoding/binary"
)

type Config struct {
	InstanceID   string
	Name         string
	Image        string
	WorldName    string
	Password     string
	GamePort     int
	StatusPort   int
	RconPort     int
	RconPassword string
}

type InstanceStats struct {
	InstanceID   string
	Status       string
	CPUPercent   float64
	MemBytes     int64
	UptimeSecs   int64
	DockerStatus string // raw Docker status e.g. "Up 10 seconds"
	PlayerCount  int
	MaxPlayers   int
	GameVersion  string
	WorldTime    string
}

var cli *client.Client

func Init() error {
	var err error
	cli, err = client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	return err
}

func GetVersion(ctx context.Context) string {
	if cli == nil {
		return "unknown"
	}
	v, err := cli.ServerVersion(ctx)
	if err != nil {
		return "error"
	}
	return v.Version
}

func getContainerByName(ctx context.Context, name string) (string, error) {
	containers, err := cli.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filters.NewArgs(filters.Arg("name", "^/"+name+"$")),
	})
	if err != nil {
		return "", err
	}
	if len(containers) == 0 {
		return "", fmt.Errorf("container not found")
	}
	return containers[0].ID, nil
}

func CreateInstance(ctx context.Context, cfg Config) error {
	containerName := "ccpanel-" + cfg.InstanceID

	// Port mappings
	gamePort := strconv.Itoa(cfg.GamePort)
	statusPort := strconv.Itoa(cfg.StatusPort)
	rconPort := strconv.Itoa(cfg.RconPort)

	portMap := nat.PortMap{
		nat.Port("2456/udp"): []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: gamePort}},
		nat.Port("2457/udp"): []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: strconv.Itoa(cfg.GamePort + 1)}},
		nat.Port("80/tcp"):   []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: statusPort}},
	}
	exposed := nat.PortSet{
		nat.Port("2456/udp"): struct{}{},
		nat.Port("2457/udp"): struct{}{},
		nat.Port("80/tcp"):   struct{}{},
	}

	env := []string{
		"SERVER_NAME=" + cfg.Name,
		"WORLD_NAME=" + cfg.WorldName,
		"SERVER_PASS=" + cfg.Password,
		"STATUS_HTTP=true",
		"STATUS_HTTP_PORT=80",
	}

	if cfg.RconPort > 0 && cfg.RconPassword != "" {
		env = append(env, "ENABLE_RCON=true", "RCON_PORT=2458", "RCON_PASS="+cfg.RconPassword)
		portMap[nat.Port("2458/tcp")] = []nat.PortBinding{{HostIP: "0.0.0.0", HostPort: rconPort}}
		exposed[nat.Port("2458/tcp")] = struct{}{}
	}

	runCreate := func() error {
		_, err := cli.ContainerCreate(ctx, &container.Config{
			Image:        cfg.Image,
			Env:          env,
			ExposedPorts: exposed,
			Labels: map[string]string{
				"ccpanel.instance": cfg.InstanceID,
			},
		}, &container.HostConfig{
			PortBindings: portMap,
			RestartPolicy: container.RestartPolicy{
				Name: "unless-stopped",
			},
		}, nil, nil, containerName)
		return err
	}

	err := runCreate()
	if err != nil && strings.Contains(err.Error(), "No such image") {
		reader, pullErr := cli.ImagePull(ctx, cfg.Image, image.PullOptions{})
		if pullErr != nil {
			return pullErr
		}
		defer reader.Close()
		io.Copy(io.Discard, reader)
		err = runCreate()
	}

	return err
}

func StartInstance(ctx context.Context, id string) error {
	cid, err := getContainerByName(ctx, "ccpanel-"+id)
	if err != nil {
		return err
	}
	return cli.ContainerStart(ctx, cid, container.StartOptions{})
}

func StopInstance(ctx context.Context, id string) error {
	cid, err := getContainerByName(ctx, "ccpanel-"+id)
	if err != nil {
		return err
	}
	timeout := 30
	return cli.ContainerStop(ctx, cid, container.StopOptions{Timeout: &timeout})
}

func RestartInstance(ctx context.Context, id string) error {
	cid, err := getContainerByName(ctx, "ccpanel-"+id)
	if err != nil {
		return err
	}
	timeout := 30
	return cli.ContainerRestart(ctx, cid, container.StopOptions{Timeout: &timeout})
}

func KillInstance(ctx context.Context, id string) error {
	cid, err := getContainerByName(ctx, "ccpanel-"+id)
	if err != nil {
		return err
	}
	return cli.ContainerKill(ctx, cid, "SIGKILL")
}

func DeleteInstance(ctx context.Context, id string) error {
	cid, err := getContainerByName(ctx, "ccpanel-"+id)
	if err != nil {
		return nil
	}
	return cli.ContainerRemove(ctx, cid, container.RemoveOptions{Force: true})
}

func GetStats(ctx context.Context, id string) (*InstanceStats, error) {
	cid, err := getContainerByName(ctx, "ccpanel-"+id)
	if err != nil {
		return nil, err
	}

	inspect, err := cli.ContainerInspect(ctx, cid)
	if err != nil {
		return nil, err
	}

	stats := &InstanceStats{
		InstanceID: id,
		Status:     inspect.State.Status,
	}
	if inspect.State.Running {
		startedAt, err := time.Parse(time.RFC3339Nano, inspect.State.StartedAt)
		if err == nil {
			stats.UptimeSecs = int64(time.Since(startedAt).Seconds())
		}
	}

	if stats.Status == "running" {
		statsStream, err := cli.ContainerStats(ctx, cid, false)
		if err == nil {
			defer statsStream.Body.Close()
			var v struct {
				CPUStats struct {
					CPUUsage struct {
						TotalUsage int64 `json:"total_usage"`
					} `json:"cpu_usage"`
					SystemCPUUsage int64 `json:"system_cpu_usage"`
				} `json:"cpu_stats"`
				PreCPUStats struct {
					CPUUsage struct {
						TotalUsage int64 `json:"total_usage"`
					} `json:"cpu_usage"`
					SystemCPUUsage int64 `json:"system_cpu_usage"`
				} `json:"precpu_stats"`
				MemoryStats struct {
					Usage int64 `json:"usage"`
				} `json:"memory_stats"`
			}
			if err := json.NewDecoder(statsStream.Body).Decode(&v); err == nil {
				stats.MemBytes = v.MemoryStats.Usage
				cpuDelta := float64(v.CPUStats.CPUUsage.TotalUsage - v.PreCPUStats.CPUUsage.TotalUsage)
				sysDelta := float64(v.CPUStats.SystemCPUUsage - v.PreCPUStats.SystemCPUUsage)
				if sysDelta > 0.0 && cpuDelta > 0.0 {
					stats.CPUPercent = (cpuDelta / sysDelta) * 100.0
				}
			}
		}

		// A2S Query for Valheim info
		statusPort := 0
		for p, b := range inspect.NetworkSettings.Ports {
			if p.Port() == "2457" && p.Proto() == "udp" && len(b) > 0 {
				statusPort, _ = strconv.Atoi(b[0].HostPort)
				break
			}
		}
		if statusPort > 0 {
			a2sInfo, _ := queryA2S(fmt.Sprintf("127.0.0.1:%d", statusPort))
			if a2sInfo != nil {
				stats.PlayerCount = a2sInfo.Players
				stats.MaxPlayers = a2sInfo.MaxPlayers
				stats.GameVersion = a2sInfo.Version
			}
		}
	} else {
		stats.Status = "stopped"
	}

	return stats, nil
}

func GetInstancesSyncStats(ctx context.Context) ([]*InstanceStats, error) {
	containers, err := cli.ContainerList(ctx, container.ListOptions{
		All:     true,
		Filters: filters.NewArgs(filters.Arg("label", "ccpanel.instance")),
	})
	if err != nil {
		return nil, err
	}

	var results []*InstanceStats
	for _, c := range containers {
		instanceID, ok := c.Labels["ccpanel.instance"]
		if !ok || instanceID == "" {
			continue
		}

		st, _ := GetStats(ctx, instanceID)
		if st != nil {
			st.DockerStatus = c.Status // raw Docker status e.g. "Up 10 seconds"
			results = append(results, st)
		}
	}
	return results, nil
	return results, nil
}

type logWriter struct {
	f func(string)
}

// Wrapper for stdcopy passing to out func
func (lw logWriter) Write(p []byte) (n int, err error) {
	lw.f(string(p))
	return len(p), nil
}

func StreamLogs(ctx context.Context, id string, out func(string)) error {
	cid, err := getContainerByName(ctx, "ccpanel-"+id)
	if err != nil {
		return err
	}

	reader, err := cli.ContainerLogs(ctx, cid, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Tail:       "200",
	})
	if err != nil {
		return err
	}

	// Wait for context cancellation
	go func() {
		<-ctx.Done()
		reader.Close()
	}()

	// Use stdcopy to demultiplex the docker log stream into out pipe
	// We'll write both stdout and stderr to the same string channel wrapper
	w := logWriter{f: out}
	_, err = stdcopy.StdCopy(w, w, reader)
	return err
}

type a2sInfo struct {
	Name       string
	Map        string
	Players    int
	MaxPlayers int
	Version    string
}

func queryA2S(addr string) (*a2sInfo, error) {
	conn, err := net.DialTimeout("udp", addr, 1*time.Second)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	// A2S_INFO Request
	req := []byte{0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00}
	_, err = conn.Write(req)
	if err != nil {
		return nil, err
	}

	buf := make([]byte, 1400)
	conn.SetReadDeadline(time.Now().Add(1 * time.Second))
	n, err := conn.Read(buf)
	if err != nil {
		return nil, err
	}

	if n < 5 || bytes.Compare(buf[:4], []byte{0xFF, 0xFF, 0xFF, 0xFF}) != 0 {
		return nil, fmt.Errorf("invalid header")
	}

	if buf[4] != 0x49 {
		return nil, fmt.Errorf("invalid response type")
	}

	r := bytes.NewReader(buf[5:n])
	
	readString := func() string {
		var s []byte
		for {
			b, err := r.ReadByte()
			if err != nil || b == 0 {
				break
			}
			s = append(s, b)
		}
		return string(s)
	}

	_, _ = r.ReadByte() // Protocol
	info := &a2sInfo{}
	info.Name = readString()
	info.Map = readString()
	_ = readString() // Folder
	_ = readString() // Game
	
	var appID int16
	_ = binary.Read(r, binary.LittleEndian, &appID)
	
	b, _ := r.ReadByte()
	info.Players = int(b)
	b, _ = r.ReadByte()
	info.MaxPlayers = int(b)
	
	_, _ = r.ReadByte() // Bots
	_, _ = r.ReadByte() // Server Type
	_, _ = r.ReadByte() // OS
	_, _ = r.ReadByte() // Visibility
	_, _ = r.ReadByte() // VAC
	
	info.Version = readString()
	
	return info, nil
}
