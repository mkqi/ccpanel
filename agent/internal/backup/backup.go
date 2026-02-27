package backup

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

func Create(instanceID, dataDir, backupDir string) (string, int64, error) {
	// Source: dataDir/{instanceID}/config/worlds_local (typical for newer Valheim)
	// We'll backup the whole 'worlds_local' or 'worlds' folder
	src := filepath.Join(dataDir, instanceID, "config", "worlds_local")
	if _, err := os.Stat(src); os.IsNotExist(err) {
		src = filepath.Join(dataDir, instanceID, "config", "worlds")
	}

	if _, err := os.Stat(src); os.IsNotExist(err) {
		return "", 0, fmt.Errorf("worlds directory not found in %s", filepath.Join(dataDir, instanceID))
	}

	// Destination
	os.MkdirAll(backupDir, 0755)
	timestamp := time.Now().Format("20060102-150405")
	filename := fmt.Sprintf("%s-%s.tar.gz", instanceID, timestamp)
	dest := filepath.Join(backupDir, filename)

	err := tarGz(src, dest)
	if err != nil {
		return "", 0, err
	}

	fi, _ := os.Stat(dest)
	return dest, fi.Size(), nil
}

func tarGz(src string, dest string) error {
	fw, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer fw.Close()

	gw := gzip.NewWriter(fw)
	defer gw.Close()

	tw := tar.NewWriter(gw)
	defer tw.Close()

	return filepath.Walk(src, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		header, err := tar.FileInfoHeader(fi, fi.Name())
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		header.Name = relPath

		if err := tw.WriteHeader(header); err != nil {
			return err
		}

		if fi.IsDir() {
			return nil
		}

		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()

		_, err = io.Copy(tw, f)
		return err
	})
}
