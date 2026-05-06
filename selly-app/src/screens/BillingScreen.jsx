import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchSubscription } from "../lib/api";

// ── Contact number for upgrade enquiries ─────────────────────────────────────
const SELLY_SUPPORT_WA = "https://wa.me/919876543210?text=Hi%2C%20I%20want%20to%20upgrade%20my%20Selly%20account%20to%20Pro.";

export default function BillingScreen() {
  const [sub,        setSub]        = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const s = await fetchSubscription();
      setSub(s);
    } catch (e) {
      console.warn("[Billing]", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading && !sub) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const daysLeft    = sub?.daysRemaining   ?? 0;
  const trialTotal  = sub?.trialDays       ?? 14;   // fallback to 14-day trial
  const startDate   = sub?.startDate       ? new Date(sub.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const status      = sub?.status          || "trial";
  const isExpired   = status === "expired" || status === "suspended" || daysLeft <= 0;
  const pct         = Math.min(100, Math.max(0, (daysLeft / trialTotal) * 100));

  const barColor    = daysLeft > 5 ? Colors.primary
                    : daysLeft > 2 ? Colors.yellow
                    : Colors.red;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.pageTitle}>Plan & Billing</Text>

      {/* Trial card */}
      <View style={[styles.card, isExpired && styles.cardExpired]}>
        {/* Badge row */}
        <View style={styles.badgeRow}>
          <Text style={styles.planName}>🚀 Selly Trial</Text>
          <View style={[styles.badge, { backgroundColor: (isExpired ? Colors.red : Colors.yellow) + "22" }]}>
            <Text style={[styles.badgeText, { color: isExpired ? Colors.red : Colors.yellow }]}>
              {isExpired ? "EXPIRED" : "TRIAL"}
            </Text>
          </View>
        </View>

        {/* Activated on */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Trial activated on</Text>
          <Text style={styles.infoValue}>{startDate}</Text>
        </View>

        {/* Days left */}
        {!isExpired ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Days remaining</Text>
              <Text style={[styles.infoValue, { color: barColor, fontWeight: "900" }]}>
                {daysLeft} / {trialTotal} days
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.progressCaption}>
              {pct >= 100 ? "Trial just started!" : `${Math.round(pct)}% of trial remaining`}
            </Text>

            {daysLeft <= 3 && (
              <View style={styles.urgentBox}>
                <Text style={styles.urgentText}>
                  ⚠️ Only {daysLeft} day{daysLeft !== 1 ? "s" : ""} left! Contact us to keep your store running.
                </Text>
              </View>
            )}
          </>
        ) : (
          /* Expired state */
          <View style={styles.expiredBox}>
            <Text style={styles.expiredIcon}>⏰</Text>
            <Text style={styles.expiredTitle}>Your trial has ended</Text>
            <Text style={styles.expiredSub}>
              Upgrade to Selly Pro to continue receiving orders and sending promotions.
            </Text>
          </View>
        )}
      </View>

      {/* What's included card */}
      {!isExpired && (
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>What's included in your trial</Text>
          {[
            "✅ WhatsApp order bot (unlimited messages)",
            "✅ Product catalog & shop page",
            "✅ Order management dashboard",
            "✅ Customer tracking",
            "✅ Promotions & flash sales",
            "✅ Multi-language support",
          ].map((f, i) => (
            <Text key={i} style={styles.featureItem}>{f}</Text>
          ))}
        </View>
      )}

      {/* CTA — contact team */}
      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>
          {isExpired ? "Upgrade to Selly Pro" : "Want to continue after trial?"}
        </Text>
        <Text style={styles.ctaSub}>
          Message our team on WhatsApp — we'll set you up in minutes.
        </Text>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => Linking.openURL(SELLY_SUPPORT_WA)}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>💬 Contact Team to Upgrade</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, paddingBottom: 48 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  pageTitle : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", marginBottom: 20 },

  // Main trial card
  card        : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: Colors.primary + "33" },
  cardExpired : { borderColor: Colors.red + "44" },

  badgeRow    : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  planName    : { color: Colors.textPrimary, fontSize: 20, fontWeight: "900" },
  badge       : { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText   : { fontSize: 12, fontWeight: "800", letterSpacing: 1 },

  infoRow     : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel   : { color: Colors.textSecondary, fontSize: 14 },
  infoValue   : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },

  progressBg      : { height: 8, backgroundColor: Colors.bgInput, borderRadius: 4, overflow: "hidden", marginTop: 14, marginBottom: 6 },
  progressFill    : { height: "100%", borderRadius: 4 },
  progressCaption : { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },

  urgentBox  : { backgroundColor: Colors.red + "18", borderRadius: 10, padding: 12, marginTop: 12 },
  urgentText : { color: Colors.red, fontSize: 13, fontWeight: "700" },

  // Expired box
  expiredBox   : { alignItems: "center", paddingVertical: 20 },
  expiredIcon  : { fontSize: 40, marginBottom: 8 },
  expiredTitle : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", marginBottom: 6 },
  expiredSub   : { color: Colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Features card
  featuresCard  : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  featuresTitle : { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 12 },
  featureItem   : { color: Colors.textSecondary, fontSize: 13, lineHeight: 22 },

  // CTA card
  ctaCard  : { backgroundColor: Colors.primary + "0F", borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: Colors.primary + "33" },
  ctaTitle : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  ctaSub   : { color: Colors.textSecondary, fontSize: 13, textAlign: "center", marginBottom: 18, lineHeight: 19 },
  ctaBtn   : { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, width: "100%" },
  ctaBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, textAlign: "center" },
});
