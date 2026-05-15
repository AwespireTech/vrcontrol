package sockets

import "vrcontrol/server/utils"

func ComposeQAResult(r *Room, p *Player, qID string, aID string) bool {
	if r == nil {
		panic("room is nil")
	}
	if p == nil || qID == "" || aID == "" {
		return false
	}

	// 1. 檢查該題是否已經鎖定 (時間到)
	if r.QuestionLocked[qID] {
		// 時間已到，忽略此更新 (或者可以回傳一個 error 訊息給該玩家)
		return false
	}

	// 2. 初始化 map (如果還沒有的話)
	if r.Answers[qID] == nil {
		r.Answers[qID] = make(map[string]string)
	}

	// 3. 儲存/覆蓋答案
	deviceID := utils.NormalizeDeviceIDKey(p.DeiviceID)
	if deviceID == "" {
		deviceID = utils.NormalizeDeviceIDKey(p.StableID)
	}
	if deviceID == "" {
		return false
	}
	r.Answers[qID][deviceID] = aID

	// 4. 標記資料有變動，需要廣播，並更新當前題目
	r.isDirty = true
	r.currentQID = qID
	return true
}
