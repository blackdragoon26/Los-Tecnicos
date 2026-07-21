package simulation

import (
	"testing"
	"time"

	"los-tecnicos/backend/internal/core/domain"
)

func TestBuildSnapshotCreatesDeterministicFiftyHomeFleet(t *testing.T) {
	now := time.Date(2026, time.July, 21, 6, 30, 0, 0, time.UTC)
	weather := Weather{TemperatureC: 34, CloudCover: 28, IsDay: true, Source: "test", ObservedAt: now}
	session := &domain.DemoSession{ID: "session-a", SpeedMode: "realtime", SpeedMultiplier: 1, CreatedAt: now, SimulatedStartAt: now}

	a := BuildSnapshot(session, now, weather)
	b := BuildSnapshot(session, now, weather)
	if len(a.Households) != HouseholdCount {
		t.Fatalf("got %d households, want %d", len(a.Households), HouseholdCount)
	}
	if a.PriceLTPerKwh != b.PriceLTPerKwh || a.TotalDemand != b.TotalDemand || a.TotalProduction != b.TotalProduction {
		t.Fatal("snapshot is not deterministic for the same inputs")
	}
	macs := make(map[string]bool, HouseholdCount)
	for _, home := range a.Households {
		if home.MACAddress == "" || macs[home.MACAddress] {
			t.Fatalf("invalid or duplicate MAC address %q", home.MACAddress)
		}
		macs[home.MACAddress] = true
		if home.Latitude == 0 || home.Longitude == 0 || home.BatteryCapacityKwh <= 0 || home.ReliabilityPct <= 0 {
			t.Fatalf("household is missing physical attributes: %+v", home)
		}
	}
	if a.Mode != "simulation" || a.Disclosure == "" || a.PriceBreakdown.BasePrice != 0.5 {
		t.Fatalf("snapshot provenance or price attribution missing: %+v", a)
	}
	if a.PriceLTPerKwh < 0.4 || a.PriceLTPerKwh > 0.65 {
		t.Fatalf("price %.4f LT/kWh is outside the intended demo operating band", a.PriceLTPerKwh)
	}
}

func TestSimulatedTimeClockModes(t *testing.T) {
	created := time.Date(2026, time.July, 21, 0, 0, 0, 0, time.UTC)
	now := created.Add(time.Minute)
	for _, tc := range []struct {
		mode       string
		multiplier float64
	}{
		{mode: "realtime", multiplier: 1},
		{mode: "10x", multiplier: 10},
		{mode: "pitch", multiplier: 120},
	} {
		session := &domain.DemoSession{CreatedAt: created, SimulatedStartAt: created, SpeedMode: tc.mode, SpeedMultiplier: tc.multiplier}
		simulated, mode, multiplier := SimulatedTime(session, now)
		want := created.Add(time.Duration(tc.multiplier) * time.Minute)
		if !simulated.Equal(want) || mode != tc.mode || multiplier != tc.multiplier {
			t.Fatalf("mode %s: got %s/%s/%.0f, want %s/%s/%.0f", tc.mode, simulated, mode, multiplier, want, tc.mode, tc.multiplier)
		}
	}
}

func TestWeatherChangesProductionAndDemand(t *testing.T) {
	now := time.Date(2026, time.July, 21, 7, 0, 0, 0, time.UTC)
	session := &domain.DemoSession{CreatedAt: now, SimulatedStartAt: now, SpeedMode: "realtime", SpeedMultiplier: 1}
	clear := BuildSnapshot(session, now, Weather{TemperatureC: 28, CloudCover: 5, IsDay: true, Source: "test"})
	cloudyHot := BuildSnapshot(session, now, Weather{TemperatureC: 40, CloudCover: 95, IsDay: true, Source: "test"})
	if clear.TotalProduction <= cloudyHot.TotalProduction {
		t.Fatalf("clear production %.2f should exceed cloudy production %.2f", clear.TotalProduction, cloudyHot.TotalProduction)
	}
	if cloudyHot.TotalDemand <= clear.TotalDemand {
		t.Fatalf("hot-weather demand %.2f should exceed mild demand %.2f", cloudyHot.TotalDemand, clear.TotalDemand)
	}
}
