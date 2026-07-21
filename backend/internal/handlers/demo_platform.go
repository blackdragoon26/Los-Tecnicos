package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"
	"los-tecnicos/backend/internal/simulation"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const demoSessionTTL = 6 * time.Hour

type demoPersona struct {
	Role        string             `json:"role"`
	AccessToken string             `json:"access_token"`
	User        domain.User        `json:"user"`
	Wallet      domain.AppWallet   `json:"wallet"`
	Kit         domain.HardwareKit `json:"kit"`
}

func CreateDemoSession(c *gin.Context) {
	now := time.Now().UTC()
	id := uuid.NewString()
	joinCode := strings.ToUpper(strings.ReplaceAll(id[:8], "-", ""))
	session := domain.DemoSession{ID: id, JoinCode: joinCode, SpeedMode: "pitch", SpeedMultiplier: 120, SimulatedStartAt: delhiDayStart(now), CreatedAt: now, ExpiresAt: now.Add(demoSessionTTL)}
	personas := map[string]demoPersona{}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&session).Error; err != nil {
			return err
		}
		for _, role := range []string{"donor", "receiver"} {
			persona, err := createDemoPersona(tx, &session, role)
			if err != nil {
				return err
			}
			personas[role] = persona
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create isolated demo session"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"session": session, "personas": personas, "snapshot": simulation.SnapshotForSession(&session)})
}

func JoinDemoSession(c *gin.Context) {
	var req struct {
		JoinCode string `json:"join_code"`
		Role     string `json:"role"`
	}
	if c.ShouldBindJSON(&req) != nil || (req.Role != "donor" && req.Role != "receiver") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "join_code and donor/receiver role are required"})
		return
	}
	var session domain.DemoSession
	if err := database.DB.Where("join_code = ? AND expires_at > ?", strings.ToUpper(req.JoinCode), time.Now()).First(&session).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "demo session not found or expired"})
		return
	}
	persona, err := loadDemoPersona(&session, req.Role)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "demo persona not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"session": session, "persona": persona})
}

func UpdateDemoSpeed(c *gin.Context) {
	var req struct {
		Mode string `json:"mode"`
	}
	if c.ShouldBindJSON(&req) != nil || (req.Mode != "realtime" && req.Mode != "10x" && req.Mode != "pitch") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mode must be realtime, 10x, or pitch"})
		return
	}
	var session domain.DemoSession
	if err := database.DB.First(&session, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}
	currentSimulated, _, _ := simulation.SimulatedTime(&session, time.Now().UTC())
	session.SimulatedStartAt = currentSimulated
	session.CreatedAt = time.Now().UTC()
	session.SpeedMode = req.Mode
	switch req.Mode {
	case "realtime":
		session.SpeedMultiplier = 1
	case "10x":
		session.SpeedMultiplier = 10
	default:
		session.SpeedMultiplier = 120
	}
	database.DB.Save(&session)
	c.JSON(http.StatusOK, gin.H{"session": session, "snapshot": simulation.SnapshotForSession(&session)})
}

func GetSimulationSnapshot(c *gin.Context) {
	session := findSession(c.Query("session_id"))
	c.JSON(http.StatusOK, simulation.SnapshotForSession(session))
}

func GetSimulationTimeSeries(c *gin.Context) {
	session := findSession(c.Query("session_id"))
	c.JSON(http.StatusOK, gin.H{"mode": "simulation", "unit": "LT/kWh", "points": simulation.TimeSeries(session, 48)})
}

func GetAppWallet(c *gin.Context) {
	userID := contextUserID(c)
	var wallet domain.AppWallet
	if err := database.DB.Where("user_id = ?", userID).First(&wallet).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "app wallet not found"})
		return
	}
	var entries []domain.WalletLedgerEntry
	database.DB.Where("wallet_id = ?", wallet.ID).Order("created_at desc").Limit(30).Find(&entries)
	c.JSON(http.StatusOK, gin.H{"wallet": wallet, "ledger": entries})
}

