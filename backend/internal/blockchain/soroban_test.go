package blockchain

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/stellar/go/keypair"
)

func TestGenerateOraclePayload(t *testing.T) {
	// 1. Initialize Client
	client := NewSorobanClient("http://localhost:8000") // Mock URL

	// 2. Generate Payload
	price := 0.50
	quality := 0.95
	payload, err := client.GenerateOraclePayload(price, quality)
	if err != nil {
		t.Fatalf("Failed to generate payload: %v", err)
	}

	// 3. Verify Structure
	if payload.Data.Price != price {
		t.Errorf("Expected price %f, got %f", price, payload.Data.Price)
	}
	if payload.Data.Quality != quality {
		t.Errorf("Expected quality %f, got %f", quality, payload.Data.Quality)
	}

	// 4. Verify Signature
	// Reconstruct the message hash
	dataBytes, _ := json.Marshal(payload.Data)
	hash := sha256.Sum256(dataBytes)

	// Decode signature
	sig, err := base64.StdEncoding.DecodeString(payload.Signature)
	if err != nil {
		t.Fatalf("Failed to decode signature: %v", err)
	}

	// Verify using the client's public key (OracleID)
	kp, err := keypair.ParseAddress(payload.OracleID)
	if err != nil {
		t.Fatalf("Failed to parse Oracle ID: %v", err)
	}

	if err := kp.Verify(hash[:], sig); err != nil {
		t.Errorf("Signature verification failed: %v", err)
	}
}
