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
import { fetchSubscription, fetchBusinessSettings, saveBusinessSettings } from "../lib/api";

const AuthContext = createContext(null);

const STORAGE_KEY_BID = "@selly_business_id";

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
      _refreshSubFromBackend(baseProfile);
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
      setIndustry(settings?.industry || null);

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

  // ── Update industry (called from IndustrySetupScreen / Settings) ──────────
  async function updateIndustry(industryId) {
    setIndustry(industryId); // Optimistic update — tabs switch immediately
    try {
      await saveBusinessSettings({ industry: industryId });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Pull live subscription data from Railway (real-time countdown) ─────────
  async function _refreshSubFromBackend(currentProfile) {
    try {
      const sub = await fetchSubscription();
      // sub has: { status, plan, daysRemaining, isActive, trialEnds, ... }
      setProfile(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          trial_days_left    : sub.daysRemaining   ?? prev.trial_days_left,
          plan               : sub.status === "active" ? "pro"
                             : sub.status === "expired" ? "expired"
                             : "trial",
          subscription_status: sub.status,
          is_active          : sub.isActive,
          trial_ends_at      : sub.trialEnds,
        };
      });
    } catch (e) {
      // Backend unreachable — static Supabase data stays as fallback
    }
  }

  // ── Sign in ───────────────────────────────────────────────────────────────
  async function signIn(email, password) {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (err) {
      setAuthError(err.message);
      return { ok: false, error: err.message };
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
        setAuthError(error.message);
        return { ok: false, error: error.message };
      }
      // If email confirmation is disabled, user is immediately logged in
      return {
        ok              : true,
        needsConfirmation: !data.session, // true if email confirmation required
      };
    } catch (err) {
      setAuthError(err.message);
      return { ok: false, error: err.message };
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
    if (error) return { ok: false, error: error.message };
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
      if (error) return { ok: false, error: error.message };
      setProfile(prev => prev ? { ...prev, whatsapp_number: number } : prev);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
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
      refreshSubscription: () => profile && _refreshSubFromBackend(profile),
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
