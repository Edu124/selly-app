// ── Supabase Client (React Native) ────────────────────────────────────────────
// Uses AsyncStorage so sessions persist across app restarts
// Same project as the Selly web portal (ekughxkikjzkimadyyuk)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL  = "https://ekughxkikjzkimadyyuk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrdWdoeGtpa2p6a2ltYWR5eXVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODkxNzQsImV4cCI6MjA5MjE2NTE3NH0.RMROZ2GAcDC6yxY8YjLW3RmyUk2c5G6HnzQry4qA2xs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage            : AsyncStorage,
    autoRefreshToken   : true,
    persistSession     : true,
    detectSessionInUrl : false,   // Must be false for React Native
  },
});
