package rcon

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"time"
)

const (
	PacketAuth        = 3
	PacketExecCommand = 2
	PacketResponse    = 0
	PacketAuthResp    = 2
)

type Client struct {
	addr     string
	password string
	conn     net.Conn
	mu       sync.Mutex
}

func NewClient(addr, password string) *Client {
	return &Client{
		addr:     addr,
		password: password,
	}
}

func (c *Client) Execute(command string) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := c.ensureConnection(); err != nil {
		return "", err
	}

	// Send command
	if err := c.writePacket(PacketExecCommand, command); err != nil {
		c.conn.Close()
		c.conn = nil
		return "", err
	}

	// Read response
	resp, err := c.readPacket()
	if err != nil {
		c.conn.Close()
		c.conn = nil
		return "", err
	}

	return strings.TrimRight(resp, "\x00"), nil
}

func (c *Client) ensureConnection() error {
	if c.conn != nil {
		return nil
	}

	conn, err := net.DialTimeout("tcp", c.addr, 5*time.Second)
	if err != nil {
		return err
	}
	c.conn = conn

	// Authenicate
	if err := c.writePacket(PacketAuth, c.password); err != nil {
		c.conn.Close()
		c.conn = nil
		return err
	}

	// Read auth response
	respType, _, err := c.readRawPacket()
	if err != nil {
		c.conn.Close()
		c.conn = nil
		return err
	}

	if respType != PacketAuthResp {
		c.conn.Close()
		c.conn = nil
		return fmt.Errorf("authentication failed")
	}

	return nil
}

func (c *Client) writePacket(typ int32, body string) error {
	size := int32(len(body) + 10)
	buf := new(bytes.Buffer)

	binary.Write(buf, binary.LittleEndian, size)
	binary.Write(buf, binary.LittleEndian, int32(1)) // ID
	binary.Write(buf, binary.LittleEndian, typ)
	buf.WriteString(body)
	buf.Write([]byte{0x00, 0x00})

	_, err := c.conn.Write(buf.Bytes())
	return err
}

func (c *Client) readPacket() (string, error) {
	_, body, err := c.readRawPacket()
	return body, err
}

func (c *Client) readRawPacket() (int32, string, error) {
	var size int32
	if err := binary.Read(c.conn, binary.LittleEndian, &size); err != nil {
		return 0, "", err
	}

	data := make([]byte, size)
	if _, err := io.ReadFull(c.conn, data); err != nil {
		return 0, "", err
	}

	id := binary.LittleEndian.Uint32(data[0:4])
	typ := binary.LittleEndian.Uint32(data[4:8])
	body := string(data[8 : size-2])

	_ = id
	return int32(typ), body, nil
}

func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
}