func TopUpDemoWallet(c *gin.Context) {
	var req struct {
		Amount         float64 `json:"amount"`
		IdempotencyKey string  `json:"idempotency_key"`
	}
	if c.ShouldBindJSON(&req) != nil || req.Amount <= 0 || req.Amount > 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount must be between 0 and 10000 LT"})
		return
	}
	if req.IdempotencyKey == "" {
		req.IdempotencyKey = "topup:" + uuid.NewString()
	}
	wallet, err := mutateWallet(contextUserID(c), req.IdempotencyKey, "demo_topup", req.Amount, 0, "Demo LT funding", "")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"wallet": wallet})
}

func GetHardwareKits(c *gin.Context) {
	var kits []domain.HardwareKit
	database.DB.Where("user_id = ?", contextUserID(c)).Order("registered_at desc").Find(&kits)
	c.JSON(http.StatusOK, gin.H{"kits": kits})
}

func RegisterHardwareKit(c *gin.Context) {
	var req struct {
		MACAddress string `json:"mac_address"`
		Alias      string `json:"alias"`
	}
	if c.ShouldBindJSON(&req) != nil || !validMAC(req.MACAddress) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid MAC address is required"})
		return
	}
	mac := strings.ToUpper(req.MACAddress)
	var kit domain.HardwareKit
	query := database.DB.Where("user_id = ?", contextUserID(c))
	if err := query.Where("mac_address = ?", mac).First(&kit).Error; err != nil {
		if err := query.First(&kit).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "no kit available for this wallet"})
			return
		}
		kit.MACAddress = mac
	}
	if req.Alias != "" {
		kit.Alias = req.Alias
	}
	kit.Status = "online"
	kit.RegisteredAt = time.Now().UTC()
	if err := database.DB.Save(&kit).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "MAC address is already registered"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"kit": kit})
}

func LockDemoTrade(c *gin.Context) {
	var req struct {
		SessionID      string  `json:"session_id"`
		InputWh        float64 `json:"input_wh"`
		IdempotencyKey string  `json:"idempotency_key"`
	}
	if c.ShouldBindJSON(&req) != nil || req.SessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}
	if req.InputWh <= 0 {
		req.InputWh = 6
	}
	if req.InputWh > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prototype transfer cannot exceed 50 Wh"})
		return
	}
	if req.IdempotencyKey == "" {
		req.IdempotencyKey = "lock:" + uuid.NewString()
	}

	var trade domain.EnergyTrade
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var receiver, donor domain.AppWallet
		if err := tx.Where("user_id = ? AND session_id = ?", contextUserID(c), req.SessionID).First(&receiver).Error; err != nil {
			return errors.New("receiver wallet not found")
		}
		var currentUser domain.User
		tx.First(&currentUser, "id = ?", contextUserID(c))
		if strings.ToLower(currentUser.Role) != "recipient" {
			return errors.New("receiver persona must lock funds")
		}
		if err := tx.Where("session_id = ? AND user_id <> ?", req.SessionID, currentUser.ID).First(&donor).Error; err != nil {
			return errors.New("donor wallet not found")
		}
		var donorKit, receiverKit domain.HardwareKit
		if err := tx.Where("user_id = ?", donor.UserID).First(&donorKit).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", receiver.UserID).First(&receiverKit).Error; err != nil {
			return err
		}
		var session domain.DemoSession
		if err := tx.First(&session, "id = ?", req.SessionID).Error; err != nil {
			return err
		}
		price := simulation.SnapshotForSession(&session).PriceLTPerKwh
		usable := req.InputWh * 0.82
		amount := usable / 1000 * price
		if receiver.Balance < amount {
			return errors.New("insufficient LT balance")
		}
		now := time.Now().UTC()
		trade = domain.EnergyTrade{ID: uuid.NewString(), SessionID: req.SessionID, DonorWalletID: donor.ID, ReceiverWalletID: receiver.ID, DonorMAC: donorKit.MACAddress, ReceiverMAC: receiverKit.MACAddress, InputWh: round4(req.InputWh), UsableWh: round4(usable), LossWh: round4(req.InputWh - usable), PricePerKwh: price, TokenAmount: round6(amount), State: "funds_locked", BusVoltage: 5.08, CurrentMa: 520, EfficiencyPct: 82, TrueEtaSeconds: int64(math.Round(req.InputWh / (5.08 * 0.52) * 3600)), DemoEtaSeconds: 20, CreatedAt: now, LockedAt: &now}
		if err := tx.Create(&trade).Error; err != nil {
			return err
		}
		receiver.Balance = round6(receiver.Balance - amount)
		receiver.EscrowBalance = round6(receiver.EscrowBalance + amount)
		if err := tx.Save(&receiver).Error; err != nil {
			return err
		}
		return tx.Create(&domain.WalletLedgerEntry{ID: uuid.NewString(), WalletID: receiver.ID, SessionID: req.SessionID, TradeID: trade.ID, EntryType: "escrow_lock", Amount: -amount, BalanceAfter: receiver.Balance, EscrowAfter: receiver.EscrowBalance, IdempotencyKey: req.IdempotencyKey, Description: "Receiver funds locked for prototype delivery", CreatedAt: now}).Error
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"trade": trade})
}

