package sockets

var (
	ServerBlockChapter = []int{}
	NoSyncChapter      = []int{1, 2, 3, 4, 5, 6, 7, 8, 9}
)

func MovementCheck(r *Room, p *Player, from int) (Movement, bool) {
	if r == nil {
		panic("room is nil")
	}
	if len(r.Players) == 0 {
		return Movement{}, false
	}
	// Check if sync is not required
	for _, chapter := range ServerBlockChapter {
		if chapter == from {
			return Movement{}, false
		}
	}
	for _, chapter := range NoSyncChapter {
		if chapter == from {
			return Movement{
				Force:            false,
				DestinationStage: from + 1,
				Target:           p.DeiviceID,
				Broadcast:        false,
			}, true
		}
	}
	// Player synconization chapter, require all players to be ready
	for player := range r.Players {
		if player == nil {
			continue
		}
		if player.Stage > from || (player.ReadyToMove && player.Stage == from) {
			continue
		}
		// Player is not ready to move, wait for them
		return Movement{}, false
	}
	return Movement{
		Force:            false,
		DestinationStage: from + 1,
		Target:           "all",
		Broadcast:        true,
	}, true
}
