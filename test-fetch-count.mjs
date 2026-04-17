import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  if (line.includes('=')) {
    const [k, v] = line.split('=');
    env[k.trim()] = v.trim().replace(/^"|"$/g, '');
  }
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function test() {
  const { count, error } = await supabase.from('cases').select('*', { count: 'exact', head: true });
  if (error) {
    console.error("Error fetching cases:", error);
  } else {
    console.log("Total Cases count:", count);
  }
}

test();
