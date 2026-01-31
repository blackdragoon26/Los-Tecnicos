package main

import (
	"log"
	"time"

	"los-tecnicos/backend/internal/blockchain"
	"los-tecnicos/backend/internal/cache"
	"los-tecnicos/backend/internal/database"
	"los-tecnicos/backend/internal/handlers"
	"los-tecnicos/backend/internal/matching"
	"los-tecnicos/backend/internal/mqtt"

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
	SorobanClient = blockchain.NewSorobanClient("https://soroban-testnet.stellar.org:443")

	// Start the matching engine in the background
	go matching.RunMatchingEngine(SorobanClient)

	router := gin.Default()

	// Apply middlewares globally
	router.Use(handlers.CORSMiddleware())
	router.Use(gin.Logger()) // Using Gin's default logger as well
	router.Use(gin.Recovery())
	router.Use(handlers.AuditMiddleware())
	router.Use(handlers.RateLimiter(100, time.Minute)) // 100 requests per minute

	// A simple health check endpoint
	router.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	// Setup API routes
	handlers.SetupRoutes(router)

	// Run the server
	log.Println("Starting server on :8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
