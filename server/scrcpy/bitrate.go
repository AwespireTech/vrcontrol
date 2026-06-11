package scrcpy

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

var ErrInvalidBitrate = errors.New("invalid bitrate")

// ParseBitrate converts a scrcpy bitrate string such as 800k or 2M into bits per second.
func ParseBitrate(value string) (int, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, fmt.Errorf("%w: empty value", ErrInvalidBitrate)
	}

	unit := 1
	switch {
	case strings.HasSuffix(trimmed, "k"), strings.HasSuffix(trimmed, "K"):
		unit = 1000
		trimmed = trimmed[:len(trimmed)-1]
	case strings.HasSuffix(trimmed, "m"), strings.HasSuffix(trimmed, "M"):
		unit = 1000 * 1000
		trimmed = trimmed[:len(trimmed)-1]
	}

	if trimmed == "" {
		return 0, fmt.Errorf("%w: missing numeric value", ErrInvalidBitrate)
	}

	parsed, err := strconv.Atoi(trimmed)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%w: %q", ErrInvalidBitrate, value)
	}

	return parsed * unit, nil
}

// ValidateBitrate checks whether a scrcpy bitrate string can be parsed.
func ValidateBitrate(value string) error {
	_, err := ParseBitrate(value)
	return err
}
