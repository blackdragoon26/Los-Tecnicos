package handlers

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"

	"github.com/gin-gonic/gin"
)

// ══════════════════════════════════════════════════════════════
// DeFi Module: Liquidity Pool, Flash Lending, Yield Vaults
// ══════════════════════════════════════════════════════════════

const (
	BaseAPY           = 8.5   // 8.5% base APY for LP stakers
	FlashLoanFee      = 0.003 // 0.3% fee per flash loan
	FlashLoanMaxKwh   = 50.0  // Max borrowable in a single flash loan
	FlashLoanEpoch    = 300   // 5 minutes to repay (in seconds)
	YieldCompoundFreq = 3600  // Auto-compound every hour (seconds)
	LiquidationRatio  = 1.5   // 150% collateral required
)

// ──────────────────────────────────────────────────────────────
// POST /api/v1/defi/pool/stake — Stake tokens in liquidity pool
// ──────────────────────────────────────────────────────────────

type StakeRequest struct {
	UserID string  `json:"user_id" binding:"required"`
	Amount float64 `json:"amount" binding:"required"`
}

func HandleLPStake(c *gin.Context) {
	var req StakeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be positive"})
		return
	}

	// Calculate pool share
	var totalStaked float64
	database.DB.Model(&domain.LiquidityPool{}).
		Where("status = 'active'").
		Select("COALESCE(SUM(amount_staked), 0)").Row().Scan(&totalStaked)

	sharePercent := 0.0
	if totalStaked+req.Amount > 0 {
		sharePercent = (req.Amount / (totalStaked + req.Amount)) * 100
	}

	// Dynamic APY: higher pool → lower APY (incentivize early staking)
	dynamicAPY := BaseAPY
	if totalStaked > 10000 {
		dynamicAPY = BaseAPY * (10000 / totalStaked) // Decreases as pool grows
		if dynamicAPY < 3.0 {
			dynamicAPY = 3.0 // Floor at 3%
		}
	}

	now := time.Now()
	pool := domain.LiquidityPool{
		UserID:        req.UserID,
		AmountStaked:  req.Amount,
		SharePercent:  sharePercent,
		APY:           dynamicAPY,
		YieldEarned:   0,
		Status:        "active",
		StakedAt:      now,
		LastYieldCalc: now,
	}
	database.DB.Create(&pool)

	log.Printf("[DEFI-LP] 🏦 User %s staked %.2f LT (share=%.2f%%, APY=%.1f%%)",
		req.UserID, req.Amount, sharePercent, dynamicAPY)

	// Broadcast SSE
	IoTBroker.Broadcast <- IoTEvent{
		Timestamp: now.UTC().Format(time.RFC3339),
		Type:      "defi_stake",
		Payload: map[string]interface{}{
			"user_id":       req.UserID,
			"amount_staked": req.Amount,
			"share_percent": sharePercent,
			"apy":           dynamicAPY,
			"pool_total":    totalStaked + req.Amount,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "staked",
		"pool_id":       pool.ID,
		"amount_staked": req.Amount,
		"share_percent": math.Round(sharePercent*100) / 100,
		"apy":           dynamicAPY,
		"pool_total":    totalStaked + req.Amount,
		"message": fmt.Sprintf("🏦 Staked %.2f LT in liquidity pool (%.2f%% share, %.1f%% APY)",
			req.Amount, sharePercent, dynamicAPY),
	})
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/defi/pool/unstake — Withdraw from liquidity pool
// ──────────────────────────────────────────────────────────────

type UnstakeRequest struct {
	PoolID uint `json:"pool_id" binding:"required"`
}

