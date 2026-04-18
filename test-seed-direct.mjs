import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('C:/Users/yadavan/.antigravity/tat_tracker/radiology-command/.env', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [k, v] = line.split('=');
    env[k.trim()] = v.trim().replace(/^"|"$/g, '');
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

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

const MODALITY_SLA_MINUTES = {
  "X-ray": [15, 60],
  "CT": [30, 120],
  "MRI": [60, 240],
  "Ultrasound": [30, 90],
};

const STUDY_TYPES_BY_MODALITY = {
  "X-ray": ["chest-pa", "chest-lat", "knee", "shoulder", "pelvis", "ankle", "wrist", "hand", "foot", "spine-c", "spine-l", "hip", "femur", "tibia", "elbow", "forearm", "leg", "heel", "toes", "fingers"],
  "CT": ["ct-brain", "ct-thorax", "ct-abdomen", "ct-pelvis", "ct-spine-c", "ct-spine-l", "ct-angio", "ct-sinus"],
  "MRI": ["mri-brain", "mri-spine-c", "mri-spine-l", "mri-knee", "mri-shoulder", "mri-pelvis", "mri-abdomen"],
  "Ultrasound": ["us-abdomen", "us-pelvis", "us-thyroid", "us-doppler", "us-renal"],
};

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
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

async function seed() {
  console.log("Wiping existing data…");
  await supabase.from("cases").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("radiologists").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Inserting 30 radiologists…");
  const radRows = RAD_NAMES.map((name, i) => ({
    name,
    employee_id: `EMP-${String(i + 1).padStart(3, "0")}`,
    is_active: Math.random() > 0.1,
  }));
  const { data: rads, error: radErr } = await supabase.from("radiologists").insert(radRows).select();
  if (radErr || !rads) throw new Error(radErr?.message ?? "Failed to insert radiologists");

  console.log("Assigning uneven subspecialty eligibility…");
  const eligRows = [];
  rads.forEach((r) => {
    const numSpecs = randInt(1, 3);
    const picked = new Set();
    for (let i = 0; i < numSpecs; i++) {
      const entries = Object.entries({
        Neuro: 9, Chest: 8, Spine: 6, MSK_Upper: 7,
        MSK_Lower: 7, Body: 5, Pelvis: 3
      }).filter(([k]) => !picked.has(k));
      if (entries.length > 0) {
        const total = entries.reduce((s, [, w]) => s + w, 0);
        let r = Math.random() * total;
        let spec = entries[0][0];
        for (const [k, w] of entries) {
          r -= w;
          if (r <= 0) { spec = k; break; }
        }
        picked.add(spec);
      }
    }
    picked.forEach((spec) => {
      const SUBSPECIALTIES = {
        Neuro: ["ct-brain", "mri-brain", "spine-c"],
        Chest: ["chest-pa", "chest-lat", "ct-thorax"],
        Spine: ["spine-c", "spine-l", "ct-spine-c", "ct-spine-l", "mri-spine-c", "mri-spine-l"],
        MSK_Upper: ["shoulder", "wrist", "hand", "elbow", "forearm", "fingers", "mri-shoulder"],
        MSK_Lower: ["knee", "pelvis", "ankle", "foot", "hip", "femur", "tibia", "leg", "heel", "toes", "mri-knee"],
        Body: ["ct-abdomen", "mri-abdomen", "us-abdomen", "us-thyroid", "us-renal"],
        Pelvis: ["pelvis", "ct-pelvis", "mri-pelvis", "us-pelvis"],
      };
      SUBSPECIALTIES[spec].forEach((study) => {
        eligRows.push({ radiologist_id: r.id, study_type: study });
      });
    });
  });

  const seen = new Set();
  const dedupedElig = eligRows.filter((row) => {
    const k = `${row.radiologist_id}|${row.study_type}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const { error: eligErr } = await supabase.from("radiologist_eligibility").insert(dedupedElig);
  if (eligErr) throw new Error(eligErr.message);

  console.log("Generating 300 cases (200 Pending / 100 Completed)…");
  const distribution = [
    { modality: "X-ray", count: 150 },
    { modality: "CT", count: 90 },
    { modality: "MRI", count: 60 },
  ];

  const allCases = [];
  let activeRads = rads.filter((r) => r.is_active);
  let radIdx = 0;
  let critCount = 0;
  const TARGET_CRITICAL = 60;
  let completedCount = 0;
  const TARGET_COMPLETED = 100;

  for (const { modality, count } of distribution) {
    const studies = STUDY_TYPES_BY_MODALITY[modality];
    const [slaMin, slaMax] = MODALITY_SLA_MINUTES[modality];
    for (let i = 0; i < count; i++) {
      const study = rand(studies);
      const slaMinutes = randInt(slaMin, slaMax);
      const isCritical = critCount < TARGET_CRITICAL && Math.random() < 0.3;
      if (isCritical) critCount++;

      const isCompleted = completedCount < TARGET_COMPLETED && Math.random() < 0.4;
      if (isCompleted) completedCount++;

      const minutesUntilDeadline = isCritical ? randInt(-2, 4) : randInt(slaMinutes / 2, slaMinutes * 2);
      const tat = new Date(Date.now() + minutesUntilDeadline * 60_000).toISOString();
      const activated = new Date(Date.now() - randInt(1, 120) * 60_000).toISOString();
      const urgency = isCritical ? "Stat" : rand(["Stat", "Urgent", "Routine", "Routine", "Urgent"]);

      if (isCompleted) {
        const assignee = activeRads[radIdx % activeRads.length];
        radIdx++;
        allCases.push({
          case_number: `CASE-${new Date().toISOString().slice(0,10).replace(/-/g, "")}-${String(allCases.length).padStart(4, "0")}-${randInt(1000, 9999)}`,
          patient_name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
          patient_id: `MRN-${randInt(10000, 99999)}`,
          modality,
          study_type: study,
          urgency,
          status: "completed",
          notes: `${PATIENT_AGE_SEX()} • ${rand(CLINICAL_NOTES)}`,
          activated_at: activated,
          tat_deadline: tat,
          assigned_to: assignee.id,
          assigned_at: activated,
          completed_at: new Date(new Date(activated).getTime() + randInt(5, 30) * 60_000).toISOString(),
        });
      } else {
        allCases.push({
          case_number: `CASE-${new Date().toISOString().slice(0,10).replace(/-/g, "")}-${String(allCases.length).padStart(4, "0")}-${randInt(1000, 9999)}`,
          patient_name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
          patient_id: `MRN-${randInt(10000, 99999)}`,
          modality,
          study_type: study,
          urgency,
          status: "pending",
          notes: `${PATIENT_AGE_SEX()} • ${rand(CLINICAL_NOTES)}`,
          activated_at: activated,
          tat_deadline: tat,
          assigned_to: null,
          assigned_at: null,
        });
      }
    }
  }

  console.log(`Inserting ${allCases.length} cases…`);
  const CHUNK = 50;
  for (let i = 0; i < allCases.length; i += CHUNK) {
    const { error } = await supabase.from("cases").insert(allCases.slice(i, i + CHUNK));
    if (error) {
      console.error(error);
      throw new Error(error.message);
    }
  }

  console.log(`Done — 30 radiologists, ${allCases.length} cases.`);
}

seed().catch(console.error);
