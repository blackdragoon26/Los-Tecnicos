package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"database/sql"
	"los-tecnicos/backend/internal/cache"
	"los-tecnicos/backend/internal/config"
	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
	"los-tecnicos/backend/internal/matching"
	"los-tecnicos/backend/internal/pricing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/strkey"
)

// The message that the frontend is expected to sign.
const challengeMessage = "los-tecnicos-auth"

// In a real app, load this from a secure config
var jwtSecret = []byte(config.GetEnv("JWT_SECRET", "a-very-secret-key"))

// Claims defines the structure of the JWT claims.
type Claims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// SignUp handles user registration by verifying a wallet signature.
func SignUp(c *gin.Context) {
	var req SignUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	if !strkey.IsValidEd25519PublicKey(req.WalletAddress) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid wallet address format"})
		return
	}

	sig, err := base64.StdEncoding.DecodeString(req.Signature)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid signature format"})
		return
	}

	kp, err := keypair.ParseAddress(req.WalletAddress)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse wallet address"})
		return
	}

	// Verify signature using Stellar's specific hashing prefix
	// Freighter signs: SHA256("Stellar Signed Message:\n" + message)
	prefix := "Stellar Signed Message:\n"
	prefixedMsg := prefix + challengeMessage
	hashedMsg := sha256.Sum256([]byte(prefixedMsg))

	err = kp.Verify(hashedMsg[:], sig)
	if err != nil {
		log.Printf("Signature verification failed for %s: %v", req.WalletAddress, err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Signature verification failed"})
		return
	}

	// Check if user already exists in DB
	var existingUser domain.User
	if err := database.DB.Where("wallet_address = ?", req.WalletAddress).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusOK, existingUser)
		return
	}

	newUser := domain.User{
		ID:            req.WalletAddress,
		WalletAddress: req.WalletAddress,
		Role:          "Recipient", // Default role
		CreatedAt:     time.Now(),
		KYCStatus:     "pending",
	}

	if err := database.DB.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, newUser)
}

// Login handles user authentication and returns a JWT and a refresh token.
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// 1. Verify signature
	sig, err := base64.StdEncoding.DecodeString(req.Signature)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid signature format"})
		return
	}
	kp, err := keypair.ParseAddress(req.WalletAddress)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse wallet address"})
		return
	}

	// Verify signature using Stellar's specific hashing prefix
	prefix := "Stellar Signed Message:\n"
	prefixedMsg := prefix + challengeMessage
	hashedMsg := sha256.Sum256([]byte(prefixedMsg))

	if err := kp.Verify(hashedMsg[:], sig); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Signature verification failed"})
		return
	}

	// 2. Find user (with cache-aside pattern)
	var user domain.User
	userCacheKey := "user:" + req.WalletAddress
	cachedUser, err := cache.Rdb.Get(context.Background(), userCacheKey).Result()

	if err == nil {
		// Cache hit
		if err := json.Unmarshal([]byte(cachedUser), &user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deserialize cached user"})
			return
		}
	} else if err == redis.Nil {
		// Cache miss, fetch from DB
		if err := database.DB.Where("wallet_address = ?", req.WalletAddress).First(&user).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found. Please sign up first."})
			return
		}
	} else {
		// Log error but proceed to DB (Fail-safe for Redis downtime)
		log.Printf("Warning: Redis error on Get (continuing to DB): %v", err)
	}

	// 3. Generate Access Token (short-lived)
	accessToken, err := createAccessToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	// 4. Generate and store Refresh Token (long-lived)
	refreshToken := uuid.New().String()
	user.RefreshToken = refreshToken
	user.RefreshTokenExpiresAt = time.Now().Add(7 * 24 * time.Hour)

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store refresh token"})
		return
	}

	// 5. Update cache with the new user state
	userJSON, _ := json.Marshal(user)
	if err := cache.Rdb.Set(context.Background(), userCacheKey, userJSON, 1*time.Hour).Err(); err != nil {
		log.Printf("Failed to update user cache for %s: %v", user.ID, err)
	}

	// 6. Return both tokens
	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func createAccessToken(user *domain.User) (string, error) {
	expirationTime := time.Now().Add(15 * time.Minute) // 15-minute access token
	claims := &Claims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// RefreshToken generates a new access token from a valid refresh token.
func RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	var user domain.User
	if err := database.DB.Where("refresh_token = ?", req.RefreshToken).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	if time.Now().After(user.RefreshTokenExpiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token has expired"})
		return
	}

	accessToken, err := createAccessToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate access token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"access_token": accessToken})
}