func StartDemoTrade(c *gin.Context) { transitionTrade(c, "funds_locked", "transferring") }
func CancelDemoTrade(c *gin.Context) {
	refundTrade(c, "cancelled", "Trade cancelled; receiver escrow refunded")
}
func FaultDemoTrade(c *gin.Context) {
	refundTrade(c, "fault", "Hardware fault; receiver escrow refunded")
}
func TimeoutDemoTrade(c *gin.Context) {
	refundTrade(c, "timeout", "Telemetry timeout; receiver escrow refunded")
}

func GetDemoTrade(c *gin.Context) {
	trade, err := refreshTrade(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trade not found"})
		return
	}
	if !userOwnsTrade(contextUserID(c), &trade) {
		c.JSON(http.StatusForbidden, gin.H{"error": "trade does not belong to this demo persona"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"trade": trade})
}

func GetActiveDemoTrade(c *gin.Context) {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}
	var wallet domain.AppWallet
	if err := database.DB.Where("user_id = ? AND session_id = ?", contextUserID(c), sessionID).First(&wallet).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "demo session does not belong to this persona"})
		return
	}
	var trade domain.EnergyTrade
	err := database.DB.Where("session_id = ?", sessionID).Order("created_at desc").First(&trade).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusOK, gin.H{"trade": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load active trade"})
		return
	}
	trade, err = refreshTrade(trade.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to refresh active trade"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"trade": trade})
}

func SettleDemoTrade(c *gin.Context) {
	trade, err := refreshTrade(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trade not found"})
		return
	}
	if trade.State == "settled" {
		c.JSON(http.StatusOK, gin.H{"trade": trade, "idempotent": true})
		return
	}
	if trade.State != "delivered" {
		c.JSON(http.StatusConflict, gin.H{"error": "trade must be delivered before settlement"})
		return
	}
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var receiver, donor domain.AppWallet
		if err := tx.First(&receiver, "id = ?", trade.ReceiverWalletID).Error; err != nil {
			return err
		}
		if err := tx.First(&donor, "id = ?", trade.DonorWalletID).Error; err != nil {
			return err
		}
		if receiver.EscrowBalance+0.0000001 < trade.TokenAmount {
			return errors.New("escrow invariant failed")
		}
		receiver.EscrowBalance = round6(receiver.EscrowBalance - trade.TokenAmount)
		donor.Balance = round6(donor.Balance + trade.TokenAmount)
		now := time.Now().UTC()
		trade.State = "settled"
		trade.ProgressPct = 100
		trade.SettledAt = &now
		if err := tx.Save(&receiver).Error; err != nil {
			return err
		}
		if err := tx.Save(&donor).Error; err != nil {
			return err
		}
		if err := tx.Save(&trade).Error; err != nil {
			return err
		}
		entries := []domain.WalletLedgerEntry{
			{ID: uuid.NewString(), WalletID: receiver.ID, SessionID: trade.SessionID, TradeID: trade.ID, EntryType: "escrow_release", Amount: 0, BalanceAfter: receiver.Balance, EscrowAfter: receiver.EscrowBalance, IdempotencyKey: "settle:receiver:" + trade.ID, Description: "Delivered energy accepted", CreatedAt: now},
			{ID: uuid.NewString(), WalletID: donor.ID, SessionID: trade.SessionID, TradeID: trade.ID, EntryType: "energy_credit", Amount: trade.TokenAmount, BalanceAfter: donor.Balance, EscrowAfter: donor.EscrowBalance, IdempotencyKey: "settle:donor:" + trade.ID, Description: "LT credited for verified delivery", CreatedAt: now},
		}
		if err := tx.Create(&entries).Error; err != nil {
			return err
		}
		return tx.Create(&domain.Transaction{ID: "demo_" + trade.ID, DonorID: donor.UserID, RecipientID: receiver.UserID, KwhAmount: trade.UsableWh / 1000, TokenAmount: trade.TokenAmount, BlockchainHash: "demo-proof-" + trade.ID, Status: "Completed", Timestamp: now, SessionID: trade.SessionID, Unit: "LT"}).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"trade": trade})
}

