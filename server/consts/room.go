package consts

import (
	"encoding/json"
	"log"
	"os"
)

func LoadAssignedRoom() map[string]string {
	path := "sequence/assigned_room.json"
	// Check if file exists
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
	err = json.NewDecoder(file).Decode(&roomMap)
	if err != nil {
		log.Println("Error decoding file: ", err)
		return make(map[string]string)
	}
	log.Println("Assigned room map loaded from file: ", path)
	return roomMap
}
func SaveAssignedRoom(roomMap map[string]string) {
	path := "sequence/assigned_room.json"
	//Overwrite the file if it exists, create it if it doesn't
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Println("Error creating file: ", err)
		return
	}
	defer file.Close()
	err = json.NewEncoder(file).Encode(roomMap)
	if err != nil {
		log.Println("Error encoding file: ", err)
		return
	}
	log.Println("Assigned room map saved to file: ", path)
}