// Me returns the profile of the currently authenticated user.
func Me(c *gin.Context) {
	userId, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var user domain.User
	// Try fetching from cache first (optional, but good for performance)
	// For now, let's hit the DB for simplicity and consistency
	if err := database.DB.Where("id = ?", userId).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User profile not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetMarketOrders retrieves all open energy orders.
func GetMarketOrders(c *gin.Context) {
	var orders []domain.EnergyOrder
	if err := database.DB.Where("status = ?", "Created").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve orders"})
		return
	}

	c.JSON(http.StatusOK, orders)
}

// CreateOrder creates a new energy buy or sell order for the authenticated user.
func CreateOrder(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	userRole, _ := c.Get("userRole")
	userIDStr := userID.(string)
	userRoleStr := userRole.(string)

	// A user must be a Donor to create a sell order.
	if req.Type == "sell" && userRoleStr != "Donor" && userRoleStr != "NetworkNodeOperator" {
		log.Printf("DEBUG: CreateOrder denied. Type=%s, Role=%s, ID=%s", req.Type, userRoleStr, userIDStr)
		// Let's be lenient and auto-update the role if they are just a Recipient
		if userRoleStr == "Recipient" {
			if err := database.DB.Model(&domain.User{}).Where("id = ?", userIDStr).Update("role", "Donor").Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role to Donor"})
				return
			}
            // Update context manually so subsequent logic works if needed? 
            // Actually, we should probably just proceed, but let's see if the update works.
		} else {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only Donors or Network Node Operators can create sell orders. Your role is: " + userRoleStr})
			return
		}
	}

	// If user is new, assign role based on first action
	if userRoleStr == "" {
		newRole := "Recipient"
		if req.Type == "sell" {
			newRole = "Donor"
		}
		if err := database.DB.Model(&domain.User{}).Where("id = ?", userIDStr).Update("role", newRole).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign user role"})
			return
		}
	}

	newOrder := domain.EnergyOrder{
		ID:         uuid.New().String(),
		UserID:     userIDStr,
		Type:       req.Type,
		KwhAmount:  req.KwhAmount,
		TokenPrice: req.TokenPrice,
		Status:     "Created",
		CreatedAt:  time.Now(),
	}

	if err := database.DB.Create(&newOrder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order"})
		return
	}

	c.JSON(http.StatusCreated, newOrder)
}

// CancelOrder cancels an energy order if the user is the owner.
func CancelOrder(c *gin.Context) {
	var req CancelOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	userID, _ := c.Get("userID")
	userIDStr := userID.(string)

	var order domain.EnergyOrder
	if err := database.DB.Where("id = ?", req.OrderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.UserID != userIDStr {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not authorized to cancel this order"})
		return
	}

	if order.Status != "Created" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only open orders can be cancelled"})
		return
	}

	if err := database.DB.Model(&order).Update("status", "Cancelled").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel order"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order cancelled successfully"})
}

// GetRegisteredDevices lists all IoT devices owned by the authenticated user.
func GetRegisteredDevices(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var devices []domain.IoTDevice
	if err := database.DB.Where("owner_id = ?", userID.(string)).Find(&devices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve devices"})
		return
	}

	c.JSON(http.StatusOK, devices)
}

