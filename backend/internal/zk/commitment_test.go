package zk

import (
	"testing"
)

func TestPedersenCommitment(t *testing.T) {
	// 1. Setup
	val := int64(85) // 85% Battery

	// 2. Commit
	comm, err := NewPedersenCommitment(val)
	if err != nil {
		t.Fatalf("Failed to create commitment: %v", err)
	}

	// 3. Verify Structure
	if comm.Value.Int64() != val {
		t.Errorf("Expected value %d, got %d", val, comm.Value.Int64())
	}
	if comm.BlindingFactor == nil {
		t.Fatal("Blinding factor is nil")
	}
	if comm.Commitment == nil {
		t.Fatal("Commitment point is nil")
	}

	// 4. Verify String Output
	commitStr := comm.Commit()
	if commitStr == "" {
		t.Error("Commitment string is empty")
	}
	t.Logf("Commitment (Base64): %s", commitStr)

	// 5. Verify Hiding (Different blind = Different commitment)
	comm2, _ := NewPedersenCommitment(val)
	if comm.Commit() == comm2.Commit() {
		t.Error("Commitment should be randomized! Hiding property failed.")
	}

	// 6. Verify Binding (Same value + Same blind = Same commitment)
	// Reconstruct manually to test determinism given secrets
	// C = vG + rH
	vScalar, _ := ConvertIntToScalar(val)
	vG := GeneratorG.ScalarMult(vScalar, GeneratorG)
	rH := GeneratorH.ScalarMult(comm.BlindingFactor, GeneratorH)
	recalcC := GeneratorG.Add(vG, rH)

	// recalcBytes := recalcC.Encode(nil) // Unused
	if comm.Commitment.Equal(recalcC) != 1 {
		t.Error("Math verification failed: C != vG + rH")
	}
}

func TestRangeProofSimulation(t *testing.T) {
	comm, _ := NewPedersenCommitment(50)

	// Valid Proof
	proof, err := comm.GenerateRangeProof(20)
	if err != nil {
		t.Fatalf("Failed to generate proof: %v", err)
	}

	if !VerifyRangeProof(proof) {
		t.Error("Valid proof verification failed")
	}

	// Invalid logic
	_, err = comm.GenerateRangeProof(60)
	if err == nil {
		t.Error("Expected error for value < min, got nil")
	}
}
