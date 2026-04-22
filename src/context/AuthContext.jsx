// ── Auth Context ───────────────────────────────────────────────────────────────
// Provides: user, profile (business_id, business_name, plan), signIn, signUp, signOut
// Profile is fetched from Supabase `profiles` table after login
// business_id is stored in AsyncStorage for API calls
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const STORAGE_KEY_BID = "@selly_business_id";

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [profile,     setProfile]     = useState(null);
  const [loading,     setLoading]     = useState(true);   // initial session check
  const [authError,   setAuthError]   = useState(null);

  // ── Load session on app start ────────────────────────────────────────────
  useEffect(() => {
    let subscription;

    async function init() {
      try {
        // Get current session (persisted in AsyncStorage)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
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
          await loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          await AsyncStorage.removeItem(STORAGE_KEY_BID);
        }
      });
      subscription = data.subscription;
    }

    init();
    return () => subscription?.unsubscribe();
  }, []);

  // ── Load business profile from Supabase ──────────────────────────────────
  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("business_id, business_name, plan, trial_days_left, whatsapp_number")
        .eq("id", userId)
        .single();

      if (error) {
        // Profile might not exist yet (new user) — use fallback
        console.warn("[Auth] Profile fetch:", error.message);
        const fallbackProfile = {
          business_id      : userId.split("-")[0].toUpperCase(),
          business_name    : "My Business",
          plan             : "trial",
          trial_days_left  : 14,
          whatsapp_number  : null,
        };
        setProfile(fallbackProfile);
        await AsyncStorage.setItem(STORAGE_KEY_BID, fallbackProfile.business_id);
        return;
      }

      if (data) {
        setProfile(data);
        // Cache business_id for API calls
        if (data.business_id) {
          await AsyncStorage.setItem(STORAGE_KEY_BID, data.business_id);
        }
      }
    } catch (err) {
      console.error("[Auth] loadProfile error:", err.message);
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
          data: { business_name: businessName },
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
  }

  // ── Reset password ────────────────────────────────────────────────────────
  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      authError,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshProfile: () => user && loadProfile(user.id),
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
