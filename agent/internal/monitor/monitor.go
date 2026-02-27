package monitor

import (
	"context"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type NodeMetrics struct {
	CPUUsage  float64
	MemUsage  float64
	DiskFree  int64
	DiskTotal int64
	UptimeSecs int64
}

func CollectMetrics(ctx context.Context, dataPath string) (*NodeMetrics, error) {
	metrics := &NodeMetrics{}

	// CPU
	pcts, err := cpu.PercentWithContext(ctx, time.Second, false)
	if err == nil && len(pcts) > 0 {
		metrics.CPUUsage = pcts[0]
	}

	// Mem
	vm, err := mem.VirtualMemoryWithContext(ctx)
	if err == nil {
		metrics.MemUsage = vm.UsedPercent
	}

	// Disk
	du, err := disk.UsageWithContext(ctx, dataPath)
	if err == nil {
		metrics.DiskTotal = int64(du.Total)
		metrics.DiskFree = int64(du.Free)
	} else {
		// fallback to root if dataPath doesn't exist
		if du, err := disk.UsageWithContext(ctx, "/"); err == nil {
			metrics.DiskTotal = int64(du.Total)
			metrics.DiskFree = int64(du.Free)
		}
	}

	// Uptime
	hInfo, err := host.InfoWithContext(ctx)
	if err == nil {
		metrics.UptimeSecs = int64(hInfo.Uptime)
	}

	return metrics, nil
}
