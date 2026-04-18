import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Activity, UserCheck, CheckCircle2, Search, Database, Flame, ArrowDownUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import { MODALITIES, URGENCY_DISPLAY_OPTIONS, URGENCY_FROM_LABEL, URGENCY_LABEL } from "@/lib/constants";
import { priorityScore, seedDemoData } from "@/lib/seedEngine";
import { toast } from "sonner";

type CaseRow = {
  id: string;
  case_number: string;
  patient_name: string;
  patient_id: string;
  modality: string;
  study_type: string;
  urgency: string;
  status: string;
  activated_at: string;
  tat_deadline: string;
  completed_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  radiologists?: { name: string } | null;
};

type Rad = { id: string; name: string; is_active: boolean };

const URGENCY_VARIANT: Record<string, string> = {
  Stat: "bg-destructive/15 text-destructive border-destructive/30",
  Urgent: "bg-warning/15 text-warning border-warning/30",
  Routine: "bg-info/15 text-info border-info/30",
};

const STATUS_VARIANT: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  assigned: "bg-info/15 text-info border-info/30",
  in_progress: "bg-warning/15 text-warning border-warning/30",
  completed: "bg-success/15 text-success border-success/30",
};

const CHART_COLORS = [
  "hsl(199 89% 48%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)",
  "hsl(280 70% 60%)", "hsl(340 75% 55%)", "hsl(180 60% 50%)",
];

