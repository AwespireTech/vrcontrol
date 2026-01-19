package consts

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
)

const questControlDir = "data/quest_control"

func LoadAssignedRoom() map[string]string {
	path := filepath.Join(questControlDir, "assigned_room.json")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		log.Println("Error creating directory: ", err)
		return make(map[string]string)
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		return make(map[string]string)
	}

	file, err := os.Open(path)
	if err != nil {
		log.Println("Error opening file: ", err)
		return make(map[string]string)
	}
	defer file.Close()

	var roomMap map[string]string
	if err := json.NewDecoder(file).Decode(&roomMap); err != nil {
		log.Println("Error decoding file: ", err)
		return make(map[string]string)
	}
	log.Println("[Quest] Assigned room map loaded from file: ", path)
	return roomMap
}

func SaveAssignedRoom(roomMap map[string]string) {
	path := filepath.Join(questControlDir, "assigned_room.json")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		log.Println("Error creating directory: ", err)
		return
	}

	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		log.Println("Error creating file: ", err)
		return
	}
	defer file.Close()

	if err := json.NewEncoder(file).Encode(roomMap); err != nil {
		log.Println("Error encoding file: ", err)
		return
	}
	log.Println("[Quest] Assigned room map saved to file: ", path)
}
