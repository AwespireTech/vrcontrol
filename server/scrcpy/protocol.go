package scrcpy

const controlMessageTypeResetVideo byte = 17

func buildResetVideoMessage() []byte {
	return []byte{controlMessageTypeResetVideo}
}
