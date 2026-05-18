package sockets

func CheckSnapShot(r *Room) (bool) {
	if r == nil {
		panic("room is nil")
	}

	if len(r.Players) == 0 {
		return false
	}

	for player := range r.Players {
		if player == nil {
			continue
		}

		if player.WaitSnapShot{
			continue
		}

		return false
	}

	// Reset Flag
	for player := range r.Players {
		if player == nil {
			continue
		}
		player.WaitSnapShot = false
	}
	return true
}