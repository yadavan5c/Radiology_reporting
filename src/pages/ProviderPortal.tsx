import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  MODALITIES, Modality, STUDY_TYPES_BY_MODALITY, URGENCIES, Urgency,
  URGENCY_TAT_MINUTES, URGENCY_LABEL, URGENCY_DISPLAY_OPTIONS, URGENCY_FROM_LABEL,
} from "@/lib/constants";

const URGENCY_COLOR: Record<string, string> = {
  Stat: "bg-destructive/15 text-destructive border-destructive/30",
  Urgent: "bg-warning/15 text-warning border-warning/30",
  Routine: "bg-info/15 text-info border-info/30",
};

type RecentCase = {
  id: string;
  case_number: string;
  patient_name: string;
  modality: string;
  study_type: string;
  urgency: string;
  activated_at: string;
};

type BulkRow = {
  patient_name: string;
  patient_id: string;
  modality: Modality | "";
  study_type: string;
  urgency: Urgency;
  notes: string;
};

const blankBulkRow = (): BulkRow => ({
  patient_name: "", patient_id: "", modality: "", study_type: "", urgency: "Routine", notes: "",
});

export default function ProviderPortal() {
  // Single-case form
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [modality, setModality] = useState<Modality | "">("");
  const [studyType, setStudyType] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("Routine");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<RecentCase[]>([]);

  // Bulk
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([blankBulkRow(), blankBulkRow(), blankBulkRow()]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const fetchRecent = async () => {
    const { data } = await supabase
      .from("cases")
      .select("id, case_number, patient_name, modality, study_type, urgency, activated_at")
      .order("activated_at", { ascending: false })
      .limit(5);
    setRecent((data ?? []) as RecentCase[]);
  };

  useEffect(() => {
    fetchRecent();
    const channel = supabase
      .channel("provider-cases")
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, fetchRecent)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const studyOptions = modality ? STUDY_TYPES_BY_MODALITY[modality] : [];

  const reset = () => {
    setPatientName(""); setPatientId(""); setModality(""); setStudyType("");
    setUrgency("Routine"); setNotes("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !patientId || !modality || !studyType) {
      toast.error("Please fill in all required fields"); return;
    }
    setSubmitting(true);
    const tatMs = URGENCY_TAT_MINUTES[urgency] * 60 * 1000;
    const { error } = await supabase.from("cases").insert({
      patient_name: patientName, patient_id: patientId, modality, study_type: studyType,
      urgency, notes: notes || null, status: "pending",
      tat_deadline: new Date(Date.now() + tatMs).toISOString(),
    });
    setSubmitting(false);
    if (error) { toast.error("Failed to activate case", { description: error.message }); return; }
    toast.success("Case activated", { description: `${modality} • ${studyType}` });
    reset();
  };

  // Bulk handlers
  const updateBulk = (idx: number, patch: Partial<BulkRow>) => {
    setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addBulkRow = () => setBulkRows((r) => [...r, blankBulkRow()]);
  const removeBulkRow = (idx: number) => setBulkRows((r) => r.filter((_, i) => i !== idx));

  const submitBulk = async () => {
    const valid = bulkRows.filter((r) => r.patient_name && r.patient_id && r.modality && r.study_type);
    if (valid.length === 0) { toast.error("Add at least one complete row"); return; }
    setBulkSubmitting(true);
    const inserts = valid.map((r) => ({
      patient_name: r.patient_name,
      patient_id: r.patient_id,
      modality: r.modality as Modality,
      study_type: r.study_type,
      urgency: r.urgency,
      notes: r.notes || null,
      status: "pending" as const,
      tat_deadline: new Date(Date.now() + URGENCY_TAT_MINUTES[r.urgency] * 60_000).toISOString(),
    }));
    const { error } = await supabase.from("cases").insert(inserts);
    setBulkSubmitting(false);
    if (error) { toast.error("Bulk activation failed", { description: error.message }); return; }
    toast.success(`Activated ${valid.length} cases`);
    setBulkRows([blankBulkRow(), blankBulkRow(), blankBulkRow()]);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Provider Portal</h1>
        <p className="text-sm text-muted-foreground">Activate one or many radiology cases</p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single Case</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Activation</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader><CardTitle className="text-base">New Case</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pname">Patient Name *</Label>
                    <Input id="pname" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pid">Patient ID *</Label>
                    <Input id="pid" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="MRN-12345" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modality *</Label>
                    <Select value={modality} onValueChange={(v) => { setModality(v as Modality); setStudyType(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select modality" /></SelectTrigger>
                      <SelectContent>
                        {MODALITIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Study Type *</Label>
                    <Select value={studyType} onValueChange={setStudyType} disabled={!modality}>
                      <SelectTrigger><SelectValue placeholder={modality ? "Select study" : "Pick modality first"} /></SelectTrigger>
                      <SelectContent>
                        {studyOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Urgency Level</Label>
                  <RadioGroup
                    value={urgency}
                    onValueChange={(v) => setUrgency(v as Urgency)}
                    className="grid grid-cols-3 gap-2"
                  >
                    {URGENCIES.map((u) => (
                      <label
                        key={u}
                        htmlFor={`u-${u}`}
                        className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                          urgency === u ? URGENCY_COLOR[u] + " border" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <RadioGroupItem id={`u-${u}`} value={u} className="sr-only" />
                        <span className="font-medium text-sm">{URGENCY_LABEL[u]}</span>
                        <span className="text-[10px] text-muted-foreground">{URGENCY_TAT_MINUTES[u]}m</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Clinical Notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical history…" rows={4} />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>{submitting ? "Activating…" : "Activate Case"}</Button>
                  <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Bulk Case Activation</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addBulkRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add Row</Button>
                <Button size="sm" onClick={submitBulk} disabled={bulkSubmitting}>
                  {bulkSubmitting ? "Submitting…" : `Activate All (${bulkRows.filter((r) => r.patient_name && r.patient_id && r.modality && r.study_type).length})`}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[140px]">Patient Name</TableHead>
                      <TableHead className="min-w-[120px]">Patient ID</TableHead>
                      <TableHead className="min-w-[120px]">Modality</TableHead>
                      <TableHead className="min-w-[120px]">Study</TableHead>
                      <TableHead className="min-w-[100px]">Urgency</TableHead>
                      <TableHead className="min-w-[160px]">Notes</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkRows.map((row, idx) => {
                      const studies = row.modality ? STUDY_TYPES_BY_MODALITY[row.modality] : [];
                      return (
                        <TableRow key={idx}>
                          <TableCell><Input value={row.patient_name} onChange={(e) => updateBulk(idx, { patient_name: e.target.value })} placeholder="Name" className="h-8" /></TableCell>
                          <TableCell><Input value={row.patient_id} onChange={(e) => updateBulk(idx, { patient_id: e.target.value })} placeholder="MRN" className="h-8" /></TableCell>
                          <TableCell>
                            <Select value={row.modality} onValueChange={(v) => updateBulk(idx, { modality: v as Modality, study_type: "" })}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {MODALITIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={row.study_type} onValueChange={(v) => updateBulk(idx, { study_type: v })} disabled={!row.modality}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {studies.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={row.urgency} onValueChange={(v) => updateBulk(idx, { urgency: v as Urgency })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {URGENCY_DISPLAY_OPTIONS.map((label) => (
                                  <SelectItem key={label} value={URGENCY_FROM_LABEL[label]}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell><Input value={row.notes} onChange={(e) => updateBulk(idx, { notes: e.target.value })} placeholder="Optional" className="h-8" /></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeBulkRow(idx)} disabled={bulkRows.length === 1}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Only rows with Patient Name, ID, Modality and Study will be submitted.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="text-base">Recently Activated</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Case #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Study</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Activated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No cases yet</TableCell></TableRow>
                ) : (
                  recent.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.case_number}</TableCell>
                      <TableCell>{c.patient_name}</TableCell>
                      <TableCell>{c.modality} · {c.study_type}</TableCell>
                      <TableCell>
                        <Badge className={URGENCY_COLOR[c.urgency] + " border"}>
                          {URGENCY_LABEL[c.urgency as keyof typeof URGENCY_LABEL] ?? c.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(c.activated_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
