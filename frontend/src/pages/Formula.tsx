import { useState, useEffect } from "react";
import { Sun, Cloud, CloudRain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const BASE_PRICE = 5.0;

export default function FormulaPlayground() {
  const [sunlight, setSunlight] = useState(50);
  const [weather, setWeather] = useState("sunny");
  const [gridLoad, setGridLoad] = useState(50);
  const [batteryLevel, setBatteryLevel] = useState(50);
  const [distance, setDistance] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState(12);
  const [reliability, setReliability] = useState(100);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [breakdown, setBreakdown] = useState<any>({});

  useEffect(() => {
    let weatherMod = 1.0;
    if (weather === "cloudy") weatherMod = 0.6;
    if (weather === "rainy") weatherMod = 0.3;

    const supply = (sunlight * weatherMod) || 1;
    const demand = gridLoad || 1;
    const f_sd = 1.0 + 0.2 * Math.log(demand / supply);
    const socDec = batteryLevel / 100;
    const deficit = 1.0 - socDec;
    const f_soc = 1.0 + 0.5 * (deficit * deficit);
    const f_dist = 1.0 + 0.1 * distance;

    let f_time = 1.0;
    if (timeOfDay >= 18 && timeOfDay < 22) f_time = 1.3;
    if (timeOfDay >= 6 && timeOfDay < 9) f_time = 1.15;
    if (timeOfDay >= 2 && timeOfDay < 6) f_time = 0.85;

    const f_quality = 1.0 + 0.1 * (reliability / 100);
    let totalMult = f_sd * f_soc * f_dist * f_time * f_quality;
    if (totalMult < 0.5) totalMult = 0.5;
    if (totalMult > 5.0) totalMult = 5.0;

    setCalculatedPrice(BASE_PRICE * totalMult);
    setBreakdown({ f_sd, f_soc, f_dist, f_time, f_quality, totalMult });
  }, [sunlight, weather, gridLoad, batteryLevel, distance, timeOfDay, reliability]);

  const weatherOptions = [
    { id: "sunny", icon: Sun, label: "Sunny" },
    { id: "cloudy", icon: Cloud, label: "Cloudy" },
    { id: "rainy", icon: CloudRain, label: "Rainy" },
  ];

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <h1 className="text-xl font-bold text-foreground tracking-tight mb-1">Pricing Formula</h1>
        <p className="text-xs text-muted-foreground mb-8">
          Experiment with the Stelltron Dynamic Pricing Engine.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Environment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderControl label="Sunlight" value={sunlight} setValue={setSunlight} unit="%" />
                <div>
                  <Label className="text-[10px] uppercase tracking-wider">Weather</Label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                    {weatherOptions.map((w) => (
                      <Button
                        key={w.id}
                        size="sm"
                        variant={weather === w.id ? "default" : "outline"}
                        onClick={() => setWeather(w.id)}
                        className="h-7 text-[10px] gap-1"
                      >
                        <w.icon className="w-3 h-3" />
                        {w.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Grid State</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderControl label="Demand" value={gridLoad} setValue={setGridLoad} unit="%" />
                <SliderControl label="Battery" value={batteryLevel} setValue={setBatteryLevel} unit="%" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Transaction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderControl label="Distance" value={distance} setValue={setDistance} min={0} max={20} unit="km" />
                <SliderControl label="Time" value={timeOfDay} setValue={setTimeOfDay} min={0} max={23} unit="h" />
                <SliderControl label="Reliability" value={reliability} setValue={setReliability} unit="%" />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Calculated Price</p>
                    <p className="text-4xl font-bold font-mono text-foreground tracking-tighter">{calculatedPrice.toFixed(4)}</p>
                    <p className="text-xs text-primary font-medium mt-0.5">XLM / kWh</p>
                  </div>
                  <div className="text-right space-y-1">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Base</p>
                      <p className="text-sm font-mono">{BASE_PRICE.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Mult</p>
                      <p className="text-sm font-mono">{breakdown.totalMult?.toFixed(3)}x</p>
                    </div>
                  </div>
                </div>

                <Separator className="mb-4" />

                <div className="grid grid-cols-5 gap-2">
                  <FactorStat label="S/D" value={breakdown.f_sd} />
                  <FactorStat label="SoC" value={breakdown.f_soc} />
                  <FactorStat label="Dist" value={breakdown.f_dist} />
                  <FactorStat label="Time" value={breakdown.f_time} />
                  <FactorStat label="Qual" value={breakdown.f_quality} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Formula</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-[11px] text-primary mb-3">P = Base × (F_sd × F_soc × F_dist × F_time × F_quality)</p>
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <p>• <strong className="text-foreground">S/D</strong> — Logarithmic supply/demand response</p>
                  <p>• <strong className="text-foreground">SoC</strong> — Quadratic scarcity near empty</p>
                  <p>• <strong className="text-foreground">Time</strong> — Peak hours up to 1.3x</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderControl({ label, value, setValue, min = 0, max = 100, unit }: any) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <Label className="text-[10px] uppercase tracking-wider">{label}</Label>
        <span className="text-[10px] font-mono text-muted-foreground">{value}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => setValue(v)} min={min} max={max} step={1} />
    </div>
  );
}

function FactorStat({ label, value }: { label: string; value: number }) {
  const isHigh = value > 1.05;
  const isLow = value < 0.95;

  return (
    <div className="bg-secondary rounded p-2 text-center">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-xs font-mono font-bold ${isHigh ? "text-destructive" : isLow ? "text-primary" : "text-foreground"}`}>
        {value?.toFixed(2)}x
      </p>
    </div>
  );
}
