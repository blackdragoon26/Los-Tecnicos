package handlers

import (
	"math"
	"net/http"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"

	"github.com/gin-gonic/gin"
)

// ══════════════════════════════════════════════════════════════
// Public Transaction Ledger & Marketplace Transparency
// ══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
// GET /api/v1/ledger/transactions — All trades (public, paginated)
// ──────────────────────────────────────────────────────────────

func GetLedgerTransactions(c *gin.Context) {
	page := 1
	limit := 25

	var transactions []domain.Transaction
	var total int64

	database.DB.Model(&domain.Transaction{}).Count(&total)
	database.DB.Order("timestamp desc").Limit(limit).Offset((page - 1) * limit).Find(&transactions)

	c.JSON(http.StatusOK, gin.H{
		"transactions": transactions,
		"total":        total,
		"page":         page,
		"limit":        limit,
		"pages":        int(math.Ceil(float64(total) / float64(limit))),
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/ledger/mints — All minting events (public)
// ──────────────────────────────────────────────────────────────

func GetLedgerMints(c *gin.Context) {
	var mints []domain.EnergyMint
	var total int64

	database.DB.Model(&domain.EnergyMint{}).Count(&total)
	database.DB.Order("timestamp desc").Limit(50).Find(&mints)

	var totalKwh, totalTokens float64
	for _, m := range mints {
		totalKwh += m.KwhTransferred
		totalTokens += m.TokensMinted
	}

	c.JSON(http.StatusOK, gin.H{
		"mints":        mints,
		"total_events": total,
		"total_kwh":    math.Round(totalKwh*10000) / 10000,
		"total_tokens": math.Round(totalTokens*100) / 100,
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/ledger/burns — All burn events (public)
// ──────────────────────────────────────────────────────────────

func GetLedgerBurns(c *gin.Context) {
	var burns []domain.TokenBurn
	var total int64

	database.DB.Model(&domain.TokenBurn{}).Count(&total)
	database.DB.Order("timestamp desc").Limit(50).Find(&burns)

	var totalBurned float64
	for _, b := range burns {
		totalBurned += b.TokensBurned
	}

	c.JSON(http.StatusOK, gin.H{
		"burns":        burns,
		"total_events": total,
		"total_burned": totalBurned,
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/ledger/carbon — Carbon credit ledger (public)
// ──────────────────────────────────────────────────────────────

func GetCarbonLedger(c *gin.Context) {
	var credits []domain.CarbonCredit
	database.DB.Order("timestamp desc").Limit(50).Find(&credits)

	var totalKwh, totalCO2, totalValue float64
	for _, cr := range credits {
		totalKwh += cr.KwhOffset
		totalCO2 += cr.CO2SavedKg
		totalValue += cr.CreditValue
	}

	c.JSON(http.StatusOK, gin.H{
		"credits":            credits,
		"total_kwh_offset":   math.Round(totalKwh*10000) / 10000,
		"total_co2_saved_kg": math.Round(totalCO2*1000) / 1000,
		"total_credit_value": math.Round(totalValue*10000) / 10000,
		"emission_factor":    CO2EmissionFactor,
		"equivalent_trees":   math.Round(totalCO2/21.77*10) / 10, // 1 tree absorbs ~21.77 kg CO₂/year
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/ledger/price-history — Dynamic price history
// ──────────────────────────────────────────────────────────────

func GetPriceHistory(c *gin.Context) {
	var prices []domain.PricingHistory
	database.DB.Order("timestamp desc").Limit(100).Find(&prices)

	c.JSON(http.StatusOK, gin.H{
		"prices": prices,
		"count":  len(prices),
	})
}

// ──────────────────────────────────────────────────────────────
// GET /api/v1/ledger/overview — Full transparency overview
// ──────────────────────────────────────────────────────────────

func GetLedgerOverview(c *gin.Context) {
	// Transactions
	var txCount int64
	var totalEnergyTraded float64
	database.DB.Model(&domain.Transaction{}).Count(&txCount)
	database.DB.Model(&domain.Transaction{}).Select("COALESCE(SUM(kwh_amount), 0)").Row().Scan(&totalEnergyTraded)

	// Mints & Burns
	var totalMinted, totalBurned float64
	database.DB.Model(&domain.EnergyMint{}).Select("COALESCE(SUM(tokens_minted), 0)").Row().Scan(&totalMinted)
	database.DB.Model(&domain.TokenBurn{}).Select("COALESCE(SUM(tokens_burned), 0)").Row().Scan(&totalBurned)

	// Carbon
	var totalCO2 float64
	database.DB.Model(&domain.CarbonCredit{}).Select("COALESCE(SUM(co2_saved_kg), 0)").Row().Scan(&totalCO2)

	// DeFi
	var tvl float64
	var flashLoanCount int64
	database.DB.Model(&domain.LiquidityPool{}).Where("status = 'active'").
		Select("COALESCE(SUM(amount_staked), 0)").Row().Scan(&tvl)
	database.DB.Model(&domain.FlashLoan{}).Count(&flashLoanCount)

	// Yield
	var totalYield float64
	database.DB.Model(&domain.YieldRecord{}).Select("COALESCE(SUM(amount), 0)").Row().Scan(&totalYield)

	// DePIN
	var nodeCount int64
	database.DB.Model(&domain.DePINNode{}).Count(&nodeCount)

	// Orders
	var openOrders int64
	database.DB.Model(&domain.EnergyOrder{}).Where("status = 'Created'").Count(&openOrders)

	c.JSON(http.StatusOK, gin.H{
		"marketplace": gin.H{
			"total_transactions":  txCount,
			"total_energy_traded": totalEnergyTraded,
			"open_orders":         openOrders,
		},
		"tokens": gin.H{
			"total_minted":       totalMinted,
			"total_burned":       totalBurned,
			"circulating_supply": totalMinted - totalBurned,
			"ratio":              "1 kWh = 1000 LT",
		},
		"defi": gin.H{
			"total_value_locked": tvl,
			"total_yield_paid":   totalYield,
			"flash_loans_issued": flashLoanCount,
		},
		"carbon": gin.H{
			"total_co2_saved_kg": totalCO2,
			"equivalent_trees":   math.Round(totalCO2/21.77*10) / 10,
		},
		"depin": gin.H{
			"registered_nodes": nodeCount,
		},
		"generated_at": time.Now().UTC().Format(time.RFC3339),
	})
}