func HandleLPUnstake(c *gin.Context) {
	var req UnstakeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var pool domain.LiquidityPool
	if err := database.DB.First(&pool, req.PoolID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pool position not found"})
		return
	}

	if pool.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "position is not active"})
		return
	}

	// Calculate final yield
	duration := time.Since(pool.StakedAt)
	hoursStaked := duration.Hours()
	yieldEarned := pool.AmountStaked * (pool.APY / 100) * (hoursStaked / 8760) // 8760 hours/year
	pool.YieldEarned += yieldEarned
	pool.Status = "withdrawn"
	database.DB.Save(&pool)

	totalPayout := pool.AmountStaked + pool.YieldEarned

	// Record yield
	yieldRecord := domain.YieldRecord{
		UserID:    pool.UserID,
		Amount:    pool.YieldEarned,
		Source:    "LiquidityPool_Unstake",
		Timestamp: time.Now(),
	}
	database.DB.Create(&yieldRecord)

	log.Printf("[DEFI-LP] 💰 User %s unstaked %.2f LT + %.4f yield (%.1f hours)",
		pool.UserID, pool.AmountStaked, pool.YieldEarned, hoursStaked)

	c.JSON(http.StatusOK, gin.H{
		"status":       "withdrawn",
		"principal":    pool.AmountStaked,
		"yield_earned": math.Round(pool.YieldEarned*10000) / 10000,
		"total_payout": math.Round(totalPayout*10000) / 10000,
		"hours_staked": math.Round(hoursStaked*10) / 10,
		"apy_applied":  pool.APY,
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/defi/pool/stats — Liquidity pool statistics
// ──────────────────────────────────────────────────────────────

func GetPoolStats(c *gin.Context) {
	var totalStaked float64
	var totalYield float64
	var activeStakers int64

	database.DB.Model(&domain.LiquidityPool{}).Where("status = 'active'").
		Select("COALESCE(SUM(amount_staked), 0)").Row().Scan(&totalStaked)
	database.DB.Model(&domain.YieldRecord{}).Where("source LIKE 'LiquidityPool%'").
		Select("COALESCE(SUM(amount), 0)").Row().Scan(&totalYield)
	database.DB.Model(&domain.LiquidityPool{}).Where("status = 'active'").Count(&activeStakers)

	// Dynamic APY
	dynamicAPY := BaseAPY
	if totalStaked > 10000 {
		dynamicAPY = BaseAPY * (10000 / totalStaked)
		if dynamicAPY < 3.0 {
			dynamicAPY = 3.0
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total_value_locked": totalStaked,
		"total_yield_paid":   totalYield,
		"active_stakers":     activeStakers,
		"current_apy":        dynamicAPY,
		"flash_loan_fee":     fmt.Sprintf("%.1f%%", FlashLoanFee*100),
		"pool_utilization":   calculatePoolUtilization(totalStaked),
	})
}

func calculatePoolUtilization(totalStaked float64) float64 {
	var activeLoans float64
	database.DB.Model(&domain.FlashLoan{}).Where("status = 'active'").
		Select("COALESCE(SUM(kwh_borrowed * token_collateral), 0)").Row().Scan(&activeLoans)
	if totalStaked <= 0 {
		return 0
	}
	return math.Round((activeLoans/totalStaked)*10000) / 100
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/defi/flash-loan — Flash energy lending
// ──────────────────────────────────────────────────────────────

type FlashLoanRequest struct {
	BorrowerID string  `json:"borrower_id" binding:"required"`
	KwhAmount  float64 `json:"kwh_amount" binding:"required"`
}

func HandleFlashLoan(c *gin.Context) {
	var req FlashLoanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.KwhAmount <= 0 || req.KwhAmount > FlashLoanMaxKwh {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("kWh must be between 0 and %.0f", FlashLoanMaxKwh),
		})
		return
	}

	// Check pool has enough liquidity
	var totalStaked float64
	database.DB.Model(&domain.LiquidityPool{}).Where("status = 'active'").
		Select("COALESCE(SUM(amount_staked), 0)").Row().Scan(&totalStaked)

	requiredTokens := req.KwhAmount * TokensPerKwh
	if requiredTokens > totalStaked*0.8 { // Can only borrow up to 80% of pool
		c.JSON(http.StatusBadRequest, gin.H{
			"error":            "insufficient pool liquidity",
			"available":        totalStaked * 0.8,
			"requested_tokens": requiredTokens,
		})
		return
	}

	// Calculate collateral (150% of loan value)
	collateral := requiredTokens * LiquidationRatio
	fee := requiredTokens * FlashLoanFee

	now := time.Now()
	repaymentDue := now.Add(time.Duration(FlashLoanEpoch) * time.Second)

	loan := domain.FlashLoan{
		BorrowerID:      req.BorrowerID,
		KwhBorrowed:     req.KwhAmount,
		TokenCollateral: collateral,
		InterestRate:    FlashLoanFee * 100, // Store as percentage
		RepaymentDue:    repaymentDue,
		Status:          "active",
		CreatedAt:       now,
	}
	database.DB.Create(&loan)

	log.Printf("[DEFI-FLASH] ⚡ Flash loan: %s borrowed %.2f kWh (%.0f LT, collateral=%.0f, fee=%.2f, due=%s)",
		req.BorrowerID, req.KwhAmount, requiredTokens, collateral, fee, repaymentDue.Format("15:04:05"))

	// Broadcast SSE
	IoTBroker.Broadcast <- IoTEvent{
		Timestamp: now.UTC().Format(time.RFC3339),
		Type:      "flash_loan",
		Payload: map[string]interface{}{
			"borrower_id":   req.BorrowerID,
			"kwh_borrowed":  req.KwhAmount,
			"tokens":        requiredTokens,
			"collateral":    collateral,
			"fee":           fee,
			"repayment_due": repaymentDue.UTC().Format(time.RFC3339),
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"status":           "loan_active",
		"loan_id":          loan.ID,
		"kwh_borrowed":     req.KwhAmount,
		"tokens_loaned":    requiredTokens,
		"collateral":       collateral,
		"fee":              fee,
		"repayment_due":    repaymentDue.UTC().Format(time.RFC3339),
		"seconds_to_repay": FlashLoanEpoch,
		"message": fmt.Sprintf("⚡ Flash loan: %.2f kWh (fee: %.2f LT, repay by %s)",
			req.KwhAmount, fee, repaymentDue.Format("15:04:05")),
	})
}

// ──────────────────────────────────────────────────────────────
// POST /api/v1/defi/flash-loan/repay — Repay flash loan
// ──────────────────────────────────────────────────────────────

type RepayRequest struct {
	LoanID uint `json:"loan_id" binding:"required"`
}

func HandleFlashLoanRepay(c *gin.Context) {
	var req RepayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var loan domain.FlashLoan
	if err := database.DB.First(&loan, req.LoanID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "loan not found"})
		return
	}

	if loan.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "loan is not active (status: " + loan.Status + ")"})
		return
	}

	now := time.Now()

	// Check if past due
	if now.After(loan.RepaymentDue) {
		loan.Status = "liquidated"
		database.DB.Save(&loan)
		log.Printf("[DEFI-FLASH] 🔴 Loan %d LIQUIDATED (past due)", loan.ID)
		c.JSON(http.StatusOK, gin.H{
			"status":            "liquidated",
			"message":           "❌ Loan past due — collateral liquidated",
			"collateral_seized": loan.TokenCollateral,
		})
		return
	}

	repaidAt := now
	loan.RepaidAt = &repaidAt
	loan.Status = "repaid"
	database.DB.Save(&loan)

	fee := loan.KwhBorrowed * TokensPerKwh * FlashLoanFee

	// Fee goes to LP stakers as yield
	yieldRecord := domain.YieldRecord{
		UserID:    "liquidity_pool",
		Amount:    fee,
		Source:    "FlashLoan_Fee",
		Timestamp: now,
	}
	database.DB.Create(&yieldRecord)

	log.Printf("[DEFI-FLASH] ✅ Loan %d repaid (fee: %.2f LT → LP pool)", loan.ID, fee)

	c.JSON(http.StatusOK, gin.H{
		"status":              "repaid",
		"loan_id":             loan.ID,
		"fee_paid":            fee,
		"collateral_returned": loan.TokenCollateral,
		"message":             fmt.Sprintf("✅ Loan repaid — %.2f LT fee distributed to LP stakers", fee),
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/defi/yield/history — User's yield history
// ──────────────────────────────────────────────────────────────

func GetYieldHistory(c *gin.Context) {
	userID := c.Query("user_id")

	var yields []domain.YieldRecord
	query := database.DB.Order("timestamp desc").Limit(50)
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	query.Find(&yields)

	var totalYield float64
	for _, y := range yields {
		totalYield += y.Amount
	}

	c.JSON(http.StatusOK, gin.H{
		"yields":      yields,
		"total_yield": totalYield,
		"count":       len(yields),
	})
}
