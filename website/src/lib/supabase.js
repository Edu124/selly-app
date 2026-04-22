import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://chwwlgcipsqogjvupqwd.supabase.co";
const SUPABASE_ANON = "sb_publishable__6THYwAkXZ83FRtX4ZzUTQ_kPqKNbyv";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
