//go:build windows

package scrcpy

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

func setCmdAttributes(cmd *exec.Cmd) {
	// Keep the existing behavior (separate process group) but rely on a Job Object
	// for true process-tree termination.
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
}

func afterStart(meta *sessionMeta, cmd *exec.Cmd) error {
	if meta == nil || cmd == nil || cmd.Process == nil {
		return fmt.Errorf("invalid process metadata")
	}

	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return fmt.Errorf("create job object: %w", err)
	}

	// Ensure all processes in the job are terminated when the job handle is closed.
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE

	_, err = windows.SetInformationJobObject(
		job,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)
	if err != nil {
		_ = windows.CloseHandle(job)
		return fmt.Errorf("set job information: %w", err)
	}

	procHandle, err := windows.OpenProcess(
		windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE|windows.PROCESS_QUERY_INFORMATION,
		false,
		uint32(cmd.Process.Pid),
	)
	if err != nil {
		_ = windows.CloseHandle(job)
		return fmt.Errorf("open process: %w", err)
	}
	defer windows.CloseHandle(procHandle)

	if err := windows.AssignProcessToJobObject(job, procHandle); err != nil {
		_ = windows.CloseHandle(job)
		return fmt.Errorf("assign process to job: %w", err)
	}

	meta.job = uintptr(job)
	return nil
}

func processExists(pid int) bool {
	if pid <= 0 {
		return false
	}
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return false
	}
	_ = windows.CloseHandle(h)
	return true
}

func stop(meta *sessionMeta) error {
	if meta == nil || meta.pid <= 0 {
		return fmt.Errorf("invalid scrcpy session")
	}

	if meta.job != 0 {
		job := windows.Handle(meta.job)
		_ = windows.TerminateJobObject(job, 1)
		_ = windows.CloseHandle(job)
		meta.job = 0
		return nil
	}

	// Fallback (should be rare): kill only the main process.
	proc, err := os.FindProcess(meta.pid)
	if err != nil {
		return err
	}
	return proc.Kill()
}

func cleanupAfterExit(meta *sessionMeta) {
	// Ensure we don't leak the job handle.
	if meta == nil || meta.job == 0 {
		return
	}
	job := windows.Handle(meta.job)
	_ = windows.CloseHandle(job)
	meta.job = 0
}
