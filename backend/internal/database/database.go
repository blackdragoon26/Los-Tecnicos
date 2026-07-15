package database

import (
	"fmt"
	"log"
	"los-tecnicos/backend/internal/config"
	"los-tecnicos/backend/internal/core/domain"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// Connect initializes the database connection and runs auto-migrations.
func Connect() (*gorm.DB, error) {
	var db *gorm.DB
	var err error

	// Check for DATABASE_URL first (common in PaaS like Render)
	dsn := config.GetEnv("DATABASE_URL", "")
	if dsn == "" {
		host := config.GetEnv("DB_HOST", "localhost")
		port := config.GetEnvAsInt("DB_PORT", 5432)
		user := config.GetEnv("DB_USER", "postgres")
		password := config.GetEnv("DB_PASSWORD", "password")
		dbname := config.GetEnv("DB_NAME", "los_tecnicos")

		dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=disable TimeZone=UTC", host, user, password, dbname, port)
	}

	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		if config.GetEnv("DISABLE_SQLITE_FALLBACK", "false") == "true" {
			return nil, fmt.Errorf("failed to connect to database: %w", err)
		}

		sqlitePath := config.GetEnv("SQLITE_DB_PATH", "/tmp/los_tecnicos_demo.db")
		log.Printf("Postgres unavailable (%v). Falling back to SQLite demo database at %s", err, sqlitePath)
		db, err = gorm.Open(sqlite.Open(sqlitePath), &gorm.Config{})
		if err != nil {
			return nil, fmt.Errorf("failed to connect to SQLite fallback database: %w", err)
		}
	}

	// Auto-migrate the schema
	err = db.AutoMigrate(
		&domain.User{},
		&domain.EnergyOrder{},
		&domain.IoTDevice{},
		&domain.Transaction{},
		&domain.NetworkNode{},
		&domain.DeviceQualityMetrics{},
		&domain.PricingHistory{},
		&domain.YieldRecord{},
		&domain.NodeDetail{},
		&domain.ScheduleCommand{},
		&domain.ScheduleLog{},
		&domain.EnergyMint{},
		&domain.TokenBurn{},
		&domain.LiquidityPool{},
		&domain.FlashLoan{},
		&domain.CarbonCredit{},
		&domain.DePINNode{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate database: %w", err)
	}

	DB = db
	fmt.Println("Database connection successful and schema migrated.")
	return db, nil
}
