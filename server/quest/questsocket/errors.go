package questsocket

import "errors"

var (
	ErrNoPortAvailable     = errors.New("no available port in range")
	ErrServerNotFound      = errors.New("server not found")
	ErrServerAlreadyExists = errors.New("server already exists")
	ErrInvalidMessage      = errors.New("invalid message format")
)
