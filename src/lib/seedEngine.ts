import { supabase } from "@/integrations/supabase/client";
import {
  MODALITY_SLA_MINUTES,
  Modality,
  STUDY_TYPES_BY_MODALITY,
  SUBSPECIALTIES,
  Urgency,
} from "./constants";

// 30 named radiologists
const RAD_NAMES = [
  "Dr. Aanya Kapoor", "Dr. Bhavesh Rao", "Dr. Carmen Diaz", "Dr. Dmitri Volkov",
  "Dr. Elena Petrova", "Dr. Farah Idris", "Dr. Gabriel Costa", "Dr. Hana Sato",
  "Dr. Ingrid Larsen", "Dr. Jamal Okafor", "Dr. Kiran Mehta", "Dr. Lucia Romano",
  "Dr. Marcus Webb", "Dr. Nadia Haddad", "Dr. Owen Park", "Dr. Priya Iyer",
  "Dr. Quentin Moreau", "Dr. Rosa Alvarez", "Dr. Sven Bergman", "Dr. Tariq Aziz",
  "Dr. Uma Krishnan", "Dr. Viktor Novak", "Dr. Wendy Chen", "Dr. Xiomara Ruiz",
  "Dr. Yusuf Demir", "Dr. Zara Khan", "Dr. Arjun Nair", "Dr. Beatriz Silva",
  "Dr. Caleb Stone", "Dr. Diya Sharma",
];

// Uneven eligibility: each radiologist gets 1-3 subspecialties weighted unevenly.
// Some specialties (Neuro, Chest) get more rads; Pelvis gets fewer.
const SUBSPECIALTY_WEIGHTS: Record<string, number> = {
  Neuro: 9,
  Chest: 8,
  Spine: 6,
  MSK_Upper: 7,
  MSK_Lower: 7,
  Body: 5,
  Pelvis: 3,
};

