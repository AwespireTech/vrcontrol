package sockets

func CheckSnapShot(r *Room) (SnapShot, bool) {
	if r == nil {
		panic("room is nil")
	}

	if len(r.Players) == 0 {
		return SnapShot{}, false
	}

	for player := range r.Players {
		if player == nil {
			continue
		}

		if player.WaitSnapShot {
			continue
		}

		return SnapShot{}, false
	}

	// Reset Flag
	for player := range r.Players {
		if player == nil {
			continue
		}
		player.WaitSnapShot = false
	}
	return SnapShot{
		Type: 1,
	}, true
}
