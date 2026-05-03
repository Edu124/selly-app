// ── Industry Setup Screen ─────────────────────────────────────────────────────
// Shown once after first login — user picks their business industry.
// Saves to Supabase business_settings and AsyncStorage for fast subsequent loads.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import { Colors } from "../constants/colors";
import { saveBusinessSettings } from "../lib/api";

const INDUSTRIES = [
  {
    id      : "education",
    icon    : "📚",
    title   : "Education",
    subtitle: "Coaching classes, courses & institutes",
    examples: ["NEET / JEE coaching", "Language classes", "Skill & certification courses", "Tuition & hobby classes"],
    color   : "#6C47FF",
    bg      : "rgba(108,71,255,0.10)",
  },
  {
    id      : "product",
    icon    : "🛍️",
    title   : "Product Business",
    subtitle: "Clothing, accessories, home goods & more",
    examples: ["Fashion boutique", "Electronics & gadgets", "Handicrafts & gifts", "Groceries & FMCG"],
    color   : "#0EA5E9",
    bg      : "rgba(14,165,233,0.10)",
  },
  {
    id      : "tourism",
    icon    : "✈️",
    title   : "Tourism & Travel",
    subtitle: "Tour packages, hotels & travel agency",
    examples: ["Goa / Kashmir packages", "Pilgrimage tours", "Adventure & trekking", "Honeymoon packages"],
    color   : "#10B981",
    bg      : "rgba(16,185,129,0.10)",
  },
];

export default function IndustrySetupScreen({ onIndustrySet }) {
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await saveBusinessSettings({ industry: selected });
      onIndustrySet(selected);
    } catch (e) {
      setError("Could not save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Sell<Text style={{ color: Colors.primary }}>y</Text></Text>
        <Text style={styles.title}>What kind of business{"\n"}do you run?</Text>
        <Text style={styles.subtitle}>
          We'll personalise your dashboard, catalog, and orders to match your industry.
        </Text>
      </View>

      {/* Industry cards */}
      {INDUSTRIES.map(ind => {
        const isSelected = selected === ind.id;
        return (
          <TouchableOpacity
            key={ind.id}
            style={[
              styles.card,
              { borderColor: isSelected ? ind.color : Colors.border },
              isSelected && { backgroundColor: ind.bg },
            ]}
            onPress={() => setSelected(ind.id)}
            activeOpacity={0.85}
          >
            {/* Selected tick */}
            {isSelected && (
              <View style={[styles.tick, { backgroundColor: ind.color }]}>
                <Text style={styles.tickText}>✓</Text>
              </View>
            )}

            <View style={styles.cardTop}>
              <View style={[styles.iconBox, { backgroundColor: ind.bg, borderColor: ind.color + "44" }]}>
                <Text style={styles.iconText}>{ind.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, isSelected && { color: ind.color }]}>{ind.title}</Text>
                <Text style={styles.cardSubtitle}>{ind.subtitle}</Text>
              </View>
            </View>

            <View style={styles.examplesRow}>
              {ind.examples.map(ex => (
                <View key={ex} style={[styles.exampleChip, isSelected && { borderColor: ind.color + "66", backgroundColor: ind.color + "15" }]}>
                  <Text style={[styles.exampleText, isSelected && { color: ind.color }]}>{ex}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Error */}
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}

      {/* Confirm button */}
      <TouchableOpacity
        style={[
          styles.confirmBtn,
          !selected && styles.confirmBtnDisabled,
        ]}
        onPress={confirm}
        disabled={!selected || saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.confirmBtnText}>
              {selected
                ? `Continue with ${INDUSTRIES.find(i => i.id === selected)?.title} →`
                : "Select your industry to continue"}
            </Text>
        }
      </TouchableOpacity>

      <Text style={styles.note}>You can change this later in Settings.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content  : { padding: 20, paddingBottom: 40 },

  header    : { alignItems: "center", marginBottom: 28, marginTop: 16 },
  logo      : { fontSize: 32, fontWeight: "900", color: Colors.textPrimary, marginBottom: 20 },
  title     : { fontSize: 26, fontWeight: "900", color: Colors.textPrimary, textAlign: "center", lineHeight: 34, marginBottom: 10 },
  subtitle  : { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },

  card       : { backgroundColor: Colors.bgCard, borderRadius: 18, borderWidth: 2, padding: 16, marginBottom: 14, position: "relative" },
  tick       : { position: "absolute", top: 14, right: 14, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tickText   : { color: "#fff", fontSize: 13, fontWeight: "900" },

  cardTop    : { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  iconBox    : { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  iconText   : { fontSize: 26 },
  cardTitle  : { fontSize: 18, fontWeight: "800", color: Colors.textPrimary, marginBottom: 3 },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 17 },

  examplesRow : { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  exampleChip : { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border },
  exampleText : { fontSize: 11, color: Colors.textSecondary, fontWeight: "500" },

  error: { color: "#ef4444", fontSize: 13, textAlign: "center", marginBottom: 12 },

  confirmBtn        : { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText    : { color: "#fff", fontSize: 16, fontWeight: "800" },

  note: { textAlign: "center", color: Colors.textMuted, fontSize: 12, marginTop: 14 },
});
