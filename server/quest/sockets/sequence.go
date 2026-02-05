package sockets

import (
	"sort"

	"vrcontrol/server/quest/utils"
)

type SequenceUpdate struct {
	Player   *Player
	Sequence int
}

func (r *Room) PlayerSequenceUpdate() []SequenceUpdate {
	names := make([]string, 0, len(r.Players))
	maps := make(map[string]*Player, len(r.Players))
	used_sequences := make(map[int]bool, len(r.Players))
	sequenceUpdates := make([]SequenceUpdate, 0, len(r.Players))

	for player := range r.Players {
		if player == nil {
			continue
		}
		normalizedID := utils.NormalizeDeviceIDKey(player.DeiviceID)
		if seq, ok := r.AssignedSequence[normalizedID]; ok {
			used_sequences[seq] = true
			sequenceUpdates = append(sequenceUpdates, SequenceUpdate{
				Player:   player,
				Sequence: seq,
			})
			player.Sequence = seq
			// Player already has a sequence assigned, skip
			continue
		}
		if normalizedID == "" {
			continue
		}
		names = append(names, normalizedID)
		maps[normalizedID] = player
	}

	// Sort by lexicographic order
	if len(names) == 0 {
		return sequenceUpdates
	}
	sort.Strings(names)
	i := 0
	for _, name := range names {

		player := maps[name]
		if player == nil {
			continue
		}
		// Skip used sequences until we find a free one
		for used_sequences[i] {
			i++
		}
		// Player sequence use 0-based index
		sequenceUpdates = append(sequenceUpdates, SequenceUpdate{
			Player:   player,
			Sequence: i,
		})
		player.Sequence = i
		i++
	}
	return sequenceUpdates

}
