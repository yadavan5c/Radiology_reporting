-- Add missing columns
ALTER TABLE radiologists ADD COLUMN IF NOT EXISTS speed_factor FLOAT DEFAULT 1.0;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS coverage_gap BOOLEAN DEFAULT FALSE;

-- Create or replace the flow engine
CREATE OR REPLACE FUNCTION run_radiology_flow_engine()
RETURNS void AS $$
DECLARE
    case_record RECORD;
    best_rad_id UUID;
    v_base_time INT;
    v_urgency_mult FLOAT;
    v_rad_speed FLOAT;
    v_final_minutes FLOAT;
BEGIN
    -- 1. SLA ESCALATION & BREACH CHECK
    UPDATE cases
    SET 
        urgency = CASE 
            WHEN urgency = 'Routine' AND (tat_deadline - now()) < interval '30 minutes' THEN 'Urgent'
            WHEN urgency = 'Urgent' AND (tat_deadline - now()) < interval '10 minutes' THEN 'Stat'
            ELSE urgency
        END
    WHERE status != 'completed';

    -- 2. AUTO-COMPLETION LOGIC
    FOR case_record IN 
        SELECT c.*, r.speed_factor as rad_speed
        FROM cases c
        JOIN radiologists r ON c.assigned_to = r.id
        WHERE c.status = 'in_progress'
    LOOP
        -- Calculate base time
        v_base_time := CASE 
            WHEN case_record.modality = 'X-ray' THEN 3
            WHEN case_record.modality = 'CT' THEN 7
            WHEN case_record.modality = 'MRI' THEN 12
            ELSE 5
        END;

        -- Calculate urgency multiplier
        v_urgency_mult := CASE 
            WHEN case_record.urgency = 'Stat' THEN 0.7
            WHEN case_record.urgency = 'Urgent' THEN 1.0
            WHEN case_record.urgency = 'Routine' THEN 1.7
            ELSE 1.0
        END;

        v_final_minutes := v_base_time * v_urgency_mult * COALESCE(case_record.rad_speed, 1.0);

        -- If time is up, mark completed
        IF (now() - case_record.start_time) >= (v_final_minutes * interval '1 minute') THEN
            UPDATE cases 
            SET status = 'completed', completed_at = now()
            WHERE id = case_record.id;
        END IF;
    END LOOP;

    -- 3. ASSIGNMENT LOGIC
    FOR case_record IN 
        SELECT * FROM cases 
        WHERE status = 'pending'
        ORDER BY 
            CASE 
                WHEN urgency = 'Stat' AND (study_type ILIKE '%brain%' OR study_type ILIKE '%thorax%') THEN 0
                WHEN urgency = 'Stat' THEN 1
                WHEN urgency = 'Urgent' THEN 2
                ELSE 3
            END ASC,
            activated_at ASC
    LOOP
        -- Find best eligible radiologist
        SELECT r.id INTO best_rad_id
        FROM radiologists r
        JOIN radiologist_eligibility re ON r.id = re.radiologist_id
        WHERE r.is_active = true
          AND re.study_type = case_record.study_type
          -- Simple load calculation: count non-completed cases assigned
          ORDER BY 
            (SELECT count(*) FROM cases WHERE assigned_to = r.id AND status != 'completed') ASC,
            r.speed_factor ASC
          LIMIT 1;

        IF best_rad_id IS NOT NULL THEN
            UPDATE cases 
            SET 
                status = 'assigned',
                assigned_to = best_rad_id,
                assigned_at = now()
            WHERE id = case_record.id;
        ELSE
            -- Coverage gap
            UPDATE cases SET coverage_gap = TRUE WHERE id = case_record.id;
        END IF;
    END LOOP;

    -- 4. MOVE ASSIGNED -> IN_PROGRESS (3 minute rule)
    UPDATE cases 
    SET status = 'in_progress', start_time = now()
    WHERE status = 'assigned' AND (now() - assigned_at) >= interval '1 minute'; -- Shortened for demo

END;
$$ LANGUAGE plpgsql;
