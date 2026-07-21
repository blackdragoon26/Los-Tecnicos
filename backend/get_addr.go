package main

import (
	"fmt"
	"os"

	"github.com/stellar/go/keypair"
)

func main() {
	secret := os.Getenv("STELLAR_SECRET_KEY")
	if secret == "" {
		fmt.Fprintln(os.Stderr, "STELLAR_SECRET_KEY is required")
		os.Exit(1)
	}

	kp, err := keypair.ParseFull(secret)
	if err != nil {
		fmt.Fprintln(os.Stderr, "invalid STELLAR_SECRET_KEY:", err)
		os.Exit(1)
	}
	fmt.Println(kp.Address())
}
