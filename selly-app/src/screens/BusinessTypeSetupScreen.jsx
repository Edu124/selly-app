// ── Business Type Setup ───────────────────────────────────────────────────────
// Shown once after first login, and again if the stored value is one of the
// removed sectors (see normalizeBusinessType).
//
// Selly is food-only: Cafe / Restaurant, Bakery / Cake shop, Cloud kitchen.
// The chosen type drives the whole sidebar and every screen's labels.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import { Colors } from "../constants/colors";
import { BUSINESS_TYPE_LIST } from "../lib/businessTypes";
import { friendlyError } from "../lib/errors";

export default function BusinessTypeSetupScreen({ onIndustrySet }) {
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      // AuthContext.updateIndustry owns the write — this screen used to call
      // saveBusinessSettings itself as well, which meant two writes per setup.
      const res = await onIndustrySet(selected);
      if (res && res.ok === false) throw new Error(res.error || "Could not save");
    } catch (e) {
      // Under the dev login bypass there is no Supabase session, so the save
      // always fails. Let setup complete anyway so the UI stays browsable —
      // the choice is held in context for the session.
      if (__DEV__) {
        onIndustrySet(selected);
        return;
      }
      setError(friendlyError(e, "Could not save your choice. Please try again."));
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>Sell<Text style={{ color: Colors.primary }}>y</Text></Text>
        <Text style={styles.title}>What kind of food{"\n"}business do you run?</Text>
        <Text style={styles.subtitle}>
          We'll set up your orders, menu and dashboard to match how you actually work.
        </Text>
      </View>

      {BUSINESS_TYPE_LIST.map(t => {
        const on = selected === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.card,
              { borderColor: on ? t.color : Colors.border },
              on && { backgroundColor: t.bg },
            ]}
            onPress={() => setSelected(t.id)}
            activeOpacity={0.85}
          >
            {on && (
              <View style={[styles.tick, { backgroundColor: t.color }]}>
                <Text style={styles.tickText}>✓</Text>
              </View>
            )}

            <View style={styles.cardTop}>
              <View style={[styles.iconBox, { backgroundColor: t.bg, borderColor: t.color + "44" }]}>
                <Text style={styles.iconText}>{t.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, on && { color: t.color }]}>{t.title}</Text>
                <Text style={styles.cardSubtitle}>{t.subtitle}</Text>
              </View>
            </View>

            <View style={styles.examplesRow}>
              {t.examples.map(ex => (
                <View
                  key={ex}
                  style={[
                    styles.exampleChip,
                    on && { borderColor: t.color + "66", backgroundColor: t.color + "15" },
                  ]}
                >
                  <Text style={[styles.exampleText, on && { color: t.color }]}>{ex}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
        onPress={confirm}
        disabled={!selected || saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : (
            <Text style={styles.confirmBtnText}>
              {selected
                ? `Continue with ${BUSINESS_TYPE_LIST.find(t => t.id === selected).title} →`
                : "Pick your business type to continue"}
            </Text>
          )}
      </TouchableOpacity>

      <Text style={styles.note}>You can change this later in Settings.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content  : { padding: 20, paddingBottom: 40, maxWidth: 620, width: "100%", alignSelf: "center" },

  header  : { alignItems: "center", marginBottom: 28, marginTop: 16 },
  logo    : { fontSize: 32, fontWeight: "900", color: Colors.textPrimary, marginBottom: 20 },
  title   : { fontSize: 26, fontWeight: "900", color: Colors.textPrimary, textAlign: "center", lineHeight: 34, marginBottom: 10 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },

  card    : { backgroundColor: Colors.bgCard, borderRadius: 18, borderWidth: 2, padding: 16, marginBottom: 14, position: "relative" },
  tick    : { position: "absolute", top: 14, right: 14, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tickText: { color: "#fff", fontSize: 13, fontWeight: "900" },

  cardTop     : { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  iconBox     : { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  iconText    : { fontSize: 26 },
  cardTitle   : { fontSize: 18, fontWeight: "800", color: Colors.textPrimary, marginBottom: 3 },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 17 },

  examplesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  exampleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border },
  exampleText: { fontSize: 11, color: Colors.textSecondary, fontWeight: "500" },

  error: { color: Colors.red, fontSize: 13, textAlign: "center", marginBottom: 12 },

  confirmBtn        : { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText    : { color: "#fff", fontSize: 16, fontWeight: "800" },

  note: { textAlign: "center", color: Colors.textMuted, fontSize: 12, marginTop: 14 },
});
