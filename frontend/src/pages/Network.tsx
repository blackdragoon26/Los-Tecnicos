import { useState, useEffect } from "react";
import { analyticsApi, iotApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const DEVICE_ID = "rpi-4b-prod-01";

export default function NetworkPage() {
  const [stats, setStats] = useState<any>(null);
  const [nodes, setNodes] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, nodesRes] = await Promise.all([
          analyticsApi.getDashboard().catch(() => ({})),
          iotApi.getNodes(DEVICE_ID).catch(() => null),
        ]);
        setStats((dashRes as any).data ?? dashRes);
        if (nodesRes?.nodes) setNodes(nodesRes.nodes);
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const networkStats = [
    { label: "Devices", value: stats?.total_iot_devices || "0" },
    { label: "Nodes", value: stats?.total_network_nodes || "0" },
    { label: "Traded", value: stats?.total_energy_traded ? `${stats.total_energy_traded.toFixed(2)} kWh` : "0 kWh" },
  ];

  const topNodes = nodes.slice(0, 8).map((n: any) => ({
    name: n.uid,
    location: n.ip || "Local",
    voltage: n.voltage.toFixed(2),
    soc: n.soc.toFixed(1),
  }));

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container mx-auto max-w-5xl">
        <h1 className="text-xl font-bold text-foreground tracking-tight mb-1">Network</h1>
        <p className="text-xs text-muted-foreground mb-6">Global mesh overview.</p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {networkStats.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
                <p className="text-xl font-bold text-foreground font-mono tracking-tight">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">Network Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-secondary/50 rounded flex items-center justify-center relative overflow-hidden">
                <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                  <ellipse cx="400" cy="200" rx="380" ry="180" fill="none" stroke="hsl(220,8%,28%)" strokeWidth="0.5" />
                  <ellipse cx="400" cy="200" rx="250" ry="120" fill="none" stroke="hsl(220,8%,28%)" strokeWidth="0.3" />
                  {[
                    [400, 200], [150, 150], [650, 250], [300, 280], [500, 120], [250, 100], [580, 300],
                  ].map(([cx, cy], i) => (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r="3" fill="hsl(75,38%,42%)" opacity="0.8" />
                      <circle cx={cx} cy={cy} r="6" fill="none" stroke="hsl(75,38%,42%)" strokeWidth="0.3" opacity="0.4" />
                    </g>
                  ))}
                  {/* Connecting lines */}
                  <line x1="400" y1="200" x2="150" y2="150" stroke="hsl(75,38%,42%)" strokeWidth="0.3" opacity="0.2" />
                  <line x1="400" y1="200" x2="650" y2="250" stroke="hsl(75,38%,42%)" strokeWidth="0.3" opacity="0.2" />
                  <line x1="400" y1="200" x2="300" y2="280" stroke="hsl(75,38%,42%)" strokeWidth="0.3" opacity="0.2" />
                  <line x1="400" y1="200" x2="500" y2="120" stroke="hsl(75,38%,42%)" strokeWidth="0.3" opacity="0.2" />
                </svg>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs">Live Nodes</CardTitle>
              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{topNodes.length} online</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {topNodes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] h-7">Node</TableHead>
                      <TableHead className="text-[10px] h-7">V</TableHead>
                      <TableHead className="text-[10px] h-7 text-right">SoC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topNodes.map((node) => (
                      <TableRow key={node.name}>
                        <TableCell className="py-1.5">
                          <span className="text-[11px] font-medium">{node.name}</span>
                          <span className="text-[9px] text-muted-foreground block">{node.location}</span>
                        </TableCell>
                        <TableCell className="py-1.5 text-[11px] font-mono">{node.voltage}</TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Progress value={parseFloat(node.soc)} className="w-12 h-1" />
                            <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{node.soc}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No live nodes.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
