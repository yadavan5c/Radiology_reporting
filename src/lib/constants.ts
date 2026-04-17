export const MODALITIES = ["X-ray", "CT", "MRI", "Ultrasound"] as const;
export type Modality = (typeof MODALITIES)[number];

// DB enum values stay the same — we only relabel in the UI.
export const URGENCIES = ["Routine", "Urgent", "Stat"] as const;
export type Urgency = (typeof URGENCIES)[number];

// Display labels: Stat→High, Urgent→Medium, Routine→Low
export const URGENCY_LABEL: Record<Urgency, string> = {
  Stat: "High",
  Urgent: "Medium",
  Routine: "Low",
};

export const URGENCY_FROM_LABEL: Record<string, Urgency> = {
  High: "Stat",
  Medium: "Urgent",
  Low: "Routine",
};

export const URGENCY_DISPLAY_OPTIONS = ["High", "Medium", "Low"] as const;

export const STATUSES = ["pending", "assigned", "in_progress", "completed"] as const;
export type CaseStatus = (typeof STATUSES)[number];

// Canonical study list per modality (lowercase naming per spec)
export const STUDY_TYPES_BY_MODALITY: Record<Modality, string[]> = {
  "X-ray": [
    "chest", "spine", "knee", "hand", "wrist", "elbow", "shoulder",
    "ankle", "foot", "leg", "heel", "hip", "pelvis", "abdomen", "kub", "thigh",
  ],
  CT: ["ct-brain", "ct-thorax", "ct-abdomen"],
  MRI: ["mri-spine", "mri-abdomen"],
  Ultrasound: ["abdomen", "pelvis", "kub"],
};

export const ALL_STUDY_TYPES = Array.from(
  new Set(Object.values(STUDY_TYPES_BY_MODALITY).flat()),
).sort();

export const URGENCY_TAT_MINUTES: Record<Urgency, number> = {
  Stat: 30,
  Urgent: 60,
  Routine: 240,
};

// ScanSync per-modality SLA windows (minutes) for seeding
export const MODALITY_SLA_MINUTES: Record<Modality, [number, number]> = {
  "X-ray": [3, 5],
  CT: [7, 10],
  MRI: [12, 15],
  Ultrasound: [10, 15],
};

// Subspecialty groupings for uneven eligibility distribution
// Studies grouped by anatomical/clinical subspecialty using the new naming.
export const SUBSPECIALTIES: Record<string, string[]> = {
  Neuro: ["ct-brain"],
  Chest: ["chest", "ct-thorax"],
  Spine: ["spine", "mri-spine"],
  MSK_Upper: ["hand", "wrist", "elbow", "shoulder"],
  MSK_Lower: ["knee", "ankle", "foot", "leg", "heel", "hip", "thigh"],
  Body: ["abdomen", "ct-abdomen", "mri-abdomen"],
  Pelvis: ["pelvis", "kub"],
};
