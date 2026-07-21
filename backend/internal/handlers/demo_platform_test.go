package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupDemoDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.AppWallet{}, &domain.WalletLedgerEntry{}, &domain.HardwareKit{}, &domain.DemoSession{}, &domain.EnergyTrade{}, &domain.Transaction{}); err != nil {
		t.Fatal(err)
	}
	database.DB = db
}

func TestMutateWalletIsIdempotent(t *testing.T) {
	setupDemoDB(t)
	wallet := domain.AppWallet{ID: "wallet-a", UserID: "user-a", SessionID: "session-a", Balance: 10, Currency: "LT", IsDemo: true}
	if err := database.DB.Create(&wallet).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		got, err := mutateWallet("user-a", "same-key", "demo_topup", 5, 0, "test", "")
		if err != nil {
			t.Fatal(err)
		}
		if got.Balance != 15 {
			t.Fatalf("top-up %d produced balance %.2f, want 15", i, got.Balance)
		}
	}
	var count int64
	database.DB.Model(&domain.WalletLedgerEntry{}).Where("idempotency_key = ?", "same-key").Count(&count)
	if count != 1 {
		t.Fatalf("got %d ledger entries, want 1", count)
	}
}

func TestSettlementCreditsDonorOnce(t *testing.T) {
	setupDemoDB(t)
	now := time.Now().UTC()
	donor := domain.AppWallet{ID: "donor-wallet", UserID: "donor-user", SessionID: "session-a", Balance: 80, Currency: "LT", IsDemo: true}
	receiver := domain.AppWallet{ID: "receiver-wallet", UserID: "receiver-user", SessionID: "session-a", Balance: 349, EscrowBalance: 1, Currency: "LT", IsDemo: true}
	trade := domain.EnergyTrade{ID: "trade-a", SessionID: "session-a", DonorWalletID: donor.ID, ReceiverWalletID: receiver.ID, TokenAmount: 1, UsableWh: 5, State: "delivered", DeliveredAt: &now, CreatedAt: now}
	for _, value := range []any{&donor, &receiver, &trade} {
		if err := database.DB.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}

	for i := 0; i < 2; i++ {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Params = gin.Params{{Key: "id", Value: trade.ID}}
		ctx.Set("userID", "receiver-user")
		SettleDemoTrade(ctx)
		if recorder.Code != 200 {
			t.Fatalf("settle %d returned %d: %s", i, recorder.Code, recorder.Body.String())
		}
	}
	database.DB.First(&donor, "id = ?", donor.ID)
	database.DB.First(&receiver, "id = ?", receiver.ID)
	if donor.Balance != 81 || receiver.Balance != 349 || receiver.EscrowBalance != 0 {
		t.Fatalf("unexpected balances donor=%.2f receiver=%.2f escrow=%.2f", donor.Balance, receiver.Balance, receiver.EscrowBalance)
	}
	var transactions int64
	database.DB.Model(&domain.Transaction{}).Count(&transactions)
	if transactions != 1 {
		t.Fatalf("got %d settlement transactions, want 1", transactions)
	}
}

func TestFaultRefundsEscrowOnce(t *testing.T) {
	setupDemoDB(t)
	receiver := domain.AppWallet{ID: "receiver-wallet", UserID: "receiver-user", SessionID: "session-a", Balance: 349, EscrowBalance: 1, Currency: "LT", IsDemo: true}
	trade := domain.EnergyTrade{ID: "trade-a", SessionID: "session-a", DonorWalletID: "donor-wallet", ReceiverWalletID: receiver.ID, TokenAmount: 1, State: "transferring", DemoEtaSeconds: 1000, CreatedAt: time.Now().UTC()}
	for _, value := range []any{&receiver, &trade} {
		if err := database.DB.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 2; i++ {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Params = gin.Params{{Key: "id", Value: trade.ID}}
		ctx.Set("userID", "receiver-user")
		FaultDemoTrade(ctx)
		if recorder.Code != 200 {
			var payload map[string]any
			_ = json.Unmarshal(recorder.Body.Bytes(), &payload)
			t.Fatalf("fault %d returned %d: %v", i, recorder.Code, payload)
		}
	}
	database.DB.First(&receiver, "id = ?", receiver.ID)
	if receiver.Balance != 350 || receiver.EscrowBalance != 0 {
		t.Fatalf("refund was not conserved: balance=%.2f escrow=%.2f", receiver.Balance, receiver.EscrowBalance)
	}
}
