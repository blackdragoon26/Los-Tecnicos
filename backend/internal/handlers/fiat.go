package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"los-tecnicos/backend/internal/blockchain"
	"los-tecnicos/backend/internal/config"
	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"

	dodopayments "github.com/dodopayments/dodopayments-go"
	"github.com/dodopayments/dodopayments-go/option"
	"github.com/gin-gonic/gin"
	svix "github.com/standard-webhooks/standard-webhooks/libraries/go"
)

var dodoClient *dodopayments.Client

func initDodo() {
	if dodoClient == nil {
		token := config.GetEnv("DODO_PAYMENTS_API_KEY", "") // MUST BE SET IN PROD
		if token != "" {
			dodoClient = dodopayments.NewClient(
				option.WithBearerToken(token),
				// Use Test environment if needed
				// option.WithBaseURL("https://test.dodopayments.com"),
			)
			log.Println("Dodo Payments Client Initialized")
		} else {
			log.Println("⚠️ DODO_PAYMENTS_API_KEY not set. Fiat checkouts will fail.")
		}
	}
}

// CreateFiatCheckoutRequest
type CreateFiatCheckoutRequest struct {
	LTAmount      float64 `json:"lt_amount" binding:"required"`      // Number of LT Tokens to buy
	WalletAddress string  `json:"wallet_address" binding:"required"` // Where to send the tokens
}

// CreateFiatCheckout initiates a Dodo Payments checkout session
func CreateFiatCheckout(c *gin.Context) {
	initDodo()
	if dodoClient == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Fiat payments are currently disabled."})
		return
	}

	var req CreateFiatCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload", "details": err.Error()})
		return
	}

	// 1 LT = 0.05 USD (Simulated fixed exchange rate for the fiat ramp MVP)
	// Or maybe dynamically fetch if we had an oracle
	usdTotal := req.LTAmount * 0.05
	usdCents := int64(usdTotal * 100)
	if usdCents < 50 { // Minimal viable charge in Stripe/Dodo usually 50 cents
		c.JSON(http.StatusBadRequest, gin.H{"error": "Minimum purchase is 10 LT tokens ($0.50 USD)"})
		return
	}

	ctx := context.Background()

	// Dodo takes payments in cents (or minor currency units)
	// We'll embed the wallet address & LT amount in the metadata so the webhook knows what to mint
	productName := fmt.Sprintf("%.0f Los Técnicos Energy Tokens (LT)", req.LTAmount)
	returnUrl := config.GetEnv("FRONTEND_URL", "http://localhost:5173") + "/dashboard?payment_success=true"

	res, err := dodoClient.Payments.New(ctx, dodopayments.PaymentNewParams{
		Billing: dodopayments.F(dodopayments.BillingAddressParam{
			City:    dodopayments.F("San Francisco"),
			Country: dodopayments.F(dodopayments.CountryCodeUs),
			State:   dodopayments.F("CA"),
			Street:  dodopayments.F("123 Market St"),
			Zipcode: dodopayments.F("94105"),
		}),
		Customer: dodopayments.F(dodopayments.CustomerRequestUnionParam(dodopayments.CustomerRequestParam{
			Name:  dodopayments.F("Guest"),
			Email: dodopayments.F("guest@example.com"),
		})),
		BillingCurrency: dodopayments.F(dodopayments.CurrencyUsd),
		ProductCart: dodopayments.F([]dodopayments.OneTimeProductCartItemParam{
			{
				ProductID: dodopayments.F("pdt_01JNEBBR8T5Q8D24T95Q2M6NYM"), // Using a generic testing product or valid placeholder
				Quantity:  dodopayments.F(int64(1)),
				Amount:    dodopayments.F(usdCents),
			},
		}),
		PaymentLink: dodopayments.F(true), // We want a hosted checkout link
		ReturnURL:   dodopayments.F(returnUrl),
		Metadata: dodopayments.F(map[string]string{
			"wallet_address": req.WalletAddress,
			"lt_amount":      fmt.Sprintf("%f", req.LTAmount),
			"usd_charged":    fmt.Sprintf("%d", usdCents),
			"product_name":   productName,
		}),
	})

	if err != nil {
		log.Printf("[FIAT] Failed to create Dodo checkout: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate checkout session"})
		return
	}

	checkoutUrl := ""
	if res.PaymentLink != "" {
		checkoutUrl = res.PaymentLink
	}

	log.Printf("[FIAT] Generated checkout link for %s: %s", req.WalletAddress, checkoutUrl)

	c.JSON(http.StatusOK, gin.H{
		"checkout_url": checkoutUrl,
		"payment_id":   res.PaymentID,
		"amount_usd":   usdTotal,
	})
}

