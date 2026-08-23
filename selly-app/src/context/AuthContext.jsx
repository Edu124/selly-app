// ── Auth Context ───────────────────────────────────────────────────────────────
// Provides: user, profile (business_id, business_name, plan), signIn, signUp, signOut
// Profile is fetched from Supabase `profiles` table after login
// business_id is stored in AsyncStorage for API calls
// ─────────────────────────────────────────────────────────────────────────────

// ── Website URL (for auth email redirects) ────────────────────────────────────
// Password-reset emails link to this URL so users can set a new password.
// Update this if you change the deployed domain of the selly website.
const SELLY_WEBSITE_URL = "https://selly.codeforgeai.app";

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { fetchBusinessSettings, saveBusinessSettings } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { normalizeBusinessType } from "../lib/businessTypes";
import { useFixtures, getDevIndustry, setDevIndustry, resetDevOrders } from "../lib/devStore";

const AuthContext = createContext(null);

const STORAGE_KEY_BID = "@selly_business_id";

// ── Dev preview bypass ────────────────────────────────────────────────────────
// Skips Supabase login so the UI can be browsed locally without an account.
// Guarded by __DEV__, so production builds ignore it. Set to false for real login.
const DEV_PREVIEW_BYPASS = true;
const DEV_PREVIEW_USER = {
  id           : "dev-preview-business",
  email        : "preview@selly.in",
  user_metadata: { business_name: "Preview Store" },
};

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null);
  const [profile,        setProfile]        = useState(null);
  const [loading,        setLoading]        = useState(true);   // initial session check
  const [authError,      setAuthError]      = useState(null);
  const [industry,       setIndustry]       = useState(null);
  const [industryLoading, setIndustryLoading] = useState(false);

  // ── Load session on app start ────────────────────────────────────────────
  useEffect(() => {
    let subscription;

    async function init() {
      if (__DEV__ && DEV_PREVIEW_BYPASS) {
        setUser(DEV_PREVIEW_USER);
        setProfile({
          business_id    : DEV_PREVIEW_USER.id,
          business_name  : "Preview Store",
          plan           : "pro",
          trial_days_left: 14,
          whatsapp_number: "+91 98765 43210",
        });
        // Remember the business type across reloads so previewing doesn't mean
        // re-picking it every time. First run still lands on setup.
        setIndustry(normalizeBusinessType(await getDevIndustry()));
        setLoading(false);
        return;
      }
      try {
        // Get current session (persisted in AsyncStorage)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user);  // pass full user object
        }
      } catch (err) {
        console.error("[Auth] Init error:", err.message);
      } finally {
        setLoading(false);
      }

      // Listen for auth state changes (login / logout / token refresh)
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user);  // pass full user object
        } else {
          setUser(null);
          setProfile(null);
          setIndustry(null);
          setIndustryLoading(false);
          await AsyncStorage.removeItem(STORAGE_KEY_BID);
        }
      });
      subscription = data.subscription;
    }

    init();
    return () => subscription?.unsubscribe();
  }, []);

  // ── Load business profile ─────────────────────────────────────────────────
  // Supabase is auth-only — all business data lives in Railway PostgreSQL.
  // The Supabase user UUID is used directly as business_id so each client's
  // catalog, orders, customers etc. are completely isolated in Railway.
  // business_name is stored in Supabase auth user metadata at signup and
  // synced to business_settings so the WhatsApp bot can read it.
  async function loadProfile(user) {
    try {
      const businessId = user.id; // Supabase UUID → Railway business_id

      // Read business name from Supabase auth user metadata (set at signup)
      const metaName   = user.user_metadata?.business_name
                      || user.raw_user_meta_data?.business_name
                      || null;

      const baseProfile = {
        business_id    : businessId,
        business_name  : metaName || "My Business",
        plan           : "trial",
        trial_days_left: 14,
        whatsapp_number: null,
      };
      setProfile(baseProfile);
      await AsyncStorage.setItem(STORAGE_KEY_BID, businessId);
      // Pull live subscription + plan from Railway (non-blocking)
      // Load industry + sync business name to business_settings (non-blocking)
      _loadIndustry(metaName);
    } catch (err) {
      console.error("[Auth] loadProfile error:", err.message);
    }
  }

  // ── Load industry from business_settings & sync business name ────────────
  // If business_settings doesn't have a business_name yet (first login after
  // signup), write the name from auth metadata so the bot greeting works.
  async function _loadIndustry(metaBusinessName = null) {
    setIndustryLoading(true);
    try {
      const { settings } = await fetchBusinessSettings();
      // Accounts created before Selly went food-only may hold a removed sector
      // (education, tourism, kirana…). normalizeBusinessType maps the food ones
      // forward and returns null for the rest, which sends the owner back
      // through setup rather than silently dropping them into a layout they
      // never chose.
      setIndustry(normalizeBusinessType(settings?.industry));

      // Sync business name to business_settings so the WhatsApp bot can use it
      const savedName = settings?.business_name;
      if (!savedName && metaBusinessName) {
        // First time — write to business_settings for the bot to read
        await saveBusinessSettings({ business_name: metaBusinessName }).catch(() => {});
      } else if (savedName) {
        // Use the name from settings (could have been updated via Settings screen)
        setProfile(prev => prev ? { ...prev, business_name: savedName } : prev);
      }
    } catch (e) {
      setIndustry(null);
    } finally {
      setIndustryLoading(false);
    }
  }

  // ── Update business type (from BusinessTypeSetupScreen / Settings) ────────
  async function updateIndustry(industryId) {
    const next = normalizeBusinessType(industryId);
    const changed = next !== industry;
    setIndustry(next); // Optimistic — the sidebar switches immediately

    if (useFixtures()) {
      // Preview only: persist the choice, and lay down that type's demo data.
      // Switching from a café to a cloud kitchen is a different scenario, not the
      // same orders relabelled — café orders carry table numbers a cloud kitchen
      // has no use for.
      await setDevIndustry(next);
      if (changed) await resetDevOrders(next);
      return { ok: true };
    }

    try {
      await saveBusinessSettings({ industry: next });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: friendlyError(e) };
    }
  }

  // The old model had a 14-day trial and a plan tier, both fetched from
  // Railway. Billing is now Rs 1,000 once plus Rs 20 per completed order, with
  // no trial and no tiers, so there is nothing to count down and nothing to
  // gate. What is owed is computed from orders on the Billing screen.

  // ── Sign in ───────────────────────────────────────────────────────────────
  async function signIn(email, password) {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(friendlyError(error));
        return { ok: false, error: friendlyError(error) };
      }
      return { ok: true };
    } catch (err) {
      setAuthError(friendlyError(err));
      return { ok: false, error: friendlyError(err) };
    }
  }

  // ── Sign up ───────────────────────────────────────────────────────────────
  async function signUp(email, password, businessName) {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data            : { business_name: businessName },
          // After clicking the confirmation link, redirect to the selly website
          // (user can then re-open the app and sign in normally)
          emailRedirectTo : `${SELLY_WEBSITE_URL}/login`,
        },
      });
      if (error) {
        setAuthError(friendlyError(error));
        return { ok: false, error: friendlyError(error) };
      }
      // If email confirmation is disabled, user is immediately logged in
      return {
        ok              : true,
        needsConfirmation: !data.session, // true if email confirmation required
      };
    } catch (err) {
      setAuthError(friendlyError(err));
      return { ok: false, error: friendlyError(err) };
    }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(STORAGE_KEY_BID);
    setUser(null);
    setProfile(null);
    setIndustry(null);
    setIndustryLoading(false);
  }

  // ── Reset password ────────────────────────────────────────────────────────
  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Link in the email opens this page — it handles the recovery token
      // and shows a "set new password" form.
      redirectTo: `${SELLY_WEBSITE_URL}/reset-password`,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    return { ok: true };
  }

  // ── Update WhatsApp number ─────────────────────────────────────────────────
  async function updateWhatsappNumber(number) {
    if (!user) return { ok: false, error: "Not logged in" };
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ whatsapp_number: number })
        .eq("id", user.id);
      if (error) return { ok: false, error: friendlyError(error) };
      setProfile(prev => prev ? { ...prev, whatsapp_number: number } : prev);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: friendlyError(err) };
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      authError,
      industry,
      industryLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updateWhatsappNumber,
      updateIndustry,
      refreshProfile     : () => user && loadProfile(user),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
