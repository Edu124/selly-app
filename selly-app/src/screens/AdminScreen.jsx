// ── Admin Screen ──────────────────────────────────────────────────────────────
// Visible ONLY to codeforeai.app@gmail.com
// Manage all client subscriptions: activate, extend, expire
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchAdminClients, adminActivate, adminExtend, adminExpire } from "../lib/api";

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_COLOR = {
  trial  : "#F59E0B",
  active : "#10B981",
  expired: "#EF4444",
};

const STATUS_LABEL = {
  trial  : "TRIAL",
  active : "PRO",
  expired: "EXPIRED",
};

export default function AdminScreen() {
  const [clients,     setClients]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [actionId,    setActionId]    = useState(null); // businessId being actioned

  // ── Load clients ─────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await fetchAdminClients();
      setClients(data.clients || []);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Actions ───────────────────────────────────────────────────────────────
  async function doAction(action, businessId, label) {
    Alert.alert(
      label,
      `Apply "${label}" to ${businessId}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: action === "expire" ? "destructive" : "default",
          onPress: async () => {
            setActionId(businessId);
            try {
              if (action === "activate") await adminActivate(businessId);
              else if (action === "extend") await adminExtend(businessId);
              else if (action === "expire") await adminExpire(businessId);
              await load();
            } catch (e) {
              Alert.alert("Failed", e.message);
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading clients…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
    >
      <Text style={styles.pageTitle}>🔐 Admin Panel</Text>
      <Text style={styles.subtitle}>{clients.length} client{clients.length !== 1 ? "s" : ""} registered</Text>

      {clients.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No clients yet.</Text>
        </View>
      )}

      {clients.map(c => {
        const color    = STATUS_COLOR[c.status] || Colors.textMuted;
        const isBusy   = actionId === c.businessId;
        const isActive = c.status === "active";
        const isTrial  = c.status === "trial";
        const isExpired= c.status === "expired";

        return (
          <View key={c.businessId} style={styles.card}>
            {/* Header row */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bizId}>{c.businessId}</Text>
                <Text style={styles.bizMeta}>
                  Created {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "—"}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
                <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[c.status] || c.status.toUpperCase()}</Text>
              </View>
            </View>

            {/* Days remaining */}
            <View style={styles.daysRow}>
              <Text style={styles.daysLabel}>
                {isActive
                  ? "Days remaining (paid)"
                  : isTrial
                  ? "Trial days left"
                  : "Status"}
              </Text>
              <Text style={[styles.daysValue, { color: isExpired ? "#EF4444" : Colors.textPrimary }]}>
                {isExpired
                  ? "Access cut off"
                  : `${c.daysRemaining ?? "?"} day${c.daysRemaining !== 1 ? "s" : ""}`}
              </Text>
            </View>

            {/* Expiry dates */}
            {(c.trialEnds || c.paidUntil) && (
              <View style={styles.datesRow}>
                {c.trialEnds && (
                  <Text style={styles.dateChip}>
                    Trial ends: {new Date(c.trialEnds).toLocaleDateString("en-IN")}
                  </Text>
                )}
                {c.paidUntil && (
                  <Text style={[styles.dateChip, { color: Colors.primary }]}>
                    Paid until: {new Date(c.paidUntil).toLocaleDateString("en-IN")}
                  </Text>
                )}
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              {/* Activate — for trial/expired clients */}
              {(isTrial || isExpired) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#10B98122", borderColor: "#10B981" }, isBusy && styles.btnDisabled]}
                  onPress={() => doAction("activate", c.businessId, "Activate (30 days)")}
                  disabled={isBusy}
                >
                  {isBusy ? <ActivityIndicator color="#10B981" size="small" />
                           : <Text style={[styles.actionBtnText, { color: "#10B981" }]}>✓ Activate</Text>}
                </TouchableOpacity>
              )}

              {/* Extend — for active clients */}
              {isActive && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.primary + "22", borderColor: Colors.primary }, isBusy && styles.btnDisabled]}
                  onPress={() => doAction("extend", c.businessId, "Extend +30 days")}
                  disabled={isBusy}
                >
                  {isBusy ? <ActivityIndicator color={Colors.primary} size="small" />
                           : <Text style={[styles.actionBtnText, { color: Colors.primary }]}>+30d Extend</Text>}
                </TouchableOpacity>
              )}

              {/* Expire — for any non-expired */}
              {!isExpired && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#EF444422", borderColor: "#EF4444" }, isBusy && styles.btnDisabled]}
                  onPress={() => doAction("expire", c.businessId, "Expire access")}
                  disabled={isBusy}
                >
                  {isBusy ? <ActivityIndicator color="#EF4444" size="small" />
                           : <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>✕ Expire</Text>}
                </TouchableOpacity>
              )}

              {/* Re-activate expired */}
              {isExpired && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#10B98122", borderColor: "#10B981" }, isBusy && styles.btnDisabled]}
                  onPress={() => doAction("activate", c.businessId, "Reactivate (30 days)")}
                  disabled={isBusy}
                >
                  {isBusy ? <ActivityIndicator color="#10B981" size="small" />
                           : <Text style={[styles.actionBtnText, { color: "#10B981" }]}>↺ Reactivate</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: Colors.bg },
  content     : { padding: 16, paddingBottom: 40 },
  center      : { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  loadingText : { color: Colors.textSecondary, marginTop: 12, fontSize: 14 },

  pageTitle   : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", marginBottom: 4 },
  subtitle    : { color: Colors.textSecondary, fontSize: 13, marginBottom: 20 },

  empty       : { alignItems: "center", paddingVertical: 40 },
  emptyText   : { color: Colors.textMuted, fontSize: 15 },

  card        : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  cardHeader  : { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  bizId       : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  bizMeta     : { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  badge       : { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  badgeText   : { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  daysRow     : { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  daysLabel   : { color: Colors.textSecondary, fontSize: 13 },
  daysValue   : { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },

  datesRow    : { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  dateChip    : { color: Colors.textMuted, fontSize: 12, backgroundColor: Colors.bgInput, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },

  actionsRow  : { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionBtn   : { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, alignItems: "center", minWidth: 100 },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  btnDisabled : { opacity: 0.5 },
});