var ratesCache struct {
	sync.Mutex
	payload gin.H
	expires time.Time
}

func GetMarketRates(c *gin.Context) {
	ratesCache.Lock()
	defer ratesCache.Unlock()
	now := time.Now().UTC()
	if now.Before(ratesCache.expires) {
		c.JSON(http.StatusOK, ratesCache.payload)
		return
	}
	usdInr, usdEur, source := 83.5, 0.92, "configured fallback"
	client := http.Client{Timeout: 2500 * time.Millisecond}
	if resp, err := client.Get("https://api.frankfurter.app/latest?from=USD&to=INR,EUR"); err == nil {
		defer resp.Body.Close()
		var data struct {
			Rates map[string]float64 `json:"rates"`
		}
		if resp.StatusCode == http.StatusOK && json.NewDecoder(resp.Body).Decode(&data) == nil && data.Rates["INR"] > 0 && data.Rates["EUR"] > 0 {
			usdInr, usdEur, source = data.Rates["INR"], data.Rates["EUR"], "Frankfurter/ECB"
		}
	}
	ltUSD := 0.05
	ratesCache.payload = gin.H{"base": "LT", "rates": gin.H{"LT": 1, "USD": ltUSD, "INR": ltUSD * usdInr, "EUR": ltUSD * usdEur}, "source": source, "quoted_at": now, "fallback": source == "configured fallback"}
	ratesCache.expires = now.Add(30 * time.Minute)
	c.JSON(http.StatusOK, ratesCache.payload)
}

