package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"los-tecnicos/backend/internal/core/domain"
	"los-tecnicos/backend/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

// LinkIoTDeviceRequest is the payload from the frontend RegisterDevice page.
type LinkIoTDeviceRequest struct {
	NodeMac   string `json:"node_mac" binding:"required"`
	PublicKey string `json:"public_key" binding:"required"`
	SignedXDR string `json:"signed_xdr" binding:"required"`
}

// HandleLinkIoTDevice verifies a Freighter signature to prove wallet ownership,
// then links the physical IoT node's MAC address to that Web3 wallet.
func HandleLinkIoTDevice(c *gin.Context) {
	var req LinkIoTDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload", "details": err.Error()})
		return
	}

	log.Printf("[DEPIN] Attempting to cryptographically link node %s to wallet %s", req.NodeMac, req.PublicKey)

	// 1. Decode the XDR transaction envelope provided by Freighter
	var envelope xdr.TransactionEnvelope
	err := xdr.SafeUnmarshalBase64(req.SignedXDR, &envelope)
	if err != nil {
		log.Printf("XDR Decode error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to decode signed XDR"})
		return
	}

	// 2. Parse the generic transaction format
	genericTx, err := txnbuild.TransactionFromXDR(req.SignedXDR)
	if err != nil {
		log.Printf("Txn Parse error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid transaction structure"})
		return
	}

	// Make sure it's a standard Transaction (not FeeBump)
	tx, ok := genericTx.Transaction()
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fee bump transactions not supported for auth"})
		return
	}

	// 3. Verify the Challenge Payload (Memo)
	expectedMemo := fmt.Sprintf("LINK:%s", req.NodeMac)
	// Truncate to 28 bytes per Stellar Memo.text limits
	if len(expectedMemo) > 28 {
		expectedMemo = expectedMemo[:28]
	}

	txMemo, ok := tx.Memo().(txnbuild.MemoText)
	if !ok || string(txMemo) != expectedMemo {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":         "invalid challenge payload",
			"expected_memo": expectedMemo,
		})
		return
	}

	// 4. Verify Cryptographic Signature
	// Get the hash of the transaction to verify against
	txHash, err := tx.Hash(network.TestNetworkPassphrase)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash transaction"})
		return
	}

	// Extract the signature from the envelope
	signatures := envelope.Signatures()
	if len(signatures) == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "no signatures found in transaction"})
		return
	}

	// Verify the signature against the provided public key
	kp, err := keypair.ParseAddress(req.PublicKey)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid public key format"})
		return
	}

	err = kp.Verify(txHash[:], signatures[0].Signature)
	if err != nil {
		log.Printf("[DEPIN] ❌ Signature verification failed for %s", req.PublicKey)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "cryptographic signature verification failed"})
		return
	}

	log.Printf("[DEPIN] ✅ Ed25519 signature verified for %s", req.PublicKey)

	// 5. Link the Node in PostgreSQL
	// First, check if a DePIN Node record exists. If not, create one.
	var depinNode domain.DePINNode
	res := database.DB.Where("device_id = ?", req.NodeMac).First(&depinNode)

	if res.Error != nil {
		// New node mapping
		depinNode = domain.DePINNode{
			DeviceID:       req.NodeMac,
			OperatorWallet: req.PublicKey,
			HardwareType:   "esp32",
			RegisteredAt:   time.Now(),
		}
		database.DB.Create(&depinNode)
	} else {
		// Update existing node
		depinNode.OperatorWallet = req.PublicKey
		database.DB.Save(&depinNode)
	}

	// 6. Sync with IoTDevice table so it shows up in the dashboard's "Linked Devices"
	var iotDevice domain.IoTDevice
	if err := database.DB.Where("id = ?", req.NodeMac).First(&iotDevice).Error; err != nil {
		// Auto-create IoTDevice entry for this virtual node
		iotDevice = domain.IoTDevice{
			ID:         req.NodeMac,
			OwnerID:    req.PublicKey,
			DeviceType: "raspi-node",
			Status:     "online",
			LastPing:   time.Now(),
			Source:     "virtual_link",
		}
		database.DB.Create(&iotDevice)
	} else {
		// Update owner and link status
		iotDevice.OwnerID = req.PublicKey
		iotDevice.Status = "online"
		database.DB.Save(&iotDevice)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Node securely linked to Web3 wallet",
		"node":    depinNode.DeviceID,
		"wallet":  depinNode.OperatorWallet,
	})
}
