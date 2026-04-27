// ── Login / Register Screen ────────────────────────────────────────────────────
// Dark-themed, matches Selly brand (purple accent on black)
// Modes: "login" (default) and "register"
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { Colors } from "../constants/colors";

export default function LoginScreen() {
  const { signIn, signUp, resetPassword, authError } = useAuth();

  const [mode,         setMode]         = useState("login");   // "login" | "register" | "forgot"
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [businessName, setBusinessName] = useState("");
  const [confirmPass,  setConfirmPass]  = useState("");
  const [loading,      setLoading]      = useState(false);
  const [localError,   setLocalError]   = useState(null);
  const [successMsg,   setSuccessMsg]   = useState(null);
  const [showPass,     setShowPass]     = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function clearState() {
    setLocalError(null);
    setSuccessMsg(null);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    clearState();
    setLoading(true);

    try {
      if (mode === "forgot") {
        if (!email.trim()) return fail("Enter your email address.");
        const result = await resetPassword(email.trim());
        if (!result.ok) return fail(result.error);
        setSuccessMsg("Password reset email sent! Check your inbox.");
        setMode("login");
        return;
      }

      if (!email.trim() || !password.trim()) return fail("Email and password are required.");

      if (mode === "register") {
        if (!businessName.trim()) return fail("Enter your business name.");
        if (password.length < 6)  return fail("Password must be at least 6 characters.");
        if (password !== confirmPass) return fail("Passwords don't match.");

        const result = await signUp(email.trim(), password, businessName.trim());
        if (!result.ok) return fail(result.error);

        if (result.needsConfirmation) {
          setSuccessMsg("✅ Account created! Check your email to confirm, then sign in.");
          setMode("login");
        }
        // If no confirmation needed, onAuthStateChange in AuthContext will log them in
        return;
      }

      // Login
      const result = await signIn(email.trim(), password);
      if (!result.ok) {
        fail(result.error);
        shake();
      }
      // Success → AuthContext updates user → AppNavigator switches to main app

    } finally {
      setLoading(false);
    }
  }

  function fail(msg) {
    setLocalError(msg);
    setLoading(false);
  }

  const error = localError || authError;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>Sell<Text style={styles.logoAccent}>y</Text></Text>
          <Text style={styles.logoSub}>WhatsApp Commerce Platform</Text>
        </View>

        {/* Card */}
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>

          {/* Title */}
          <Text style={styles.cardTitle}>
            {mode === "login"    ? "Welcome back"       :
             mode === "register" ? "Create account"     :
                                   "Reset password"}
          </Text>
          <Text style={styles.cardSub}>
            {mode === "login"    ? "Sign in to your business account"   :
             mode === "register" ? "Start your 14-day free trial"       :
                                   "We'll send a reset link to your email"}
          </Text>

          {/* Success message */}
          {successMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {/* Error message */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {/* Business name (register only) */}
          {mode === "register" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Business Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Fashion Hub Mumbai"
                placeholderTextColor={Colors.textMuted}
                value={businessName}
                onChangeText={setBusinessName}
                returnKeyType="next"
                autoCapitalize="words"
              />
            </View>
          )}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          {/* Password (not shown on forgot mode) */}
          {mode !== "forgot" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete="password"
                  returnKeyType={mode === "register" ? "next" : "done"}
                  onSubmitEditing={mode === "login" ? handleSubmit : undefined}
                />
                <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
                  <Text style={styles.eyeIcon}>{showPass ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Confirm password (register only) */}
          {mode === "register" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={confirmPass}
                onChangeText={setConfirmPass}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>
          )}

          {/* Forgot password link (login mode only) */}
          {mode === "login" && (
            <TouchableOpacity onPress={() => { clearState(); setMode("forgot"); }} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>
                {mode === "login"    ? "Sign In →"         :
                 mode === "register" ? "Create Account →"  :
                                       "Send Reset Link →"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mode switcher */}
          <View style={styles.switchRow}>
            {mode === "login" ? (
              <>
                <Text style={styles.switchText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => { clearState(); setMode("register"); }}>
                  <Text style={styles.switchLink}>Sign up free</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.switchText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => { clearState(); setMode("login"); }}>
                  <Text style={styles.switchLink}>Sign in</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>

        {/* Footer note */}
        <Text style={styles.footerNote}>
          By signing up you agree to the Terms & Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex           : 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flexGrow       : 1,
    justifyContent : "center",
    paddingHorizontal: 20,
    paddingVertical  : 40,
  },

  // Logo
  logoWrap: {
    alignItems  : "center",
    marginBottom: 32,
  },
  logoText: {
    fontSize  : 48,
    fontWeight: "900",
    color     : Colors.textPrimary,
    letterSpacing: -1,
  },
  logoAccent: {
    color: Colors.primary,
  },
  logoSub: {
    color     : Colors.textMuted,
    fontSize  : 13,
    marginTop : 4,
    letterSpacing: 0.5,
  },

  // Card
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius   : 20,
    padding        : 24,
    borderWidth    : 1,
    borderColor    : Colors.border,
  },
  cardTitle: {
    fontSize  : 22,
    fontWeight: "800",
    color     : Colors.textPrimary,
    marginBottom: 4,
  },
  cardSub: {
    fontSize    : 13,
    color       : Colors.textMuted,
    marginBottom: 20,
    lineHeight  : 18,
  },

  // Messages
  successBox: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderRadius   : 10,
    padding        : 12,
    marginBottom   : 14,
    borderWidth    : 1,
    borderColor    : "rgba(34, 197, 94, 0.3)",
  },
  successText: {
    color   : "#22c55e",
    fontSize: 13,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius   : 10,
    padding        : 12,
    marginBottom   : 14,
    borderWidth    : 1,
    borderColor    : "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    color   : "#ef4444",
    fontSize: 13,
    lineHeight: 18,
  },

  // Inputs
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color       : Colors.textSecondary,
    fontSize    : 12,
    fontWeight  : "600",
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: Colors.bg,
    borderWidth    : 1,
    borderColor    : Colors.border,
    borderRadius   : 12,
    padding        : 14,
    color          : Colors.textPrimary,
    fontSize       : 15,
    flex           : 1,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems   : "center",
  },
  passwordInput: {
    flex: 1,
  },
  eyeBtn: {
    position  : "absolute",
    right     : 12,
    padding   : 6,
  },
  eyeIcon: {
    fontSize: 18,
  },

  // Forgot
  forgotBtn: {
    alignSelf   : "flex-end",
    marginBottom: 18,
    marginTop   : -4,
  },
  forgotText: {
    color   : Colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  // Submit
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius   : 14,
    paddingVertical: 15,
    alignItems     : "center",
    marginTop      : 4,
    shadowColor    : Colors.primary,
    shadowOffset   : { width: 0, height: 4 },
    shadowOpacity  : 0.4,
    shadowRadius   : 10,
    elevation      : 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color     : "#fff",
    fontSize  : 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Mode switch
  switchRow: {
    flexDirection : "row",
    justifyContent: "center",
    marginTop     : 18,
    flexWrap      : "wrap",
  },
  switchText: {
    color   : Colors.textMuted,
    fontSize: 13,
  },
  switchLink: {
    color     : Colors.primary,
    fontSize  : 13,
    fontWeight: "700",
  },

  // Footer
  footerNote: {
    textAlign : "center",
    color     : Colors.textMuted,
    fontSize  : 11,
    marginTop : 24,
    lineHeight: 16,
  },
});
