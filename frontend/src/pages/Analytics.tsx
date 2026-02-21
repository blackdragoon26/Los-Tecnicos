import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["hsl(75,38%,42%)", "hsl(75,30%,55%)", "hsl(220,8%,45%)", "hsl(0,50%,50%)"];

export default function Analytics() {
  const { data: dashboardData } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: () => analyticsApi.getDashboard().catch(() => ({})),
    refetchInterval: 30000,
  });

  const stats = (dashboardData as any)?.data ?? dashboardData;

  const volumeData = [
    { day: "Mon", volume: 120 },
    { day: "Tue", volume: 180 },
    { day: "Wed", volume: 95 },
    { day: "Thu", volume: 240 },
    { day: "Fri", volume: 310 },
    { day: "Sat", volume: 175 },
    { day: "Sun", volume: 200 },
  ];

  const distributionData = [
    { name: "Solar", value: 45 },
    { name: "Wind", value: 30 },
    { name: "Hydro", value: 15 },
    { name: "Other", value: 10 },
  ];

  const statCards = [
    { label: "Nodes", value: stats?.total_network_nodes ?? "—" },
    { label: "Traded", value: stats?.total_energy_traded ? `${stats.total_energy_traded} kWh` : "—" },
    { label: "Txns", value: stats?.active_orders ?? "—" },
    { label: "Users", value: stats?.total_users ?? "—" },
  ];

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <h1 className="text-xl font-bold text-foreground tracking-tight mb-1">Analytics</h1>
        <p className="text-xs text-muted-foreground mb-6">Network performance at a glance.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                <p className="text-xl font-bold text-foreground font-mono tracking-tight">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs">Volume (kWh)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,8%,28%)" />
                  <XAxis dataKey="day" tick={{ fill: "hsl(220,6%,55%)", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "hsl(220,6%,55%)", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(220,10%,22%)", border: "1px solid hsl(220,8%,28%)", borderRadius: 4, color: "hsl(60,6%,90%)", fontSize: 11 }} />
                  <Bar dataKey="volume" fill="hsl(75,38%,42%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs">Distribution</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={distributionData} innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {distributionData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(220,10%,22%)", border: "1px solid hsl(220,8%,28%)", borderRadius: 4, color: "hsl(60,6%,90%)", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