func createDemoPersona(tx *gorm.DB, session *domain.DemoSession, role string) (demoPersona, error) {
	userRole, initial := "Donor", 80.0
	region, lat, lon := "Gurugram", 28.4595, 77.0266
	if role == "receiver" {
		userRole, initial, region, lat, lon = "Recipient", 350, "Noida", 28.5355, 77.3910
	}
	user := domain.User{ID: fmt.Sprintf("demo-%s-%s", session.ID, role), WalletAddress: fmt.Sprintf("app://%s/%s", session.ID, role), Role: userRole, Location: region + ", Delhi NCR", CreatedAt: time.Now().UTC(), KYCStatus: "demo"}
	wallet := domain.AppWallet{ID: fmt.Sprintf("lt-%s-%s", session.ID, role), UserID: user.ID, SessionID: session.ID, Balance: initial, Currency: "LT", IsDemo: true, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
	mac := sessionMAC(session.ID, role)
	kit := domain.HardwareKit{ID: uuid.NewString(), MACAddress: mac, Alias: strings.Title(role) + " Sample Kit", UserID: user.ID, SessionID: session.ID, Location: region + ", Delhi NCR", Latitude: lat, Longitude: lon, HardwareProfile: "prototype_5v_18650", Status: "ready_to_register", IsDemo: true, RegisteredAt: time.Now().UTC()}
	if err := tx.Create(&user).Error; err != nil {
		return demoPersona{}, err
	}
	if err := tx.Create(&wallet).Error; err != nil {
		return demoPersona{}, err
	}
	if err := tx.Create(&kit).Error; err != nil {
		return demoPersona{}, err
	}
	entry := domain.WalletLedgerEntry{ID: uuid.NewString(), WalletID: wallet.ID, SessionID: session.ID, EntryType: "demo_seed", Amount: initial, BalanceAfter: initial, IdempotencyKey: "seed:" + wallet.ID, Description: "Isolated demo wallet funding", CreatedAt: time.Now().UTC()}
	if err := tx.Create(&entry).Error; err != nil {
		return demoPersona{}, err
	}
	token, err := createAccessToken(&user)
	if err != nil {
		return demoPersona{}, err
	}
	return demoPersona{Role: role, AccessToken: token, User: user, Wallet: wallet, Kit: kit}, nil
}

func loadDemoPersona(session *domain.DemoSession, role string) (demoPersona, error) {
	var user domain.User
	if err := database.DB.First(&user, "id = ?", fmt.Sprintf("demo-%s-%s", session.ID, role)).Error; err != nil {
		return demoPersona{}, err
	}
	var wallet domain.AppWallet
	var kit domain.HardwareKit
	database.DB.First(&wallet, "user_id = ?", user.ID)
	database.DB.First(&kit, "user_id = ?", user.ID)
	token, err := createAccessToken(&user)
	if err != nil {
		return demoPersona{}, err
	}
	return demoPersona{Role: role, AccessToken: token, User: user, Wallet: wallet, Kit: kit}, nil
}

func transitionTrade(c *gin.Context, expected, next string) {
	trade, err := refreshTrade(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trade not found"})
		return
	}
	var wallet domain.AppWallet
	database.DB.First(&wallet, "user_id = ?", contextUserID(c))
	if next == "transferring" && wallet.ID != trade.DonorWalletID {
		c.JSON(http.StatusForbidden, gin.H{"error": "donor persona must start hardware transfer"})
		return
	}
	if trade.State != expected {
		c.JSON(http.StatusConflict, gin.H{"error": "trade is not ready for this transition", "trade": trade})
		return
	}
	now := time.Now().UTC()
	trade.State = next
	trade.StartedAt = &now
	database.DB.Save(&trade)
	c.JSON(http.StatusOK, gin.H{"trade": trade})
}

func userOwnsTrade(userID string, trade *domain.EnergyTrade) bool {
	var wallet domain.AppWallet
	if database.DB.Where("user_id = ?", userID).First(&wallet).Error != nil {
		return false
	}
	return wallet.ID == trade.DonorWalletID || wallet.ID == trade.ReceiverWalletID
}

func refreshTrade(id string) (domain.EnergyTrade, error) {
	var trade domain.EnergyTrade
	if err := database.DB.First(&trade, "id = ?", id).Error; err != nil {
		return trade, err
	}
	if trade.State == "transferring" && trade.StartedAt != nil {
		progress := math.Min(100, time.Since(*trade.StartedAt).Seconds()/float64(trade.DemoEtaSeconds)*100)
		trade.ProgressPct = round4(progress)
		if progress >= 100 {
			now := time.Now().UTC()
			trade.State = "delivered"
			trade.DeliveredAt = &now
		}
		database.DB.Save(&trade)
	}
	return trade, nil
}

func refundTrade(c *gin.Context, state, reason string) {
	trade, err := refreshTrade(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trade not found"})
		return
	}
	if trade.State == "cancelled" || trade.State == "fault" || trade.State == "timeout" {
		c.JSON(http.StatusOK, gin.H{"trade": trade, "idempotent": true})
		return
	}
	if trade.State == "settled" {
		c.JSON(http.StatusConflict, gin.H{"error": "settled trade cannot be refunded"})
		return
	}
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var receiver domain.AppWallet
		if err := tx.First(&receiver, "id = ?", trade.ReceiverWalletID).Error; err != nil {
			return err
		}
		receiver.Balance = round6(receiver.Balance + trade.TokenAmount)
		receiver.EscrowBalance = round6(math.Max(0, receiver.EscrowBalance-trade.TokenAmount))
		trade.State = state
		trade.FailureReason = reason
		if err := tx.Save(&receiver).Error; err != nil {
			return err
		}
		if err := tx.Save(&trade).Error; err != nil {
			return err
		}
		return tx.Create(&domain.WalletLedgerEntry{ID: uuid.NewString(), WalletID: receiver.ID, SessionID: trade.SessionID, TradeID: trade.ID, EntryType: "escrow_refund", Amount: trade.TokenAmount, BalanceAfter: receiver.Balance, EscrowAfter: receiver.EscrowBalance, IdempotencyKey: "refund:" + trade.ID, Description: reason, CreatedAt: time.Now().UTC()}).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"trade": trade})
}

