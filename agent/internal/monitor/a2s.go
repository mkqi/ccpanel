package monitor

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"net"
	"time"
)

type A2SInfo struct {
	Name       string
	Map        string
	Players    int
	MaxPlayers int
	Version    string
}

func QueryA2SAny(addr string) (*A2SInfo, error) {
	conn, err := net.DialTimeout("udp", addr, 2*time.Second)
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
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	n, err := conn.Read(buf)
	if err != nil {
		return nil, err
	}

	if n < 5 || bytes.Compare(buf[:4], []byte{0xFF, 0xFF, 0xFF, 0xFF}) != 0 {
		return nil, fmt.Errorf("invalid header")
	}

	if buf[4] != 0x49 {
		return nil, fmt.Errorf("invalid response type: %X", buf[4])
	}

	r := bytes.NewReader(buf[5:n])
	
	readString := func() (string, error) {
		var s []byte
		for {
			b, err := r.ReadByte()
			if err != nil {
				return "", err
			}
			if b == 0 {
				break
			}
			s = append(s, b)
		}
		return string(s), nil
	}

	_, _ = r.ReadByte() // Protocol
	info := &A2SInfo{}
	info.Name, _ = readString()
	info.Map, _ = readString()
	_, _ = readString() // Folder
	_, _ = readString() // Game
	
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
	
	info.Version, _ = readString()
	
	return info, nil
}
