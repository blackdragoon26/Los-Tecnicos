package simulation

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sync"
	"time"

	"los-tecnicos/backend/internal/core/domain"
)

const HouseholdCount = 50

type Weather struct {
	TemperatureC float64   `json:"temperature_c"`
	CloudCover   float64   `json:"cloud_cover_pct"`
	IsDay        bool      `json:"is_day"`
	Code         int       `json:"weather_code"`
	Source       string    `json:"source"`
	ObservedAt   time.Time `json:"observed_at"`
}

type Household struct {
	ID                 string  `json:"id"`
	Alias              string  `json:"alias"`
	MACAddress         string  `json:"mac_address"`
	Region             string  `json:"region"`
	Latitude           float64 `json:"latitude"`
	Longitude          float64 `json:"longitude"`
	SolarCapacityKw    float64 `json:"solar_capacity_kw"`
	BatteryCapacityKwh float64 `json:"battery_capacity_kwh"`
	DemandKw           float64 `json:"demand_kw"`
	ProductionKw       float64 `json:"production_kw"`
	SoC                float64 `json:"soc"`
	EfficiencyPct      float64 `json:"efficiency_pct"`
	ReliabilityPct     float64 `json:"reliability_pct"`
	State              string  `json:"state"`
}

type PriceBreakdown struct {
	BasePrice    float64 `json:"base_price"`
	SupplyDemand float64 `json:"f_sd"`
	SoC          float64 `json:"f_soc"`
	Distance     float64 `json:"f_dist"`
	Time         float64 `json:"f_time"`
	Reliability  float64 `json:"f_reliability"`
	FinalPrice   float64 `json:"final_price"`
}

type Snapshot struct {
	Mode            string         `json:"mode"`
	Disclosure      string         `json:"disclosure"`
	Region          string         `json:"region"`
	HardwareProfile string         `json:"hardware_profile"`
	SessionID       string         `json:"session_id,omitempty"`
	SpeedMode       string         `json:"speed_mode"`
	SpeedMultiplier float64        `json:"speed_multiplier"`
	SimulatedAt     time.Time      `json:"simulated_at"`
	GeneratedAt     time.Time      `json:"generated_at"`
	Weather         Weather        `json:"weather"`
	Households      []Household    `json:"households"`
	SupplyCount     int            `json:"supply_count"`
	DemandCount     int            `json:"demand_count"`
	IdleCount       int            `json:"idle_count"`
	AverageSoC      float64        `json:"average_soc"`
	TotalProduction float64        `json:"total_production_kw"`
	TotalDemand     float64        `json:"total_demand_kw"`
	ActiveTransfers int            `json:"active_transfers"`
	PriceLTPerKwh   float64        `json:"price_lt_per_kwh"`
	PriceBreakdown  PriceBreakdown `json:"price_breakdown"`
}

type TimeSeriesPoint struct {
	Timestamp    time.Time `json:"timestamp"`
	Price        float64   `json:"price_lt_per_kwh"`
	ProductionKw float64   `json:"production_kw"`
	DemandKw     float64   `json:"demand_kw"`
	AverageSoC   float64   `json:"average_soc"`
	SupplyCount  int       `json:"supply_count"`
	DemandCount  int       `json:"demand_count"`
}

type regionSeed struct {
	Name  string
	Lat   float64
	Lon   float64
	Count int
}

var regions = []regionSeed{
	{Name: "Delhi", Lat: 28.6139, Lon: 77.2090, Count: 15},
	{Name: "Noida", Lat: 28.5355, Lon: 77.3910, Count: 10},
	{Name: "Gurugram", Lat: 28.4595, Lon: 77.0266, Count: 10},
	{Name: "Ghaziabad", Lat: 28.6692, Lon: 77.4538, Count: 8},
	{Name: "Faridabad", Lat: 28.4089, Lon: 77.3178, Count: 7},
}

var publicStartedAt = time.Now().UTC()
var weatherCache struct {
	sync.Mutex
	value     Weather
	expiresAt time.Time
}

func speedForMode(mode string) float64 {
	switch mode {
	case "realtime":
		return 1
	case "10x":
		return 10
	default:
		return 120
	}
}

