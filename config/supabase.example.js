// config/supabase.example.js
// Copy this file to supabase.js at the repo root, then add your real keys.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'YOUR_PROJECT_URL',
  'YOUR_ANON_KEY'
)