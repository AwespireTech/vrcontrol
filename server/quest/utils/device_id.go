package utils

import (
	"regexp"
	"strings"
)

var deviceIDKeyPattern = regexp.MustCompile(`^[0-9A-Z]{8}$`)

// NormalizeDeviceIDKey normalizes device id to DEV- + upper-case when possible.
func NormalizeDeviceIDKey(input string) string {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return ""
	}
	upper := strings.ToUpper(trimmed)
	if after, ok := strings.CutPrefix(upper, "DEV-"); ok {
		suffix := after
		if deviceIDKeyPattern.MatchString(suffix) {
			return "DEV-" + suffix
		}
		return upper
	}
	if deviceIDKeyPattern.MatchString(upper) {
		return "DEV-" + upper
	}
	return upper
}