func SimulatedTime(session *domain.DemoSession, now time.Time) (time.Time, string, float64) {
	if session == nil {
		multiplier := 120.0
		return publicStartedAt.Add(time.Duration(float64(now.Sub(publicStartedAt)) * multiplier)), "pitch", multiplier
	}
	multiplier := speedForMode(session.SpeedMode)
	start := session.SimulatedStartAt
	if start.IsZero() {
		start = session.CreatedAt
	}
	return start.Add(time.Duration(float64(now.Sub(session.CreatedAt)) * multiplier)), session.SpeedMode, multiplier
}

func CurrentWeather() Weather {
	weatherCache.Lock()
	defer weatherCache.Unlock()
	now := time.Now().UTC()
	if now.Before(weatherCache.expiresAt) {
		return weatherCache.value
	}

	fallback := seasonalFallback(now)
	client := http.Client{Timeout: 2500 * time.Millisecond}
	url := "https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current=temperature_2m,cloud_cover,is_day,weather_code&timezone=Asia%2FKolkata"
	resp, err := client.Get(url)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var payload struct {
				Current struct {
					Temperature float64 `json:"temperature_2m"`
					CloudCover  float64 `json:"cloud_cover"`
					IsDay       int     `json:"is_day"`
					Code        int     `json:"weather_code"`
				} `json:"current"`
			}
			if json.NewDecoder(resp.Body).Decode(&payload) == nil {
				fallback = Weather{TemperatureC: payload.Current.Temperature, CloudCover: payload.Current.CloudCover, IsDay: payload.Current.IsDay == 1, Code: payload.Current.Code, Source: "Open-Meteo Delhi NCR", ObservedAt: now}
			}
		}
	}
	weatherCache.value = fallback
	weatherCache.expiresAt = now.Add(10 * time.Minute)
	return fallback
}

func seasonalFallback(at time.Time) Weather {
	month := float64(at.Month())
	temp := 27 + 10*math.Sin((month-3)*math.Pi/6)
	cloud := 24 + 20*math.Max(0, math.Sin((month-5)*math.Pi/4))
	hour := at.In(time.FixedZone("IST", 5*3600+1800)).Hour()
	return Weather{TemperatureC: round(temp, 1), CloudCover: round(cloud, 1), IsDay: hour >= 6 && hour < 19, Code: 1, Source: "Delhi seasonal fallback", ObservedAt: at.UTC()}
}

func BuildSnapshot(session *domain.DemoSession, now time.Time, weather Weather) Snapshot {
	simulatedAt, speedMode, multiplier := SimulatedTime(session, now)
	hour := float64(simulatedAt.In(time.FixedZone("IST", 5*3600+1800)).Hour()) + float64(simulatedAt.Minute())/60
	daylight := math.Max(0, math.Sin((hour-6)*math.Pi/13))
	cloudFactor := math.Max(0.18, 1-(weather.CloudCover/100)*0.72)
	households := make([]Household, 0, HouseholdCount)
	index := 0

	for _, region := range regions {
		for local := 0; local < region.Count; local++ {
			i := index
			index++
			solarCapacity := 2.2 + float64((i*17)%39)/10
			batteryCapacity := 4 + float64((i*13)%111)/10
			efficiency := 86 + float64((i*7)%91)/10
			reliability := 91 + float64((i*11)%85)/10
			production := solarCapacity * daylight * cloudFactor * (efficiency / 100)
			morningPeak := math.Exp(-math.Pow(hour-8, 2)/3.2) * 0.85
			eveningPeak := math.Exp(-math.Pow(hour-20, 2)/4.5) * 1.35
			cooling := math.Max(0, weather.TemperatureC-28) * 0.045
			demand := 0.28 + float64((i*19)%55)/100 + morningPeak + eveningPeak + cooling
			phase := math.Sin((hour + float64(i%9)) * math.Pi / 12)
			soc := clamp(53+phase*16+(production-demand)*7+float64((i*23)%180)/10-9, 12, 96)
			net := production - demand
			state := "IDLE"
			if net > 0.35 && soc > 58 {
				state = "SUPPLYING"
			} else if net < -0.35 || soc < 34 {
				state = "RECEIVING"
			}
			households = append(households, Household{
				ID: fmt.Sprintf("NCR-%02d", i+1), Alias: fmt.Sprintf("%s Home %02d", region.Name, local+1), MACAddress: macFor(i), Region: region.Name,
				Latitude: region.Lat + float64((i%5)-2)*0.006, Longitude: region.Lon + float64((i%7)-3)*0.006,
				SolarCapacityKw: round(solarCapacity, 1), BatteryCapacityKwh: round(batteryCapacity, 1), DemandKw: round(demand, 2), ProductionKw: round(production, 2),
				SoC: round(soc, 1), EfficiencyPct: round(efficiency, 1), ReliabilityPct: round(reliability, 1), State: state,
			})
		}
	}

	return summarize(session, now, simulatedAt, speedMode, multiplier, weather, households)
}

