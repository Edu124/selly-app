// ── Supabase Client (React Native) ────────────────────────────────────────────
// Uses AsyncStorage so sessions persist across app restarts
// Same project as the Selly web portal (ekughxkikjzkimadyyuk)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL  = "https://chwwlgcipsqogjvupqwd.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNod3dsZ2NpcHNxb2dqdnVwcXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjk1NjcsImV4cCI6MjA4ODYwNTU2N30.VfAywyqc6lT_B3VJpQbiryQtVsa50Sw_VtPuCC6Gu7I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage            : AsyncStorage,
    autoRefreshToken   : true,
    persistSession     : true,
    detectSessionInUrl : false,   // Must be false for React Native
  },
});
