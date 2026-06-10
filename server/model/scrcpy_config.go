package model

// ScrcpyConfig represents the configuration for WebRTC scrcpy streaming.
type ScrcpyConfig struct {
	Bitrate           string `json:"bitrate"`             // Video bitrate (e.g., "800k", "1M", "2M")
	MaxSize           int    `json:"max_size"`            // Maximum screen width in pixels
	MaxFPS            int    `json:"max_fps"`             // Maximum frame rate
	VideoCodecOptions string `json:"video_codec_options"` // Extra codec options for standalone/WebRTC stream startup
}

// DefaultScrcpyConfig returns the default scrcpy configuration
func DefaultScrcpyConfig() *ScrcpyConfig {
	return &ScrcpyConfig{
		Bitrate:           "8M",
		MaxSize:           1024,
		MaxFPS:            60,
		VideoCodecOptions: "",
	}
}
