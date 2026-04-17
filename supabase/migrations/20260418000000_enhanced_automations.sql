-- 1. Add assigned_at column to track assignment timing
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- 2. Enhanced auto-assign function with Re-balancing and Weighted Workload
CREATE OR REPLACE FUNCTION public.auto_assign_pending_cases()
RETURNS INTEGER AS $$
DECLARE
  v_case RECORD;
  v_radiologist_id UUID;
  v_assigned_count INTEGER := 0;
BEGIN
  -- FIRST: RE-BALANCING
  -- If a radiologist has X-ray/Ultrasound cases assigned for > 2 mins 
  -- AND they are currently "busy" with CT/MRI cases, move the quick cases back to pending.
  UPDATE public.cases
  SET status = 'pending',
      assigned_to = NULL,
      assigned_at = NULL,
      updated_at = NOW()
  WHERE status = 'assigned'
    AND modality IN ('X-ray', 'Ultrasound')
    AND assigned_at <= (NOW() - INTERVAL '2 minutes')
    AND assigned_to IN (
        SELECT assigned_to 
        FROM public.cases 
        WHERE status IN ('assigned', 'in_progress') 
          AND modality IN ('CT', 'MRI')
    );

  -- SECOND: ASSIGNMENT
  -- Loop through pending cases by Urgency (Stat > Urgent > Routine) then by Deadline
  FOR v_case IN 
    SELECT * FROM public.cases 
    WHERE status = 'pending' 
    ORDER BY 
      CASE urgency 
        WHEN 'Stat' THEN 1 
        WHEN 'Urgent' THEN 2 
        ELSE 3 
      END,
      tat_deadline ASC
  LOOP
    
    -- Find the eligible active radiologist with the lowest WEIGHTED workload
    -- CT/MRI = 5 units, Others = 1 unit
    SELECT r.id INTO v_radiologist_id
    FROM public.radiologists r
    JOIN public.radiologist_eligibility e ON r.id = e.radiologist_id
    LEFT JOIN (
        SELECT assigned_to, 
               SUM(CASE WHEN modality IN ('CT', 'MRI') THEN 5 ELSE 1 END) as weighted_load
        FROM public.cases 
        WHERE status IN ('assigned', 'in_progress')
        GROUP BY assigned_to
    ) l ON r.id = l.assigned_to
    WHERE r.is_active = true
      AND e.study_type = v_case.study_type
    ORDER BY COALESCE(l.weighted_load, 0) ASC, RANDOM()
    LIMIT 1;

    -- Assign the case
    IF v_radiologist_id IS NOT NULL THEN
      UPDATE public.cases 
      SET assigned_to = v_radiologist_id, 
          status = 'assigned',
          assigned_at = NOW(),
          updated_at = NOW()
      WHERE id = v_case.id;
      
      v_assigned_count := v_assigned_count + 1;
    END IF;

  END LOOP;

  RETURN v_assigned_count;
END;
$$ LANGUAGE plpgsql;

-- 3. Enhanced auto-complete function with Risk Prioritization
CREATE OR REPLACE FUNCTION public.auto_complete_breached_cases()
RETURNS INTEGER AS $$
DECLARE
  v_completed_count INTEGER := 0;
BEGIN
  -- We complete cases in batches based on priority:
  -- 1. SLA Breached (tat_deadline <= NOW())
  -- 2. High Risk (within 5 mins) if no eligible radiologists are active
  -- 3. Medium Risk (within 15 mins) if no eligible radiologists are active
  
  UPDATE public.cases
  SET status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
  WHERE status != 'completed'
    AND (
      tat_deadline <= NOW() -- Already Breached
      OR (
        -- No active radiologist can read this, and it's getting critical
        NOT EXISTS (
          SELECT 1 FROM public.radiologists r
          JOIN public.radiologist_eligibility e ON r.id = e.radiologist_id
          WHERE r.is_active = true AND e.study_type = public.cases.study_type
        )
        AND tat_deadline <= (NOW() + INTERVAL '15 minutes') -- Handles High/Medium Risk
      )
    );
    
  GET DIAGNOSTICS v_completed_count = ROW_COUNT;
  RETURN v_completed_count;
END;
$$ LANGUAGE plpgsql;
