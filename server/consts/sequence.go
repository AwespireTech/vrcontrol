package consts

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
)

const questControlSequenceDir = "data/quest_control/sequence"

func LoadAssignedSequence(room string) map[string]int {
	path := filepath.Join(questControlSequenceDir, room+".json")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		log.Println("Error creating directory: ", err)
		return make(map[string]int)
	}

	if _, err := os.Stat(path); os.IsNotExist(err) {
		return make(map[string]int)
	}

	file, err := os.Open(path)
	if err != nil {
		log.Println("Error opening file: ", err)
		return make(map[string]int)
	}
	defer file.Close()

	var sequenceMap map[string]int
	if err := json.NewDecoder(file).Decode(&sequenceMap); err != nil {
		log.Println("Error decoding file: ", err)
		return make(map[string]int)
	}
	return sequenceMap
}

func SaveAssignedSequence(room string, sequenceMap map[string]int) {
	path := filepath.Join(questControlSequenceDir, room+".json")
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

	if err := json.NewEncoder(file).Encode(sequenceMap); err != nil {
		log.Println("Error encoding file: ", err)
		return
	}
	log.Println("[Quest] Sequence map saved to file: ", path)
}
