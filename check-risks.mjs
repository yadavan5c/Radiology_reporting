import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [k, v] = line.split('=');
    env[k.trim()] = v.replace(/"/g, '').trim();
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
  const { data: cases, error } = await supabase
    .from('cases')
    .select('status, tat_deadline, study_type')
    .neq('status', 'completed')
    .order('tat_deadline', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${cases.length} non-completed cases.`);
  const breached = cases.filter(c => new Date(c.tat_deadline) <= new Date());
  console.log(`Breached: ${breached.length}`);
  
  const highRisk = cases.filter(c => {
    const d = new Date(c.tat_deadline);
    const now = new Date();
    return d > now && d <= new Date(now.getTime() + 5 * 60000);
  });
  console.log(`High Risk (<5m): ${highRisk.length}`);

  const medRisk = cases.filter(c => {
    const d = new Date(c.tat_deadline);
    const now = new Date();
    return d > new Date(now.getTime() + 5 * 60000) && d <= new Date(now.getTime() + 15 * 60000);
  });
  console.log(`Medium Risk (5-15m): ${medRisk.length}`);
}

check();
