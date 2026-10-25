import { createClient } from '@supabase/supabase-js';

// Demo build: open policies on purpose (see supabase/schema.sql). Never store real data.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