function Countdown({ deadline, status }: { deadline: string; status: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (status === "completed") return <span className="text-success text-xs">Done</span>;

  const diff = new Date(deadline).getTime() - now;
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const secs = Math.floor((abs % 60000) / 1000);
  const text = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const cls = overdue
    ? "text-destructive font-bold"
    : diff < 5 * 60 * 1000
      ? "text-warning font-semibold"
      : "text-foreground";
  return (
    <span className={cls + " font-mono text-xs tabular-nums"}>
      {overdue ? "-" : ""}{text}
    </span>
  );
}

export default function OpsCommandCenter() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [rads, setRads] = useState<Rad[]>([]);
  const [search, setSearch] = useState("");
  const [modalityFilter, setModalityFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [radFilter, setRadFilter] = useState<string>("all"); // "all" | "active" | "inactive"
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [breachOnly, setBreachOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"recent" | "priority">("priority");
  const [selected, setSelected] = useState<CaseRow | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [, setTick] = useState(0);

  // Manual radiologist load entries (local-only, for ad-hoc tracking)
  type ManualLoad = { id: string; name: string; load: number };
  const [manualLoads, setManualLoads] = useState<ManualLoad[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualCount, setManualCount] = useState("");

  const fetchAll = async () => {
    const [{ data: caseData }, { data: radData }] = await Promise.all([
      supabase.from("cases").select("*, radiologists(name)").order("activated_at", { ascending: false }),
      supabase.from("radiologists").select("id, name, is_active").order("name"),
    ]);
    setCases((caseData ?? []) as CaseRow[]);
    setRads((radData ?? []) as Rad[]);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("ops-cases")
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "radiologists" }, fetchAll)
      .subscribe();
    
    // Auto-run the flow engine every 3 seconds for demo purposes
    const engineInterval = setInterval(async () => {
      await supabase.rpc('run_radiology_flow_engine');
    }, 3000);

    const tickId = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(engineInterval);
      clearInterval(tickId);
    };
  }, []);

  const now = Date.now();
  const totalPool = cases.filter((c) => c.status === "pending" || c.status === "assigned").length;
  const slaAtRisk = cases.filter(
    (c) => c.status !== "completed" && new Date(c.tat_deadline).getTime() - now > 0 && new Date(c.tat_deadline).getTime() - now < 5 * 60 * 1000,
  ).length;
  const slaBreached = cases.filter(
    (c) => c.status !== "completed" && new Date(c.tat_deadline).getTime() - now <= 0,
  ).length;
  const activeRads = rads.filter((r) => r.is_active).length;
  const completedToday = cases.filter((c) => {
    if (c.status !== "completed" || !c.completed_at) return false;
    const d = new Date(c.completed_at);
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }).length;

  const studyData = useMemo(() => {
    const map = new Map<string, number>();
    cases.filter(c => c.status !== "completed").forEach((c) => map.set(c.study_type, (map.get(c.study_type) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [cases]);

  const modalityData = useMemo(() => {
    const map = new Map<string, number>();
    cases.filter(c => c.status !== "completed").forEach((c) => map.set(c.modality, (map.get(c.modality) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [cases]);

  // Radiologist load (active, non-completed)
  const loadByRad = useMemo(() => {
    const active = new Map<string, number>();
    const finished = new Map<string, number>();
    cases.forEach((c) => {
      if (c.assigned_to) {
        if (c.status === "completed") {
          finished.set(c.assigned_to, (finished.get(c.assigned_to) ?? 0) + 1);
        } else {
          active.set(c.assigned_to, (active.get(c.assigned_to) ?? 0) + 1);
        }
      }
    });
    return { active, finished };
  }, [cases]);

  const filtered = useMemo(() => {
    const activeIds = new Set(rads.filter((r) => r.is_active).map((r) => r.id));
    let list = cases.filter((c) => {
      if (modalityFilter !== "all" && c.modality !== modalityFilter) return false;
      if (urgencyFilter !== "all" && c.urgency !== urgencyFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (radFilter === "active" && !(c.assigned_to && activeIds.has(c.assigned_to))) return false;
      if (radFilter === "inactive" && !(c.assigned_to && !activeIds.has(c.assigned_to))) return false;
      if (breachOnly && !(c.status !== "completed" && new Date(c.tat_deadline).getTime() <= Date.now())) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.case_number.toLowerCase().includes(q) &&
          !c.patient_name.toLowerCase().includes(q) &&
          !c.study_type.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
    if (sortMode === "priority") {
      list = [...list].sort((a, b) => priorityScore(a) - priorityScore(b));
    }
    return list;
  }, [cases, rads, modalityFilter, urgencyFilter, radFilter, breachOnly, search, sortMode]);

  const handleSeed = async () => {
    if (!confirm("This will WIPE all existing cases, radiologists, and eligibility, then insert 200 demo cases + 30 radiologists. Continue?")) return;
    setSeeding(true);
    try {
      const result = await seedDemoData((msg) => toast.message(msg));
      toast.success(`Seeded ${result.cases} cases + ${result.radiologists} rads`);
    } catch (e: any) {
      toast.error("Seed failed", { description: e?.message });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RAD Flow <span className="text-primary">Command Center</span></h1>
          <p className="text-sm text-muted-foreground">Real-time intelligent monitoring</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
          <Database className="h-4 w-4 mr-2" />
          {seeding ? "Seeding…" : "Seed Demo Data"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total in Pool" value={totalPool} icon={<Activity className="h-4 w-4" />} tone="info" />
        <KpiCard label="SLA at Risk" value={slaAtRisk} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
        <KpiCard label="SLA Breached" value={slaBreached} icon={<Flame className="h-4 w-4" />} tone="destructive" />
        <KpiCard label="Active Radiologists" value={activeRads} icon={<UserCheck className="h-4 w-4" />} tone="success" />
        <KpiCard label="Completed Today" value={completedToday} icon={<CheckCircle2 className="h-4 w-4" />} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Volume by Study</CardTitle></CardHeader>
          <CardContent className="h-72">
            {studyData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studyData} margin={{ top: 18, right: 8, left: 0, bottom: 4 }}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="value" position="top" fill="hsl(var(--foreground))" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Modality Mix</CardTitle></CardHeader>
          <CardContent className="h-72">
            {modalityData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modalityData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} label={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 500 }} isAnimationActive={false}>
                    {modalityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any, n: any) => [`${v} cases`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Live Case Monitor</CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-44"
                />
              </div>
              <Select value={modalityFilter} onValueChange={setModalityFilter}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Modality" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modalities</SelectItem>
                  {MODALITIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="w-24"><SelectValue placeholder="Urgency" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Urgency</SelectItem>
                  {URGENCY_DISPLAY_OPTIONS.map((label) => (
                    <SelectItem key={label} value={URGENCY_FROM_LABEL[label]}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={radFilter} onValueChange={setRadFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Radiologist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Radiologists</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={breachOnly ? "destructive" : "outline"}
                size="sm"
                onClick={() => setBreachOnly((v) => !v)}
              >
                <Flame className="h-3.5 w-3.5 mr-1" /> Breached
              </Button>
              <Button
                variant={sortMode === "priority" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortMode((m) => (m === "priority" ? "recent" : "priority"))}
              >
                <ArrowDownUp className="h-3.5 w-3.5 mr-1" />
                {sortMode === "priority" ? "Priority" : "Recent"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Case #</TableHead>
                    <TableHead>Study</TableHead>
                    <TableHead>Modality</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead>Assigned To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No cases match your filters</TableCell></TableRow>
                  ) : (
                    filtered.slice(0, 100).map((c) => {
                      const breached = c.status !== "completed" && new Date(c.tat_deadline).getTime() <= Date.now();
                      return (
                        <TableRow
                          key={c.id}
                          onClick={() => setSelected(c)}
                          className={`cursor-pointer ${breached ? "bg-destructive/10 animate-pulse" : ""}`}
                        >
                          <TableCell className="font-mono text-xs">{c.case_number}</TableCell>
                          <TableCell>{c.study_type}</TableCell>
                          <TableCell><Badge variant="outline" className="font-normal">{c.modality}</Badge></TableCell>
                          <TableCell><Badge className={URGENCY_VARIANT[c.urgency] + " border"}>{URGENCY_LABEL[c.urgency as keyof typeof URGENCY_LABEL] ?? c.urgency}</Badge></TableCell>
                          <TableCell><Badge className={STATUS_VARIANT[c.status] + " border capitalize"}>{c.status.replace("_", " ")}</Badge></TableCell>
                          <TableCell><Countdown deadline={c.tat_deadline} status={c.status} /></TableCell>
                          <TableCell className="text-sm">{c.radiologists?.name ?? <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {filtered.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2">Showing first 100 of {filtered.length}. Use filters to narrow down.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Radiologist Load</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-auto">
            {/* Manual entry */}
            <div className="space-y-2 pb-3 border-b border-border">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Add manual entry</p>
              <div className="flex gap-1.5">
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Name"
                  className="h-8 text-xs"
                />
                <Input
                  value={manualCount}
                  onChange={(e) => setManualCount(e.target.value)}
                  placeholder="Load"
                  type="number"
                  min={0}
                  className="h-8 text-xs w-20"
                />
                <Button
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    const n = manualName.trim();
                    const c = parseInt(manualCount, 10);
                    if (!n || isNaN(c) || c < 0) {
                      toast.error("Enter a name and a non-negative load");
                      return;
                    }
                    setManualLoads((prev) => [
                      ...prev,
                      { id: `manual-${Date.now()}`, name: n, load: c },
                    ]);
                    setManualName("");
                    setManualCount("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            {(() => {
              const live = rads
                .filter((r) => r.is_active)
                .map((r) => {
                  const active = loadByRad.active.get(r.id) ?? 0;
                  const finished = loadByRad.finished.get(r.id) ?? 0;
                  return { id: r.id, name: r.name, active, finished, total: active + finished, manual: false };
                });
              const merged = [
                ...live,
                ...manualLoads.map((m) => ({ ...m, active: m.load, finished: 0, total: m.load, manual: true })),
              ].sort((a, b) => b.total - a.total);
              if (merged.length === 0) {
                return <p className="text-xs text-muted-foreground">No active radiologists</p>;
              }
              return merged.map((r) => {
                const activePct = Math.min(100, (r.active / 15) * 100);
                const finishedPct = Math.min(100, (r.finished / 15) * 100);
                const activeTone = r.active >= 12 ? "bg-destructive" : r.active >= 7 ? "bg-warning" : "bg-info";
                
                return (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] gap-2 mb-0.5">
                      <span className="truncate font-medium flex items-center gap-1">
                        {r.name}
                        {r.manual && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">manual</Badge>}
                      </span>
                      <span className="text-muted-foreground">
                        {r.active} act / {r.finished} fin
                      </span>
                    </div>
                    <div className="h-4 rounded-md bg-muted overflow-hidden flex">
                      {r.active > 0 && (
                        <div 
                          className={`h-full ${activeTone} transition-all flex items-center justify-center border-r border-background/20`} 
                          style={{ width: `${Math.max(activePct, 8)}%` }}
                        >
                          <span className="font-mono text-[9px] text-white font-bold">{r.active}</span>
                        </div>
                      )}
                      {r.finished > 0 && (
                        <div 
                          className="h-full bg-success transition-all flex items-center justify-center" 
                          style={{ width: `${Math.max(finishedPct, 8)}%` }}
                        >
                          <span className="font-mono text-[9px] text-white font-bold">{r.finished}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-sm">{selected.case_number}</span>
                  <Badge className={URGENCY_VARIANT[selected.urgency] + " border"}>
                    {URGENCY_LABEL[selected.urgency as keyof typeof URGENCY_LABEL] ?? selected.urgency}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selected.modality} · {selected.study_type}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <Row label="Patient">{selected.patient_name} ({selected.patient_id})</Row>
                <Row label="Status"><Badge className={STATUS_VARIANT[selected.status] + " border capitalize"}>{selected.status.replace("_", " ")}</Badge></Row>
                <Row label="Activated">{new Date(selected.activated_at).toLocaleString()}</Row>
                <Row label="SLA Deadline">{new Date(selected.tat_deadline).toLocaleString()} <Countdown deadline={selected.tat_deadline} status={selected.status} /></Row>
                <Row label="Assigned">{selected.radiologists?.name ?? "Unassigned"}</Row>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Clinical Notes</p>
                  <p className="rounded-md border border-border bg-muted/30 p-3 text-sm">{selected.notes ?? "No notes provided"}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 items-center">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "info" | "destructive" | "success" | "primary" | "warning" }) {
  const toneClass = {
    info: "text-info bg-info/10",
    destructive: "text-destructive bg-destructive/10",
    success: "text-success bg-success/10",
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
  }[tone];
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
          </div>
          <div className={"rounded-md p-2 " + toneClass}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      No data — click <span className="font-medium mx-1">Seed Demo Data</span> to populate
    </div>
  );
}