func mutateWallet(userID, idempotencyKey, entryType string, balanceDelta, escrowDelta float64, description, tradeID string) (domain.AppWallet, error) {
	var wallet domain.AppWallet
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var existing domain.WalletLedgerEntry
		if err := tx.Where("idempotency_key = ?", idempotencyKey).First(&existing).Error; err == nil {
			return tx.First(&wallet, "id = ?", existing.WalletID).Error
		}
		if err := tx.Where("user_id = ?", userID).First(&wallet).Error; err != nil {
			return err
		}
		if !wallet.IsDemo && entryType == "demo_topup" {
			return errors.New("demo top-up is not available for this wallet")
		}
		if wallet.Balance+balanceDelta < 0 || wallet.EscrowBalance+escrowDelta < 0 {
			return errors.New("wallet balance invariant failed")
		}
		wallet.Balance = round6(wallet.Balance + balanceDelta)
		wallet.EscrowBalance = round6(wallet.EscrowBalance + escrowDelta)
		if err := tx.Save(&wallet).Error; err != nil {
			return err
		}
		return tx.Create(&domain.WalletLedgerEntry{ID: uuid.NewString(), WalletID: wallet.ID, SessionID: wallet.SessionID, TradeID: tradeID, EntryType: entryType, Amount: balanceDelta, BalanceAfter: wallet.Balance, EscrowAfter: wallet.EscrowBalance, IdempotencyKey: idempotencyKey, Description: description, CreatedAt: time.Now().UTC()}).Error
	})
	return wallet, err
}

func findSession(id string) *domain.DemoSession {
	if id == "" {
		return nil
	}
	var s domain.DemoSession
	if database.DB.First(&s, "id = ?", id).Error != nil {
		return nil
	}
	return &s
}
func contextUserID(c *gin.Context) string {
	value, _ := c.Get("userID")
	id, _ := value.(string)
	return id
}
func validMAC(mac string) bool {
	return regexp.MustCompile(`(?i)^[0-9a-f]{2}(:[0-9a-f]{2}){5}$`).MatchString(mac)
}
func sessionMAC(id, role string) string {
	clean := strings.ReplaceAll(id, "-", "")
	offset := 0
	if role == "receiver" {
		offset = 6
	}
	return fmt.Sprintf("02:%s:%s:%s:%s:%s", clean[offset:offset+2], clean[offset+2:offset+4], clean[offset+4:offset+6], clean[offset+6:offset+8], clean[offset+8:offset+10])
}
func delhiDayStart(now time.Time) time.Time {
	ist := time.FixedZone("IST", 5*3600+1800)
	local := now.In(ist)
	return time.Date(local.Year(), local.Month(), local.Day(), 6, 0, 0, 0, ist).UTC()
}
func round4(v float64) float64 { return math.Round(v*10000) / 10000 }
func round6(v float64) float64 { return math.Round(v*1000000) / 1000000 }
