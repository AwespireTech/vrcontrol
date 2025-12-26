package utilities

import "time"

const epochdiff = 621355968000000000 // Difference between Unix epoch and .NET epoch in ticks

func DateTimeToTicks(dt time.Time) int64 {
	// Convert Unix timestamp (seconds since 1970-01-01) to .NET ticks
	return (dt.UnixNano() / 100) + epochdiff
}
func TicksToDateTime(ticks int64) time.Time {
	// Convert .NET ticks to Unix timestamp (seconds since 1970-01-01)
	unixNano := (ticks - epochdiff) * 100
	return time.Unix(0, unixNano)
}