func SnapshotForSession(session *domain.DemoSession) Snapshot {
	return BuildSnapshot(session, time.Now().UTC(), CurrentWeather())
}

func TimeSeries(session *domain.DemoSession, points int) []TimeSeriesPoint {
	if points < 2 || points > 96 {
		points = 48
	}
	now := time.Now().UTC()
	weather := CurrentWeather()
	series := make([]TimeSeriesPoint, 0, points)
	for i := points - 1; i >= 0; i-- {
		at := now.Add(-time.Duration(i) * 15 * time.Second)
		s := BuildSnapshot(session, at, weather)
		series = append(series, TimeSeriesPoint{Timestamp: s.SimulatedAt, Price: s.PriceLTPerKwh, ProductionKw: s.TotalProduction, DemandKw: s.TotalDemand, AverageSoC: s.AverageSoC, SupplyCount: s.SupplyCount, DemandCount: s.DemandCount})
	}
	return series
}

func summarize(session *domain.DemoSession, now, simulatedAt time.Time, speedMode string, multiplier float64, weather Weather, households []Household) Snapshot {
	supply, demand, idle := 0, 0, 0
	totalSoC, production, load, reliability := 0.0, 0.0, 0.0, 0.0
	for _, h := range households {
		totalSoC += h.SoC
		production += h.ProductionKw
		load += h.DemandKw
		reliability += h.ReliabilityPct
		switch h.State {
		case "SUPPLYING":
			supply++
		case "RECEIVING":
			demand++
		default:
			idle++
		}
	}
	avgSoC := totalSoC / float64(len(households))
	avgReliability := reliability / float64(len(households))
	fSD := clamp(1+0.08*math.Log(float64(maxInt(demand, 1))/float64(maxInt(supply, 1))), 0.9, 1.1)
	fSoC := 1 + 0.1*math.Pow(1-avgSoC/100, 2)
	fDistance := 1 + 0.0025*8.4
	hour := simulatedAt.In(time.FixedZone("IST", 5*3600+1800)).Hour()
	fTime := 1.0
	if hour >= 18 && hour < 22 {
		fTime = 1.08
	} else if hour >= 6 && hour < 9 {
		fTime = 1.08
	} else if hour >= 2 && hour < 6 {
		fTime = 0.92
	}
	fReliability := 0.985 + avgReliability/6500
	price := 0.5 * fSD * fSoC * fDistance * fTime * fReliability
	breakdown := PriceBreakdown{BasePrice: 0.5, SupplyDemand: round(fSD, 4), SoC: round(fSoC, 4), Distance: round(fDistance, 4), Time: round(fTime, 4), Reliability: round(fReliability, 4), FinalPrice: round(price, 4)}
	sessionID := ""
	if session != nil {
		sessionID = session.ID
	}
	return Snapshot{Mode: "simulation", Disclosure: "Projected digital twin — not deployed customer data", Region: "Delhi NCR", HardwareProfile: "projected_household", SessionID: sessionID, SpeedMode: speedMode, SpeedMultiplier: multiplier, SimulatedAt: simulatedAt, GeneratedAt: now, Weather: weather, Households: households, SupplyCount: supply, DemandCount: demand, IdleCount: idle, AverageSoC: round(avgSoC, 1), TotalProduction: round(production, 2), TotalDemand: round(load, 2), ActiveTransfers: minInt(supply, demand), PriceLTPerKwh: round(price, 4), PriceBreakdown: breakdown}
}

func macFor(index int) string {
	return fmt.Sprintf("02:53:54:%02X:%02X:%02X", (index*17)%256, (index*31)%256, index)
}
func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
func round(v float64, places int) float64 { p := math.Pow10(places); return math.Round(v*p) / p }
func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