// RegisterDevice registers a new IoT device for the authenticated user.
func RegisterDevice(c *gin.Context) {
	var req RegisterDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Get user ID from the context (set by AuthMiddleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	newDevice := domain.IoTDevice{
		ID:         uuid.New().String(),
		OwnerID:    userID.(string),
		DeviceType: req.DeviceType,
		Location:   req.Location,
		LastPing:   time.Now(), // Set initial ping time
		Status:     "registered",
	}

	if err := database.DB.Create(&newDevice).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register device"})
		return
	}

	c.JSON(http.StatusCreated, newDevice)
}

// GetActiveNodes lists all active network nodes.
func GetActiveNodes(c *gin.Context) {
	var nodes []domain.NetworkNode
	if err := database.DB.Find(&nodes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve network nodes"})
		return
	}

	c.JSON(http.StatusOK, nodes)
}

// RegisterNode registers a new network node for the authenticated user.
func RegisterNode(c *gin.Context) {
	var req RegisterNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userIDStr := userID.(string)

	newNode := domain.NetworkNode{
		ID:            uuid.New().String(),
		OperatorID:    userIDStr,
		Location:      req.Location,
		Uptime:        0,
		PacketsRouted: 0,
		Earnings:      0.0,
	}

	// Use a transaction to ensure both node creation and user role update succeed
	tx := database.DB.Begin()

	if err := tx.Create(&newNode).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register network node"})
		return
	}

	// Update user role to be a network node operator
	if err := tx.Model(&domain.User{}).Where("id = ?", userIDStr).Update("role", "NetworkNodeOperator").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusCreated, newNode)
}

// DashboardStats defines the structure for the analytics dashboard response.
type DashboardStats struct {
	TotalUsers        int64   `json:"total_users"`
	TotalIoTDevices   int64   `json:"total_iot_devices"`
	TotalNetworkNodes int64   `json:"total_network_nodes"`
	TotalEnergyTraded float64 `json:"total_energy_traded"` // in kWh
	ActiveOrders      int64   `json:"active_orders"`
}

// GetAnalyticsDashboard retrieves real-time market analytics.
func GetAnalyticsDashboard(c *gin.Context) {
	stats := DashboardStats{}
	var totalKwh sql.NullFloat64

	// Concurrently fetch stats from the database
	errChan := make(chan error, 5)

	go func() {
		errChan <- database.DB.Model(&domain.User{}).Count(&stats.TotalUsers).Error
	}()
	go func() {
		errChan <- database.DB.Model(&domain.IoTDevice{}).Count(&stats.TotalIoTDevices).Error
	}()
	go func() {
		errChan <- database.DB.Model(&domain.NetworkNode{}).Count(&stats.TotalNetworkNodes).Error
	}()
	go func() {
		errChan <- database.DB.Model(&domain.EnergyOrder{}).Where("status = ?", "Created").Count(&stats.ActiveOrders).Error
	}()
	go func() {
		// Sum of kwh_amount for completed transactions
		errChan <- database.DB.Model(&domain.Transaction{}).Where("status = ?", "Completed").Select("sum(kwh_amount)").Row().Scan(&totalKwh)
	}()

	// Wait for all goroutines to finish and check for errors
	for i := 0; i < 5; i++ {
		if err := <-errChan; err != nil && err != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve dashboard stats"})
			return
		}
	}

	stats.TotalEnergyTraded = totalKwh.Float64 // Will be 0.0 if no completed transactions

	c.JSON(http.StatusOK, stats)
}

// GetUserTransactions retrieves transaction history for the authenticated user.
func GetUserTransactions(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var transactions []domain.Transaction
	// Fetch transactions where the user is donor OR recipient
	if err := database.DB.Where("donor_id = ? OR recipient_id = ?", userID, userID).Order("timestamp desc").Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve transactions"})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all connections for development purposes
		return true
	},
}

