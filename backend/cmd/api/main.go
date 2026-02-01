package main

import (
	"log"
	"os"
	"time"

	"los-tecnicos/backend/internal/blockchain"
	"los-tecnicos/backend/internal/cache"
	"los-tecnicos/backend/internal/database"
	"los-tecnicos/backend/internal/handlers"
	"los-tecnicos/backend/internal/matching"
	"los-tecnicos/backend/internal/mqtt"
	"los-tecnicos/backend/internal/simulation"

	"github.com/gin-gonic/gin"
)

var SorobanClient *blockchain.SorobanClient

func main() {
	// Initialize database connection
	if _, err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize Redis connection
	if err := cache.Connect(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	// Initialize MQTT client
	if err := mqtt.Connect(); err != nil {
		log.Printf("Warning: Failed to connect to MQTT broker: %v", err)
	}

	// Initialize Soroban client
	// In a real app, this URL would come from config
	SorobanClient = blockchain.NewSorobanClient("https://rpc.lightsail.network/")

	// Start the matching engine in the background
	go matching.RunMatchingEngine(SorobanClient)

	// Seed mock data and start simulation
	simulation.SeedMockData()
	simulation.StartSimulation()

	router := gin.Default()

	// Apply middlewares globally
	router.Use(handlers.CORSMiddleware())
	router.Use(gin.Logger()) // Using Gin's default logger as well
	router.Use(gin.Recovery())
	router.Use(handlers.AuditMiddleware())
	router.Use(handlers.RateLimiter(1000, time.Minute)) // Increased limit for dev

	// A simple health check endpoint
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	// Setup API routes
	handlers.SetupRoutes(router)

	// Run the server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting server on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
