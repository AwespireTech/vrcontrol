package webrtc

import (
	"context"
	"io"

	"vrcontrol/server/h264stream"

	pion "github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
)

func StreamH264(ctx context.Context, reader io.Reader, track *pion.TrackLocalStaticSample, fps int) error {
	return h264stream.StreamAccessUnits(ctx, reader, fps, func(accessUnit h264stream.AccessUnit) error {
		return track.WriteSample(media.Sample{Data: accessUnit.Data, Duration: accessUnit.Duration})
	})
}
