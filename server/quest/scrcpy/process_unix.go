//go:build !windows

package scrcpy

import (
	"fmt"
	"os/exec"
	"syscall"
	"time"
)

func setCmdAttributes(cmd *exec.Cmd) {
	// Start scrcpy in its own process group/session so we can terminate the whole tree.
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
		Setsid:  true,
	}
}

func afterStart(meta *sessionMeta, cmd *exec.Cmd) error {
	if meta == nil || cmd == nil || cmd.Process == nil {
		return fmt.Errorf("invalid process metadata")
	}

	// With Setpgid=true + Pgid=0, the child's pgid is typically its pid.
	pgid, err := syscall.Getpgid(cmd.Process.Pid)
	if err != nil {
		meta.pgid = cmd.Process.Pid
		return nil
	}

	meta.pgid = pgid
	return nil
}

func processExists(pid int) bool {
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	if err == nil {
		return true
	}
	return err == syscall.EPERM
}

func processGroupExists(pgid int) bool {
	if pgid <= 0 {
		return false
	}
	err := syscall.Kill(-pgid, 0)
	if err == nil {
		return true
	}
	return err == syscall.EPERM
}

func stop(meta *sessionMeta) error {
	if meta == nil || meta.pid <= 0 {
		return fmt.Errorf("invalid scrcpy session")
	}

	pgid := meta.pgid
	if pgid <= 0 {
		if g, err := syscall.Getpgid(meta.pid); err == nil {
			pgid = g
		} else {
			pgid = meta.pid
		}
	}

	// Best-effort graceful stop.
	_ = syscall.Kill(-pgid, syscall.SIGTERM)

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if !processGroupExists(pgid) {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}

	// Force kill the whole group.
	_ = syscall.Kill(-pgid, syscall.SIGKILL)
	return nil
}

func cleanupAfterExit(meta *sessionMeta) {
	// No-op on Unix.
}