// HandleFiatWebhook receives events from Dodo Payments when a checkout is completed
func HandleFiatWebhook(c *gin.Context) {
	log.Println("[FIAT] Received Webhook from Dodo Payments")

	// 1. Verify standard-webhook signature (Svix)
	secret := config.GetEnv("DODO_WEBHOOK_SECRET", "") // MUST BE SET IN PROD
	if secret == "" {
		log.Println("⚠️ DODO_WEBHOOK_SECRET not set, accepting webhook unverified! (ONLY FOR DEV!)")
	} else {
		payload, _ := io.ReadAll(c.Request.Body)
		headers := c.Request.Header

		wh, err := svix.NewWebhook(secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse webhook secret"})
			return
		}

		err = wh.Verify(payload, headers)
		if err != nil {
			log.Printf("[FIAT] ❌ Webhook signature verification failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid webhook signature"})
			return
		}
		// Put payload back for binding
		c.Request.Body = io.NopCloser(bytes.NewBuffer(payload))
	}

	// 2. Parse Dodo Event Payload
	payloadBytes, _ := io.ReadAll(c.Request.Body)
	// We consumed c.Request.Body in signature verification. We already restored it or we can just parse `payloadBytes`.

	var evt struct {
		EventID string `json:"webhook_event_id"` // Sometimes Dodo uses different fields
		Type    string `json:"type"`             // usually "payment.succeeded"
		Data    struct {
			PaymentID string            `json:"payment_id"`
			Status    string            `json:"status"`
			Metadata  map[string]string `json:"metadata"`
		} `json:"data"`
	}

	if err := json.Unmarshal(payloadBytes, &evt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook format"})
		return
	}

	log.Printf("[FIAT] Webhook Event Type: %s, PaymentStatus: %s", evt.Type, evt.Data.Status)

	// In Dodo, wait for highly verified payment status
	if evt.Type == "payment.succeeded" && evt.Data.Status == "succeeded" {
		walletAddress := evt.Data.Metadata["wallet_address"]
		ltAmountStr := evt.Data.Metadata["lt_amount"]

		if walletAddress == "" || ltAmountStr == "" {
			log.Println("[FIAT] ❌ Missing metadata in successful webhook. Cannot mint tokens.")
			c.JSON(http.StatusOK, gin.H{"received": true}) // Always acknowledge webhook
			return
		}

		var ltAmount float64
		fmt.Sscanf(ltAmountStr, "%f", &ltAmount)

		log.Printf("[FIAT] 💳 Payment successful! Minting %.2f LT to %s", ltAmount, walletAddress)

		// 3. Trigger Web3 Soroban Minting (Admin Key sponsors tx to mint tokens to user)
		rpcURL := config.GetEnv("SOROBAN_RPC_URL", "https://soroban-testnet.stellar.org:443")
		client := blockchain.NewSorobanClient(rpcURL)

		txHash, err := client.MintTokens(walletAddress, ltAmount)
		if err != nil {
			log.Printf("[FIAT] ❌ CRITICAL: Failed to mint tokens after successful payment: %v", err)
			// In production, we would add this to a retry queue or alert an admin!
		} else {
			log.Printf("[FIAT] ✨ Successfully minted purchased tokens on Soroban! TxHash: %s", txHash)

			// 4. Optionally log this fiat purchase in the DB
			purchaseRecord := domain.Transaction{
				ID:             "fiat_" + evt.Data.PaymentID,
				DonorID:        "dodo_fiat_ramp",
				RecipientID:    walletAddress,
				KwhAmount:      0, // Not tied to energy initially
				TokenAmount:    ltAmount,
				BlockchainHash: txHash,
				Status:         "Completed",
				Timestamp:      time.Now(),
			}
			database.DB.Create(&purchaseRecord)

			// Broadcast SSE so frontend reacts instantly
			IoTBroker.Broadcast <- IoTEvent{
				Timestamp: time.Now().UTC().Format(time.RFC3339),
				Type:      "fiat_purchase_success",
				Payload: map[string]interface{}{
					"wallet_address": walletAddress,
					"amount":         ltAmountStr,
					"tx_hash":        txHash,
				},
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}
