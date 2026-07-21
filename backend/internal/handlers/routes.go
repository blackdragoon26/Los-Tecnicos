package handlers

import (
	"github.com/gin-gonic/gin"
)

// SetupRoutes configures the API routes for the application.
func SetupRoutes(router *gin.Engine) {
	// WebSocket endpoint
	router.GET("/ws/market", MarketDataWS)

	// IoT SSE endpoint (Public)
	router.GET("/iot/events", HandleIoTEventStream)
	router.POST("/iot/ping", HandleIoTPing)
	router.POST("/iot/cmd", HandleIoTCmd)

	// IoT Debug/Transfer endpoints (Public — for testing)
	router.GET("/iot/nodes/:device_id", HandleGetNodes)
	router.POST("/iot/transfer", HandleTransfer)
	router.POST("/iot/transfer/stop", HandleTransferStop)

	// Energy Metering → Token Minting (Public — called by Pi)
	router.POST("/iot/energy/report", HandleEnergyReport)

	// Group routes under /api/v1
	v1 := router.Group("/api/v1")
	{
		// Auth routes are public
		auth := v1.Group("/auth")
		{
			auth.POST("/signup", SignUp)
			auth.POST("/login", Login)
			auth.POST("/refresh", RefreshToken)
			// Protected auth route to get current user
			auth.GET("/me", AuthMiddleware(), Me)
		}

		// Public, transparently-labelled Delhi NCR digital twin.
		demo := v1.Group("/demo")
		{
			demo.POST("/sessions", CreateDemoSession)
			demo.POST("/sessions/join", JoinDemoSession)
			demo.PATCH("/sessions/:id/speed", UpdateDemoSpeed)
		}
		simulation := v1.Group("/simulation")
		{
			simulation.GET("/snapshot", GetSimulationSnapshot)
			simulation.GET("/timeseries", GetSimulationTimeSeries)
		}
		v1.GET("/market/rates", GetMarketRates)

		// Public analytics routes
		publicAnalytics := v1.Group("/analytics")
		{
			publicAnalytics.GET("/dashboard", GetAnalyticsDashboard)
		}

		// ─── Public Ledger / Transparency ───
		ledger := v1.Group("/ledger")
		{
			ledger.GET("/overview", GetLedgerOverview)
			ledger.GET("/transactions", GetLedgerTransactions)
			ledger.GET("/mints", GetLedgerMints)
			ledger.GET("/burns", GetLedgerBurns)
			ledger.GET("/carbon", GetCarbonLedger)
			ledger.GET("/price-history", GetPriceHistory)
		}

		// ─── Public Token Supply ───
		v1.GET("/tokens/supply", GetTokenSupply)

		// ─── Public DePIN Stats ───
		depin := v1.Group("/depin")
		{
			depin.POST("/register", HandleDePINRegister)
			depin.POST("/heartbeat", HandleDePINHeartbeat)
			depin.GET("/nodes", GetDePINNodes)
			depin.GET("/stats", GetDePINStats)
		}

		// ─── Public DeFi ───
		defi := v1.Group("/defi")
		{
			defi.POST("/pool/stake", HandleLPStake)
			defi.POST("/pool/unstake", HandleLPUnstake)
			defi.GET("/pool/stats", GetPoolStats)
			defi.POST("/flash-loan", HandleFlashLoan)
			defi.POST("/flash-loan/repay", HandleFlashLoanRepay)
			defi.GET("/yield/history", GetYieldHistory)
		}

		// ─── Public Fiat On-Ramp (Dodo Payments) ───
		fiat := v1.Group("/fiat")
		{
			fiat.POST("/checkout", CreateFiatCheckout)
			fiat.POST("/webhook", HandleFiatWebhook)
		}

		// Protected routes
		protected := v1.Group("/")
		protected.Use(AuthMiddleware())
		{
			// Market routes
			market := protected.Group("/market")
			{
				market.GET("/orders", GetMarketOrders)
				market.POST("/order/create", CreateOrder)
				market.POST("/order/cancel", CancelOrder)
				market.GET("/price", GetMarketPrice)
				market.GET("/history", GetMarketHistory)
			}

			// IoT routes
			iot := protected.Group("/iot")
			{
				iot.GET("/devices", GetRegisteredDevices)
				iot.POST("/device/register", RegisterDevice)
				iot.POST("/device/link", HandleLinkIoTDevice) // Cryptographic node linking
			}

			// Network routes
			network := protected.Group("/network")
			{
				network.GET("/nodes", GetActiveNodes)
				network.POST("/node/register", RegisterNode)
			}

			// Analytics routes (Protected)
			analytics := protected.Group("/analytics")
			{
				analytics.GET("/transactions", GetUserTransactions)
			}

			wallet := protected.Group("/wallet")
			{
				wallet.GET("", GetAppWallet)
				wallet.POST("/demo-topup", TopUpDemoWallet)
			}

			kits := protected.Group("/kits")
			{
				kits.GET("", GetHardwareKits)
				kits.POST("/register", RegisterHardwareKit)
			}

			trades := protected.Group("/trades")
			{
				trades.POST("/lock", LockDemoTrade)
				trades.GET("/active", GetActiveDemoTrade)
				trades.GET("/:id", GetDemoTrade)
				trades.POST("/:id/start", StartDemoTrade)
				trades.POST("/:id/settle", SettleDemoTrade)
				trades.POST("/:id/cancel", CancelDemoTrade)
				trades.POST("/:id/fault", FaultDemoTrade)
				trades.POST("/:id/timeout", TimeoutDemoTrade)
			}
		}
	}
}
