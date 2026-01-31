package cache

import (
	"context"
	"fmt"
	"los-tecnicos/backend/internal/config"

	"github.com/redis/go-redis/v9"
)

var Rdb *redis.Client

// Connect initializes the Redis client.
func Connect() error {
	addr := config.GetEnv("REDIS_ADDR", "localhost:6379")

	Rdb = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	// Ping the server to check the connection
	ctx := context.Background()
	if _, err := Rdb.Ping(ctx).Result(); err != nil {
		fmt.Printf("Warning: Failed to connect to redis at %s: %v. Continuing without cache.\n", addr, err)
		return nil
	}

	fmt.Println("Redis connection successful.")
	return nil
}
