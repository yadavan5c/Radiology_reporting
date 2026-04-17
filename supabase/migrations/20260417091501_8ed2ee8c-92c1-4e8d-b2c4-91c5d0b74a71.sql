-- Enums
CREATE TYPE public.modality_type AS ENUM ('X-ray', 'CT', 'MRI', 'Ultrasound');
CREATE TYPE public.urgency_level AS ENUM ('Routine', 'Urgent', 'Stat');
CREATE TYPE public.case_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed');

-- Radiologists table
CREATE TABLE public.radiologists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  employee_id TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Radiologist eligibility (which study types each radiologist can read)
CREATE TABLE public.radiologist_eligibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  radiologist_id UUID NOT NULL REFERENCES public.radiologists(id) ON DELETE CASCADE,
  study_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (radiologist_id, study_type)
);

-- Cases table
CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE DEFAULT 'CASE-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random()*100000))::text, 5, '0'),
  patient_name TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  modality public.modality_type NOT NULL,
  study_type TEXT NOT NULL,
  urgency public.urgency_level NOT NULL DEFAULT 'Routine',
  status public.case_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  assigned_to UUID REFERENCES public.radiologists(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tat_deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_modality ON public.cases(modality);
CREATE INDEX idx_cases_urgency ON public.cases(urgency);
CREATE INDEX idx_cases_assigned_to ON public.cases(assigned_to);
CREATE INDEX idx_eligibility_radiologist ON public.radiologist_eligibility(radiologist_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_radiologists_updated_at
BEFORE UPDATE ON public.radiologists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
BEFORE UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.radiologists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radiologist_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Open policies (no auth in this app yet)
CREATE POLICY "Anyone can view radiologists" ON public.radiologists FOR SELECT USING (true);
CREATE POLICY "Anyone can insert radiologists" ON public.radiologists FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update radiologists" ON public.radiologists FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete radiologists" ON public.radiologists FOR DELETE USING (true);

CREATE POLICY "Anyone can view eligibility" ON public.radiologist_eligibility FOR SELECT USING (true);
CREATE POLICY "Anyone can insert eligibility" ON public.radiologist_eligibility FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update eligibility" ON public.radiologist_eligibility FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete eligibility" ON public.radiologist_eligibility FOR DELETE USING (true);

CREATE POLICY "Anyone can view cases" ON public.cases FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cases" ON public.cases FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cases" ON public.cases FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete cases" ON public.cases FOR DELETE USING (true);

-- Realtime
ALTER TABLE public.radiologists REPLICA IDENTITY FULL;
ALTER TABLE public.radiologist_eligibility REPLICA IDENTITY FULL;
ALTER TABLE public.cases REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.radiologists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.radiologist_eligibility;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;