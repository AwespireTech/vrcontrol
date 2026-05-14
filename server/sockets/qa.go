package sockets

func ComposeQAResult(r *Room, p *Player, qID string, aID string) {
	if r == nil {
		panic("room is nil")
	}

	// 1. 檢查該題是否已經鎖定 (時間到)
	if r.QuestionLocked[qID] {
		// 時間已到，忽略此更新 (或者可以回傳一個 error 訊息給該玩家)
		return
	}

	// 2. 初始化 map (如果還沒有的話)
	if r.Answers[qID] == nil {
		r.Answers[qID] = make(map[string]string)
	}

	// 3. 儲存/覆蓋答案
	r.Answers[qID][p.DeiviceID] = aID

	// 4. 標記資料有變動，需要廣播，並更新當前題目
	r.isDirty = true
	r.currentQID = qID
}
