package consts

import (
	"encoding/json"
	"log"
	"os"
)

func LoadAssignedSequence(room string) map[string]int {
	//Check if room file exists
	//If not, set it to empty map
	//If yes, load the map from file

	path := "sequence/sequence/" + room + ".json"
	// Check if file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return make(map[string]int)
	}
	// Load the map from file
	file, err := os.Open(path)
	if err != nil {
		log.Println("Error opening file: ", err)
		return make(map[string]int)
	}
	defer file.Close()
	var sequenceMap map[string]int
	err = json.NewDecoder(file).Decode(&sequenceMap)
	if err != nil {
		log.Println("Error decoding file: ", err)
		return make(map[string]int)
	}
	return sequenceMap

}
func SaveAssignedSequence(room string, sequenceMap map[string]int) {
	// Save the map to file
	path := "sequence/sequence/" + room + ".json"
	//Overwrite the file if it exists, create it if it doesn't
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Println("Error creating file: ", err)
		return
	}
	defer file.Close()
	err = json.NewEncoder(file).Encode(sequenceMap)
	if err != nil {
		log.Println("Error encoding file: ", err)
		return
	}
	log.Println("Sequence map saved to file: ", path)
}
