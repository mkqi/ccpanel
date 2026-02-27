package main
import (
    "fmt"
    "github.com/docker/docker/client"
)
func main() {
    c, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
    fmt.Println(c, err)
}