// MarketDataWS handles WebSocket connections for real-time market data.
func MarketDataWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection to WebSocket: %v", err)
		return
	}
	defer conn.Close()

	log.Println("Client connected to market data WebSocket.")

	// Simple welcome message
	err = conn.WriteMessage(websocket.TextMessage, []byte("Connected to real-time market data feed."))
	if err != nil {
		log.Printf("Error sending welcome message: %v", err)
		return
	}

	// For now, we will just keep the connection open and listen for a close message.
	// In the future, this is where we would broadcast market data.
	for {
		// We can read messages from the client if needed, but for a broadcast-only WS, we might not.
		// This read is mainly to detect if the client has closed the connection.
		if _, _, err := conn.ReadMessage(); err != nil {
			log.Printf("Client disconnected: %v", err)
			break
		}
	}
}

// MarketPriceResponse defines the structure for the market price response.
type MarketPriceResponse struct {
	Price     float64            `json:"price"`
	Supply    int64              `json:"supply"`
	Demand    int64              `json:"demand"`
	Timestamp string             `json:"timestamp"`
	Breakdown map[string]float64 `json:"breakdown"`
}

// GetMarketPrice calculates the current estimated market price using the matching engine's logic.
func GetMarketPrice(c *gin.Context) {
	var sellOrdersCount int64
	var buyOrdersCount int64

	// Get Supply and Demand
	database.DB.Model(&domain.EnergyOrder{}).Where("type = ? AND status = ?", "sell", "Created").Count(&sellOrdersCount)
	database.DB.Model(&domain.EnergyOrder{}).Where("type = ? AND status = ?", "buy", "Created").Count(&buyOrdersCount)

	supplyVol := float64(sellOrdersCount)
	demandVol := float64(buyOrdersCount)
	socAvg := matching.GetCommunitySoC()

	// Determine Base Price
	// Ideally, fetch the lowest sell order price
	var lowestSellOrder domain.EnergyOrder
	var basePrice float64

	if err := database.DB.Where("type = ? AND status = ?", "sell", "Created").Order("token_price asc").First(&lowestSellOrder).Error; err == nil {
		basePrice = lowestSellOrder.TokenPrice
	} else {
		// Fallback if no sell orders exist
		basePrice = 0.50 // Default base price
	}

	// Calculate Dynamic Price
	// We create dummy orders for calculation
	dummyBuy := domain.EnergyOrder{}
	dummySell := domain.EnergyOrder{UserID: "user_a", TokenPrice: basePrice} // Use 'user_a' from simulation for quality variance

	pe := pricing.NewPricingEngine()
	pe.Config.BasePrice = basePrice

	dynamicPrice, breakdown, _ := pe.CalculateDynamicPrice(dummyBuy, dummySell, supplyVol, demandVol, socAvg, 1.0)

	// Debug log to see fluctuations
	log.Printf("Price Pre-calc: SoC=%.2f, Quality=%.2f, Final=%.2f", socAvg, breakdown["f_quality"], dynamicPrice)

	c.JSON(http.StatusOK, MarketPriceResponse{
		Price:     dynamicPrice,
		Supply:    sellOrdersCount,
		Demand:    buyOrdersCount,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Breakdown: breakdown,
	})
}

// MarketHistoryPoint represents a single data point for the market chart.
type MarketHistoryPoint struct {
	Price     float64 `json:"price"`
	Timestamp string  `json:"timestamp"`
}

// GetMarketHistory retrieves recent trade prices for the chart.
func GetMarketHistory(c *gin.Context) {
	var transactions []domain.Transaction
	// Fetch last 50 completed transactions
	if err := database.DB.Where("status = ?", "Completed").Order("timestamp desc").Limit(50).Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve market history"})
		return
	}

	history := []MarketHistoryPoint{}
	// Reverse to chronological order for the chart
	for i := len(transactions) - 1; i >= 0; i-- {
		txn := transactions[i]
		pricePerKwh := 0.0
		if txn.KwhAmount > 0 {
			pricePerKwh = txn.TokenAmount / txn.KwhAmount
		}
		history = append(history, MarketHistoryPoint{
			Price:     pricePerKwh,
			Timestamp: txn.Timestamp.Format("15:04"), // HH:MM format
		})
	}

	c.JSON(http.StatusOK, history)
}