function pickWeighted(weights: Record<string, number>, exclude: Set<string>): string | null {
  const entries = Object.entries(weights).filter(([k]) => !exclude.has(k));
  if (entries.length === 0) return null;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const FIRST_NAMES = ["John", "Jane", "Alex", "Maria", "Wei", "Aiko", "Omar", "Fatima", "Liam", "Sophia", "Noah", "Olivia", "Ravi", "Mei", "Carlos", "Anika"];
const LAST_NAMES = ["Doe", "Smith", "Lee", "Garcia", "Patel", "Kim", "Singh", "Khan", "Brown", "Wilson", "Nguyen", "Lopez", "Tanaka", "Costa", "Ali", "Mendez"];

const CLINICAL_NOTES = [
  "Suspected acute stroke — code stroke activated",
  "MVA trauma, possible C-spine injury",
  "Persistent chest pain, rule out PE",
  "Acute abdominal pain, query appendicitis",
  "Headache with photophobia, rule out SAH",
  "Post-op surveillance imaging",
  "Suspected pneumonia, productive cough",
  "Trauma fall, rule out fracture",
  "Persistent back pain, neuro deficits",
  "Pre-op planning, oncology workup",
  "Follow-up known mass, restaging",
  "Acute SOB, rule out pulmonary edema",
];

const PATIENT_AGE_SEX = () => `${randInt(18, 92)}${rand(["M", "F"])}`;

export type SeedProgress = (msg: string) => void;

export async function seedDemoData(onProgress?: SeedProgress) {
  const log = onProgress ?? (() => {});

  log("Wiping existing data…");
  await supabase.from("cases").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("radiologist_eligibility").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("radiologists").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  log("Inserting 30 radiologists…");
  const radRows = RAD_NAMES.map((name, i) => ({
    name,
    employee_id: `EMP-${String(i + 1).padStart(3, "0")}`,
    is_active: Math.random() > 0.1, // ~27 active
  }));
  const { data: rads, error: radErr } = await supabase
    .from("radiologists")
    .insert(radRows)
    .select();
  if (radErr || !rads) throw new Error(radErr?.message ?? "Failed to insert radiologists");

  log("Assigning uneven subspecialty eligibility…");
  const eligRows: { radiologist_id: string; study_type: string }[] = [];
  rads.forEach((r) => {
    const numSpecs = randInt(1, 3); // unevenly 1-3 specialties
    const picked = new Set<string>();
    for (let i = 0; i < numSpecs; i++) {
      const spec = pickWeighted(SUBSPECIALTY_WEIGHTS, picked);
      if (spec) picked.add(spec);
    }
    picked.forEach((spec) => {
      SUBSPECIALTIES[spec].forEach((study) => {
        eligRows.push({ radiologist_id: r.id, study_type: study });
      });
    });
  });
  // De-dupe (same study from overlapping specialties)
  const seen = new Set<string>();
  const dedupedElig = eligRows.filter((row) => {
    const k = `${row.radiologist_id}|${row.study_type}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const { error: eligErr } = await supabase.from("radiologist_eligibility").insert(dedupedElig);
  if (eligErr) throw new Error(eligErr.message);

  log("Generating 200 cases (100 XR / 60 CT / 40 MRI)…");
  const distribution: { modality: Modality; count: number }[] = [
    { modality: "X-ray", count: 100 },
    { modality: "CT", count: 60 },
    { modality: "MRI", count: 40 },
  ];

  const allCases: any[] = [];
  let activeRads = rads.filter((r) => r.is_active);
  let radIdx = 0;
  let critCount = 0;
  const TARGET_CRITICAL = 40;

  for (const { modality, count } of distribution) {
    const studies = STUDY_TYPES_BY_MODALITY[modality];
    const [slaMin, slaMax] = MODALITY_SLA_MINUTES[modality];
    for (let i = 0; i < count; i++) {
      const study = rand(studies);
      const slaMinutes = randInt(slaMin, slaMax);
      const isCritical = critCount < TARGET_CRITICAL && Math.random() < 0.3;
      if (isCritical) critCount++;

      // Critical cases: deadline 1-4 minutes from now (or already breached)
      // Normal: deadline based on full SLA window
      const minutesUntilDeadline = isCritical ? randInt(-2, 4) : randInt(slaMinutes / 2, slaMinutes * 2);
      const tat = new Date(Date.now() + minutesUntilDeadline * 60_000).toISOString();
      const activated = new Date(Date.now() - randInt(1, 30) * 60_000).toISOString();

      const urgency: Urgency = isCritical ? "Stat" : (rand(["Stat", "Urgent", "Routine", "Routine", "Urgent"]) as Urgency);

      // Round-robin assign to an active rad (subspecialty-aware best effort)
      const assignee = activeRads[radIdx % activeRads.length];
      radIdx++;

      allCases.push({
        case_number: `CASE-${new Date().toISOString().slice(0,10).replace(/-/g, "")}-${String(allCases.length).padStart(4, "0")}-${randInt(1000, 9999)}`,
        patient_name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
        patient_id: `MRN-${randInt(10000, 99999)}`,
        modality,
        study_type: study,
        urgency,
        status: "assigned",
        notes: `${PATIENT_AGE_SEX()} • ${rand(CLINICAL_NOTES)}`,
        activated_at: activated,
        tat_deadline: tat,
        assigned_to: assignee.id,
        assigned_at: activated, // Assuming it was assigned when activated for seeding
      });
    }
  }

  // Top up critical to exactly 40 if we fell short
  while (critCount < TARGET_CRITICAL) {
    const c = allCases[critCount];
    c.urgency = "Stat";
    c.tat_deadline = new Date(Date.now() + randInt(-2, 4) * 60_000).toISOString();
    critCount++;
  }

  log(`Inserting ${allCases.length} cases…`);
  // Chunk inserts to avoid payload limits
  const CHUNK = 50;
  for (let i = 0; i < allCases.length; i += CHUNK) {
    const { error } = await supabase.from("cases").insert(allCases.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }

  log(`Done — 30 radiologists, ${allCases.length} cases, ${critCount} SLA-critical.`);
  return { radiologists: rads.length, cases: allCases.length, critical: critCount };
}

// Priority sort: SLA-Critical+CT(Neuro/Chest) → SLA-Critical → Stat → Urgent → Routine
export function priorityScore(c: { urgency: string; modality: string; study_type: string; tat_deadline: string; status: string }): number {
  if (c.status === "completed") return 9999;
  const remaining = (new Date(c.tat_deadline).getTime() - Date.now()) / 60_000;
  const critical = remaining < 5; // SLA critical = <5 min remaining
  const isCtCritical = critical && c.modality === "CT" && (c.study_type === "ct-brain" || c.study_type === "ct-thorax");
  if (isCtCritical) return 0;
  if (critical) return 1;
  if (c.urgency === "Stat") return 2;
  if (c.urgency === "Urgent") return 3;
  return 4;
}
