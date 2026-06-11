package scrcpy

import "testing"

func TestParseBitrate(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    int
		wantErr bool
	}{
		{name: "kilobits", input: "800k", want: 800000},
		{name: "megabits", input: "2M", want: 2000000},
		{name: "invalid", input: "abc", wantErr: true},
		{name: "empty", input: "", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseBitrate(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ParseBitrate(%q) expected error", tt.input)
				}
				return
			}

			if err != nil {
				t.Fatalf("ParseBitrate(%q) unexpected error: %v", tt.input, err)
			}
			if got != tt.want {
				t.Fatalf("ParseBitrate(%q) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}
