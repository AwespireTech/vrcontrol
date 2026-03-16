package main

import (
	"log"

	questroutes "vrcontrol/server/routes"
	"vrcontrol/server/utilities"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file")
		log.Printf("Error: %v", err)
	}
	router := createRouter()
	router.Run()

}

func createRouter() *gin.Engine {
	router := gin.Default()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(utilities.CORSall)

	// Quest 模組路由
	questroutes.SetupQuestRoutes(router, "./data")

	return router
}
