import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList,
} from "recharts";
import { toast } from "sonner";
import { ALL_STUDY_TYPES } from "@/lib/constants";
import { Trash2, X } from "lucide-react";

type Radiologist = {
  id: string;
  name: string;
  employee_id: string;
  is_active: boolean;
};

type Eligibility = { id: string; radiologist_id: string; study_type: string };
type CaseLite = { assigned_to: string | null; status: string };

export default function RadiologistManagement() {
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [selectedStudies, setSelectedStudies] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [radiologists, setRadiologists] = useState<Radiologist[]>([]);
  const [eligibility, setEligibility] = useState<Eligibility[]>([]);
  const [cases, setCases] = useState<CaseLite[]>([]);

  const fetchAll = async () => {
    const [{ data: rads }, { data: elig }, { data: cs }] = await Promise.all([
      supabase.from("radiologists").select("*").order("name"),
      supabase.from("radiologist_eligibility").select("*"),
      supabase.from("cases").select("assigned_to, status"),
    ]);
    setRadiologists((rads ?? []) as Radiologist[]);
    setEligibility((elig ?? []) as Eligibility[]);
    setCases((cs ?? []) as CaseLite[]);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("radiologist-mgmt")
      .on("postgres_changes", { event: "*", schema: "public", table: "radiologists" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "radiologist_eligibility" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const eligibilityByRad = useMemo(() => {
    const m = new Map<string, string[]>();
    eligibility.forEach((e) => {
      m.set(e.radiologist_id, [...(m.get(e.radiologist_id) ?? []), e.study_type]);
    });
    return m;
  }, [eligibility]);

  const loadByRad = useMemo(() => {
    const m = new Map<string, number>();
    cases.forEach((c) => {
      if (c.assigned_to && c.status !== "completed") {
        m.set(c.assigned_to, (m.get(c.assigned_to) ?? 0) + 1);
      }
    });
    return m;
  }, [cases]);

  // Completed cases per radiologist (only assigned + completed)
  const completedData = useMemo(() => {
    const counts = new Map<string, number>();
    cases.forEach((c) => {
      if (c.status === "completed" && c.assigned_to) {
        counts.set(c.assigned_to, (counts.get(c.assigned_to) ?? 0) + 1);
      }
    });
    return radiologists
      .map((r) => ({ name: r.name.replace(/^Dr\.\s*/, ""), value: counts.get(r.id) ?? 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [cases, radiologists]);

  const toggleStudy = (s: string) => {
    setSelectedStudies((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const reset = () => { setName(""); setEmployeeId(""); setSelectedStudies([]); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !employeeId) { toast.error("Name and Employee ID are required"); return; }
    setSubmitting(true);
    const { data: rad, error } = await supabase
      .from("radiologists")
      .insert({ name, employee_id: employeeId, is_active: true })
      .select()
      .single();
    if (error || !rad) {
      setSubmitting(false);
      toast.error("Failed to create radiologist", { description: error?.message }); return;
    }
    if (selectedStudies.length > 0) {
      const rows = selectedStudies.map((s) => ({ radiologist_id: rad.id, study_type: s }));
      await supabase.from("radiologist_eligibility").insert(rows);
    }
    setSubmitting(false);
    toast.success("Radiologist added"); reset();
  };

  const toggleActive = async (rad: Radiologist) => {
    const { error } = await supabase.from("radiologists").update({ is_active: !rad.is_active }).eq("id", rad.id);
    if (error) toast.error("Failed to update");
  };

  const removeRad = async (rad: Radiologist) => {
    if (!confirm(`Remove ${rad.name}?`)) return;
    const { error } = await supabase.from("radiologists").delete().eq("id", rad.id);
    if (error) toast.error("Failed to delete", { description: error.message });
    else toast.success("Removed");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Radiologist Management</h1>
        <p className="text-sm text-muted-foreground">Eligibility, status, and current load</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Eligible Studies Coverage</CardTitle></CardHeader>
        <CardContent>
          {/* Per-radiologist eligible studies breakdown */}
          {radiologists.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Eligible studies per radiologist</p>
              <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
                {radiologists
                  .filter((r) => r.is_active)
                  .map((r) => {
                    const studies = eligibilityByRad.get(r.id) ?? [];
                    return (
                      <div key={r.id} className="flex items-start gap-2 text-xs">
                        <span className="font-medium min-w-[160px] truncate">{r.name}</span>
                        <div className="flex flex-wrap gap-1 flex-1">
                          {studies.length === 0 ? (
                            <span className="text-muted-foreground italic">None</span>
                          ) : (
                            studies.map((s) => (
                              <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Completed Cases by Radiologist</CardTitle></CardHeader>
        <CardContent className="h-72">
          {completedData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No completed cases yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completedData} margin={{ top: 18, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-35} textAnchor="end" height={70} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any) => [`${v} cases`, "Completed"]}
                />
                <Bar dataKey="value" fill="hsl(var(--success))" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fill="hsl(var(--foreground))" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Radiologist</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rname">Name *</Label>
                <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reid">Employee ID *</Label>
                <Input id="reid" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-001" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Eligible Studies</Label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-md border border-border bg-muted/20 min-h-[3rem]">
                {ALL_STUDY_TYPES.map((s) => {
                  const selected = selectedStudies.includes(s);
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleStudy(s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      {s}{selected && <X className="inline-block ml-1 h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
              {selectedStudies.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedStudies.length} selected</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Add Radiologist"}</Button>
              <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Roster</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Eligible Studies</TableHead>
                  <TableHead>Current Load</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {radiologists.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No radiologists yet</TableCell></TableRow>
                ) : (
                  radiologists.map((r) => {
                    const studies = eligibilityByRad.get(r.id) ?? [];
                    const load = loadByRad.get(r.id) ?? 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{r.employee_id}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {studies.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">None</span>
                            ) : (
                              studies.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={load >= 12 ? "border-destructive/40 text-destructive" : load >= 7 ? "border-warning/40 text-warning" : "border-border"}>
                            {load} {load === 1 ? "case" : "cases"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                            <span className="text-xs text-muted-foreground">{r.is_active ? "Active" : "Inactive"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeRad(r)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
