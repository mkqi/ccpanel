package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"sync/atomic"

	"ccpanel/backend/internal/auth"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Message struct {
	Type string      `json:"type"`
	Seq  int64       `json:"seq,omitempty"`
	Data interface{} `json:"data"`
	Ts   int64       `json:"ts,omitempty"`
}

type Hub struct {
	mu       sync.RWMutex
	channels map[string]*Channel
}

type Channel struct {
	mu      sync.RWMutex
	clients map[*Client]bool
	buffer  []Message
	bufSize int
	seq     atomic.Int64
}

type Client struct {
	conn *websocket.Conn
	send chan []byte
}

var GlobalHub = &Hub{
	channels: make(map[string]*Channel),
}

func (h *Hub) GetChannel(name string) *Channel {
	h.mu.Lock()
	defer h.mu.Unlock()
	ch, ok := h.channels[name]
	if !ok {
		ch = &Channel{
			clients: make(map[*Client]bool),
			buffer:  make([]Message, 0, 256),
			bufSize: 256,
		}
		h.channels[name] = ch
	}
	return ch
}

func (ch *Channel) Broadcast(msg Message) {
	ch.mu.Lock()
	seq := ch.seq.Add(1)
	msg.Seq = seq
	if len(ch.buffer) >= ch.bufSize {
		ch.buffer = ch.buffer[1:]
	}
	ch.buffer = append(ch.buffer, msg)
	ch.mu.Unlock()

	data, _ := json.Marshal(msg)

	ch.mu.RLock()
	defer ch.mu.RUnlock()
	for client := range ch.clients {
		select {
		case client.send <- data:
		default:
			// slow client, skip
		}
	}
}

func (ch *Channel) BackfillSince(lastSeq int64) []Message {
	ch.mu.RLock()
	defer ch.mu.RUnlock()
	var result []Message
	for _, m := range ch.buffer {
		if m.Seq > lastSeq {
			result = append(result, m)
		}
	}
	return result
}

func (ch *Channel) addClient(c *Client) {
	ch.mu.Lock()
	defer ch.mu.Unlock()
	ch.clients[c] = true
}

func (ch *Channel) removeClient(c *Client) {
	ch.mu.Lock()
	defer ch.mu.Unlock()
	delete(ch.clients, c)
}

func HandleWs(channelName string) gin.HandlerFunc {
	return func(c *gin.Context) {
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
			log.Println("[WS] upgrade error:", err)
			return
		}

		client := &Client{
			conn: conn,
			send: make(chan []byte, 64),
		}

		ch := GlobalHub.GetChannel(channelName)

		// Backfill
		lastSeq := int64(0)
		if q := c.Query("last_seq"); q != "" {
			var n int64
			if _, err := json.Number(q).Int64(); err == nil {
				n, _ = json.Number(q).Int64()
				lastSeq = n
			}
		}
		if lastSeq > 0 {
			missed := ch.BackfillSince(lastSeq)
			for _, m := range missed {
				data, _ := json.Marshal(m)
				conn.WriteMessage(websocket.TextMessage, data)
			}
		}

		ch.addClient(client)

		// Writer goroutine
		go func() {
			defer func() {
				ch.removeClient(client)
				conn.Close()
			}()
			for data := range client.send {
				if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
					return
				}
			}
		}()

		// Reader goroutine (handles client messages + ping)
		go func() {
			defer func() {
				close(client.send)
			}()
			for {
				_, msg, err := conn.ReadMessage()
				if err != nil {
					return
				}
				// Forward to channel-specific handler if needed
				_ = msg
			}
		}()
	}
}

func HandleDynamicWs(prefix string) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		channelName := prefix + "/" + id
		HandleWs(channelName)(c)
	}
}
