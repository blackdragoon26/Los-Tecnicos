package main\nimport ("fmt"; "github.com/stellar/go/keypair")\nfunc main() { kp, _ := keypair.ParseFull("SAVB5SJ4KVCJCU3T27LYSUCCYYTAL3TK4YGYHF4TAFCZXAFD4TIBPYCY"); fmt.Println(kp.Address()) }
