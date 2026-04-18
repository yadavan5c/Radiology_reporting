import { supabase } from "@/integrations/supabase/client";
import {
  MODALITY_SLA_MINUTES,
  Modality,
  STUDY_TYPES_BY_MODALITY,
  SUBSPECIALTIES,
  Urgency,
} from "./constants";

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

const SUBSPECIALTY_WEIGHTS: Record<string, number> = {
  Neuro: 9, Chest: 8, Spine: 6, MSK_Upper: 7, MSK_Lower: 7, Body: 5, Pelvis: 3,
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

function rand<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

const FIRST_NAMES = ["John", "Jane", "Alex", "Maria", "Wei", "Aiko", "Omar", "Fatima", "Liam", "Sophia", "Noah", "Olivia", "Ravi", "Mei", "Carlos", "Anika"];
const LAST_NAMES = ["Doe", "Smith", "Lee", "Garcia", "Patel", "Kim", "Singh", "Khan", "Brown", "Wilson", "Nguyen", "Lopez", "Tanaka", "Costa", "Ali", "Mendez"];
const CLINICAL_NOTES = ["Suspected acute stroke", "MVA trauma", "Chest pain", "Acute abdominal pain", "Headache", "Post-op surveillance", "Suspected pneumonia", "Trauma fall"];

export type SeedProgress = (msg: string) => void;

export async function seedDemoData(onProgress?: SeedProgress) {
  const log = onProgress ?? (() => {});

  log("Optimizing: Wiping data...");
  await Promise.all([
    supabase.from("cases").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    supabase.from("radiologist_eligibility").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    supabase.from("radiologists").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
  ]);

  log("Inserting 30 radiologists...");
  const radRows = RAD_NAMES.map((name, i) => ({
    name,
    employee_id: `EMP-${String(i + 1).padStart(3, "0")}`,
    is_active: Math.random() > 0.05,
    speed_factor: parseFloat((0.7 + Math.random() * 0.8).toFixed(2)),
  }));
  
  const { data: rads, error: radErr } = await supabase.from("radiologists").insert(radRows).select();
  if (radErr || !rads) throw new Error(radErr?.message ?? "Failed to insert radiologists");
  const activeRads = rads.filter(r => r.is_active);

  log("Assigning subspecialties...");
  const eligRows: { radiologist_id: string; study_type: string }[] = [];
  rads.forEach((r) => {
    const numSpecs = randInt(1, 3);
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
  await supabase.from("radiologist_eligibility").insert(eligRows);

  log("Generating 300 cases (100 Completed / 200 Pending)...");
  const allCases: any[] = [];
  const distribution: { modality: Modality; count: number }[] = [
    { modality: "X-ray", count: 150 }, { modality: "CT", count: 90 }, { modality: "MRI", count: 60 },
  ];

  let completedSoFar = 0;
  const TARGET_COMPLETED = 100;

  for (const { modality, count } of distribution) {
    const studies = STUDY_TYPES_BY_MODALITY[modality];
    const [slaMin, slaMax] = MODALITY_SLA_MINUTES[modality];
    for (let i = 0; i < count; i++) {
      const study = rand(studies);
      const isCompleted = completedSoFar < TARGET_COMPLETED && Math.random() < 0.4;
      if (isCompleted) completedSoFar++;

      const isCritical = Math.random() < 0.2;
      const urgency: Urgency = isCritical ? "Stat" : (rand(["Urgent", "Routine", "Routine", "Urgent"]) as Urgency);
      const slaMinutes = randInt(slaMin, slaMax);
      
      const tat = new Date(Date.now() + (isCritical ? randInt(-2, 5) : randInt(slaMinutes, slaMinutes * 3)) * 60_000).toISOString();
      const activated = new Date(Date.now() - randInt(1, 120) * 60_000).toISOString();

      if (isCompleted) {
        const assignee = rand(activeRads);
        allCases.push({
          case_number: `CASE-${Date.now().toString().slice(-6)}-${allCases.length}`,
          patient_name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
          patient_id: `MRN-${randInt(10000, 99999)}`,
          modality,
          study_type: study,
          urgency,
          status: "completed",
          notes: `${randInt(18, 90)}${rand(["M", "F"])} • Pre-seeded completion`,
          activated_at: activated,
          tat_deadline: tat,
          assigned_to: assignee.id,
          assigned_at: activated,
          completed_at: new Date(Date.now() - randInt(1, 240) * 60_000).toISOString(), // Completed TODAY
        });
      } else {
        allCases.push({
          case_number: `CASE-${Date.now().toString().slice(-6)}-${allCases.length}`,
          patient_name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
          patient_id: `MRN-${randInt(10000, 99999)}`,
          modality,
          study_type: study,
          urgency,
          status: "pending",
          notes: `${randInt(18, 90)}${rand(["M", "F"])} • ${rand(CLINICAL_NOTES)}`,
          activated_at: activated,
          tat_deadline: tat,
        });
      }
    }
  }

  log("Batch inserting cases...");
  const CHUNK = 50;
  for (let i = 0; i < allCases.length; i += CHUNK) {
    await supabase.from("cases").insert(allCases.slice(i, i + CHUNK));
  }

  log("Demo Seeded Successfully!");
  return { radiologists: rads.length, cases: allCases.length, completed: completedSoFar };
}

export function priorityScore(c: { urgency: string; modality: string; study_type: string; tat_deadline: string; status: string }): number {
  if (c.status === "completed") return 9999;
  const remaining = (new Date(c.tat_deadline).getTime() - Date.now()) / 60_000;
  const critical = remaining < 5;
  const isCtNeuro = critical && c.modality === "CT" && (c.study_type.includes("brain") || c.study_type.includes("thorax"));
  
  if (isCtNeuro) return 0;
  if (c.urgency === "Stat") return 1;
  if (c.urgency === "Urgent") return 2;
  return 3;
}
