package grpc

import (
	"fmt"
	"log"
	"net"
	"strings"
	"sync"
	"time"

	"ccpanel/proto/gen/ccpanel"
	"ccpanel/backend/internal/db"

	"google.golang.org/grpc"
)

type AgentStream ccpanel.AgentService_ConnectStreamServer

type Server struct {
	ccpanel.UnimplementedAgentServiceServer
	mu      sync.RWMutex
	clients map[string]AgentStream
	pending sync.Map // map[string]chan *ccpanel.CommandAck
}

var globalServer *Server
var LogCallback func(instanceID string, content string)

func GetServer() *Server {
	return globalServer
}

func Init(addr string) error {
	globalServer = &Server{
		clients: make(map[string]AgentStream),
	}

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}

	s := grpc.NewServer()
	ccpanel.RegisterAgentServiceServer(s, globalServer)

	log.Printf("[gRPC] Server listening at %v", lis.Addr())
	go func() {
		if err := s.Serve(lis); err != nil {
			log.Fatalf("[FATAL] failed to serve: %v", err)
		}
	}()
	return nil
}

func (s *Server) ConnectStream(stream ccpanel.AgentService_ConnectStreamServer) error {
	var nToken string
	for {
		msg, err := stream.Recv()
		if err != nil {
			if nToken != "" {
				s.disconnect(nToken)
			}
			return err
		}

		switch payload := msg.Payload.(type) {
		case *ccpanel.AgentMessage_NodeInfo:
			nToken = payload.NodeInfo.Token
			s.mu.Lock()
			s.clients[nToken] = stream
			s.mu.Unlock()

			// Update db based on node info
			db.DB.Exec(`UPDATE nodes SET status='online', name=?, address=?, os_info=?, kernel_version=?, docker_version=?, hostname=?, last_heartbeat=CURRENT_TIMESTAMP WHERE token=?`,
				payload.NodeInfo.Name, payload.NodeInfo.Address, payload.NodeInfo.OsInfo, payload.NodeInfo.KernelVersion, payload.NodeInfo.DockerVersion, payload.NodeInfo.Hostname, nToken)
			log.Printf("[gRPC] Node connected: %s (Hostname: %s)", payload.NodeInfo.Name, payload.NodeInfo.Hostname)

		case *ccpanel.AgentMessage_Heartbeat:
			if nToken == "" {
				nToken = payload.Heartbeat.Token
				s.mu.Lock()
				s.clients[nToken] = stream
				s.mu.Unlock()
			}
			db.DB.Exec(`UPDATE nodes SET status='online', cpu_usage=?, mem_usage=?, disk_free=?, disk_total=?, uptime_secs=?, last_heartbeat=CURRENT_TIMESTAMP WHERE token=?`,
				payload.Heartbeat.CpuUsage, payload.Heartbeat.MemUsage, payload.Heartbeat.DiskFree, payload.Heartbeat.DiskTotal, payload.Heartbeat.UptimeSecs, nToken)

		case *ccpanel.AgentMessage_Sync:
			if nToken == "" {
				nToken = payload.Sync.Token
			}
			var reportedIds []string
			for _, inst := range payload.Sync.Instances {
				reportedIds = append(reportedIds, "'"+inst.InstanceId+"'")
				log.Printf("[gRPC] Sync update for %s: status=%s, docker_status=%s", inst.InstanceId, inst.Status, inst.DockerStatus)
				db.DB.Exec(`UPDATE instances SET status=?, cpu_percent=?, mem_bytes=?, uptime_secs=?, docker_status=?, player_count=?, max_players=?, game_version=?, world_time=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND node_id=(SELECT id FROM nodes WHERE token=?)`,
					inst.Status, inst.CpuPercent, inst.MemBytes, inst.UptimeSecs, inst.DockerStatus, inst.PlayerCount, inst.MaxPlayers, inst.GameVersion, inst.WorldTime, inst.InstanceId, nToken)
			}
			
			// Set instances of this node that are NOT running (not reported by Docker) to 'stopped'.
			if len(reportedIds) > 0 {
				query := fmt.Sprintf(`UPDATE instances SET status='stopped', cpu_percent=0, mem_bytes=0, uptime_secs=0 WHERE node_id=(SELECT id FROM nodes WHERE token='%s') AND id NOT IN (%s)`, nToken, strings.Join(reportedIds, ","))
				db.DB.Exec(query)
			} else {
				db.DB.Exec(fmt.Sprintf(`UPDATE instances SET status='stopped', cpu_percent=0, mem_bytes=0, uptime_secs=0 WHERE node_id=(SELECT id FROM nodes WHERE token='%s')`, nToken))
			}

		case *ccpanel.AgentMessage_Ack:
			log.Printf("[gRPC] received cmd ack: %s, success: %v", payload.Ack.CommandId, payload.Ack.Success)
			if ch, ok := s.pending.Load(payload.Ack.CommandId); ok {
				ch.(chan *ccpanel.CommandAck) <- payload.Ack
			}

		case *ccpanel.AgentMessage_Log:
			if LogCallback != nil {
				LogCallback(payload.Log.InstanceId, payload.Log.Content)
			}
		}
	}
}

func (s *Server) WaitForResult(nodeToken string, cmd *ccpanel.BackendCommand, timeout time.Duration) (*ccpanel.CommandAck, error) {
	ch := make(chan *ccpanel.CommandAck, 1)
	s.pending.Store(cmd.CommandId, ch)
	defer s.pending.Delete(cmd.CommandId)

	if err := SendCommandToNode(nodeToken, cmd); err != nil {
		return nil, err
	}

	select {
	case ack := <-ch:
		return ack, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("command timeout")
	}
}

func (s *Server) disconnect(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.clients, token)
	db.DB.Exec(`UPDATE nodes SET status='offline' WHERE token=?`, token)
	log.Printf("[gRPC] Node disconnected: %s", token)
}

func SendCommandToNode(nodeToken string, cmd *ccpanel.BackendCommand) error {
	globalServer.mu.RLock()
	stream, ok := globalServer.clients[nodeToken]
	globalServer.mu.RUnlock()

	if !ok {
		return nil // node offline
	}
	return stream.Send(cmd)
}
