package ws

import (
	"time"
)

func BroadcastLogChunk(instanceID string, content string) {
	ch := GlobalHub.GetChannel("logs/" + instanceID)

	msg := Message{
		Type: "log_chunk",
		Data: map[string]interface{}{
			"instance_id": instanceID,
			"content":     content,
		},
		Ts: time.Now().UnixMilli(),
	}
	ch.Broadcast(msg)
}
