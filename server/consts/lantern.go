package consts

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	"vrcontrol/server/model"
)

var lanternDataDir = filepath.Join("data", "lantern")

func SetLanternDataDir(dir string) {
	if dir == "" {
		return
	}
	lanternDataDir = dir
}

func LoadAssignedLanternData(roomID string, roomHash string) map[string][]*model.LanternEventMessage {
	if roomID == "" || roomHash == "" {
		return make(map[string][]*model.LanternEventMessage)
	}

	path := filepath.Join(lanternDataDir, roomID+"_"+roomHash+".json")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return make(map[string][]*model.LanternEventMessage)
	}

	file, err := os.Open(path)
	if err != nil {
		log.Println("Error opening lantern data file:", err)
		return make(map[string][]*model.LanternEventMessage)
	}
	defer file.Close()

	var lanternData map[string][]*model.LanternEventMessage
	if err := json.NewDecoder(file).Decode(&lanternData); err != nil {
		log.Println("Error decoding lantern data file:", err)
		return make(map[string][]*model.LanternEventMessage)
	}
	if lanternData == nil {
		return make(map[string][]*model.LanternEventMessage)
	}

	return lanternData
}

func SaveAssignedLanternData(roomID string, roomHash string, lanternData map[string][]*model.LanternEventMessage) {
	if roomID == "" || roomHash == "" {
		log.Println("Incorrect room or room hash")
		return
	}

	if err := os.MkdirAll(lanternDataDir, 0755); err != nil {
		log.Println("Error creating lantern data directory:", err)
		return
	}

	path := filepath.Join(lanternDataDir, roomID+"_"+roomHash+".json")
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		log.Println("Error creating lantern data file:", err)
		return
	}
	defer file.Close()

	if err := json.NewEncoder(file).Encode(lanternData); err != nil {
		log.Println("Error encoding lantern data file:", err)
		return
	}

	log.Println("Lantern data saved to file:", path)
}
