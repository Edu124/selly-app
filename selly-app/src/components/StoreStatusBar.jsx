// ── StoreStatusBar ────────────────────────────────────────────────────────────
// The "are we taking orders" control, sitting at the top of the dashboard.
//
// This is deliberately the loudest thing on the screen when the store is shut.
// A cloud kitchen has no shutter for a customer to see — if the ordering page
// keeps taking orders after the kitchen goes home, food gets promised that
// nobody is there to cook, and the customer finds out by waiting.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { friendlyError } from "../lib/errors";
import {
  loadStoreConfig, setAcceptingOrders, storeOpenState, todayHoursText,
} from "../lib/storeStatus";
import { subscribeDevOrders } from "../lib/devStore";

export default function StoreStatusBar({ onOpenSettings }) {
  const [config,  setConfig]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    try {
      const { config: c } = await loadStoreConfig();
      setConfig(c);
    } catch {
      // Settings unreachable — assume open rather than blocking the dashboard,
      // and stay quiet: the dashboard already surfaces load errors.
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return subscribeDevOrders(load);
  }, [load]));

  async function toggle(next) {
    if (!config || saving) return;
    setSaving(true);
    const prev = config;
    setConfig({ ...config, acceptingOrders: next });   // optimistic
    try {
      const saved = await setAcceptingOrders(config, next);
      setConfig(saved);
    } catch (e) {
      setConfig(prev);
      Alert.alert("Couldn't change store status", friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.bar, styles.barNeutral]}>
        <ActivityIndicator color={Colors.textMuted} size="small" />
        <Text style={styles.neutralText}>Checking store status…</Text>
      </View>
    );
  }
  if (!config) return null;

  const state    = storeOpenState(config);
  const shutByHours = !state.open && state.reason === "hours";

  return (
    <View style={[styles.bar, state.open ? styles.barOpen : styles.barShut]}>
      <View style={[styles.dot, { backgroundColor: state.open ? Colors.green : Colors.red }]} />

      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: state.open ? Colors.green : Colors.red }]}>
          {state.open ? "Taking orders" : "Not taking orders"}
        </Text>
        <Text style={styles.sub}>
          {state.open
            ? `Today ${todayHoursText(config)} · customers can order now`
            : shutByHours
              ? `Outside today's hours (${todayHoursText(config)}) — the ordering page is refusing orders`
              : "Paused by you — the ordering page is refusing orders"}
        </Text>
      </View>

      {/* The switch controls the manual pause only. When it's on but hours have
          closed the store, flipping it does nothing useful — so point the owner
          at the hours instead of leaving them poking a switch that won't help. */}
      {shutByHours ? (
        <TouchableOpacity style={styles.hoursBtn} onPress={onOpenSettings}>
          <Ionicons name="time-outline" size={13} color={Colors.primaryLight} />
          <Text style={styles.hoursBtnText}>Hours</Text>
        </TouchableOpacity>
      ) : (
        <Switch
          value={config.acceptingOrders}
          onValueChange={toggle}
          disabled={saving}
          trackColor={{ false: Colors.border, true: "rgba(34,197,94,0.45)" }}
          thumbColor={config.acceptingOrders ? Colors.green : Colors.textMuted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center", gap: 11,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11,
    marginBottom: 12,
  },
  barOpen   : { backgroundColor: "rgba(34,197,94,0.07)", borderColor: "rgba(34,197,94,0.28)" },
  barShut   : { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.32)" },
  barNeutral: { backgroundColor: Colors.bgCard,          borderColor: Colors.border },

  dot  : { width: 9, height: 9, borderRadius: 5 },
  title: { fontSize: 13.5, fontWeight: "800", letterSpacing: -0.1 },
  sub  : { color: Colors.textSecondary, fontSize: 11.5, marginTop: 2, lineHeight: 16 },

  neutralText: { color: Colors.textMuted, fontSize: 12 },

  hoursBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary + "22", borderWidth: 1, borderColor: Colors.primary + "44",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  hoursBtnText: { color: Colors.primaryLight, fontSize: 12, fontWeight: "700" },
});
