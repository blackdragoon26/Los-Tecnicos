package handlers

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"los-tecnicos/backend/internal/cache"
)
// AuthMiddleware validates the JWT and sets user info in the context.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is missing"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format is 'Bearer <token>'"})
			return
		}

		tokenString := parts[1]
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Set user info in the context for subsequent handlers
		c.Set("userID", claims.UserID)
		c.Set("userRole", claims.Role)

		c.Next()
	}
}

// RateLimiter middleware uses a fixed window counter to limit requests.
func RateLimiter(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "rate_limit:" + c.ClientIP()

		// Use a pipeline to make it an atomic operation
		pipe := cache.Rdb.TxPipeline()
		incr := pipe.Incr(context.Background(), key)
		pipe.Expire(context.Background(), key, window)
		_, err := pipe.Exec(context.Background())
		if err != nil {
			log.Printf("Failed to execute rate limit pipeline: %v", err)
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
			return
		}

		if incr.Val() > int64(limit) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
			return
		}

		c.Next()
	}
}

// AuditMiddleware logs details of each request for auditing purposes.
func AuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		
		c.Next() // Process request

		latency := time.Since(start)
		userID, _ := c.Get("userID")

		log.Printf(
			`{"method": "%s", "path": "%s", "ip": "%s", "user_id": "%v", "status": %d, "latency": "%s"}`,
			c.Request.Method,
			c.Request.URL.Path,
			c.ClientIP(),
			userID,
			c.Writer.Status(),
			latency,
		)
	}
}
