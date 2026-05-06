// ── Industry Setup Screen ─────────────────────────────────────────────────────
// Shown once after first login — user picks their business industry.
// Food & Local Shop expands to show 3 sub-types: Kirana, Cakes, Ice Cream.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import { Colors } from "../constants/colors";
import { saveBusinessSettings } from "../lib/api";

// Top-level industry options
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
    examples: ["Fashion boutique", "Electronics & gadgets", "Handicrafts & gifts", "Reseller / dropship"],
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
  {
    id      : "food",          // parent ID — not saved directly
    icon    : "🍽️",
    title   : "Food & Local Shop",
    subtitle: "Kirana, bakery, ice cream & food businesses",
    examples: ["Kirana / Grocery", "Cake & Bakery", "Ice Cream Shop", "Tiffin / Cloud kitchen"],
    color   : "#F59E0B",
    bg      : "rgba(245,158,11,0.10)",
    subtypes: [
      {
        id      : "kirana",
        icon    : "🛒",
        title   : "Kirana / Grocery",
        desc    : "Daily grocery list orders, inventory tracking",
      },
      {
        id      : "cakes",
        icon    : "🎂",
        title   : "Cake & Bakery",
        desc    : "Custom cake orders with flavor, size & delivery date",
      },
      {
        id      : "icecream",
        icon    : "🍦",
        title   : "Ice Cream & Desserts",
        desc    : "Scoop orders, flavor catalog, party & bulk orders",
      },
    ],
  },
];

// Helper — which top-level card does a given industry ID belong to?
function getParentId(industryId) {
  if (["kirana", "cakes", "icecream"].includes(industryId)) return "food";
  return industryId;
}

// Human-readable name for confirm button
function getDisplayName(industryId) {
  const flat = {
    education: "Education",
    product  : "Product Business",
    tourism  : "Tourism & Travel",
    kirana   : "Kirana / Grocery",
    cakes    : "Cake & Bakery",
    icecream : "Ice Cream & Desserts",
  };
  return flat[industryId] || industryId;
}

export default function IndustrySetupScreen({ onIndustrySet }) {
  const [selected,   setSelected]   = useState(null);   // final industry ID to save
  const [expanded,   setExpanded]   = useState(null);   // top-level card expanded (food)
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);

  function handleCardPress(ind) {
    if (ind.subtypes) {
      // Toggle expansion; don't set selected until sub-type chosen
      setExpanded(prev => prev === ind.id ? null : ind.id);
      setSelected(null);
    } else {
      setExpanded(null);
      setSelected(ind.id);
    }
  }

  function handleSubtypePress(subtypeId) {
    setSelected(subtypeId);
  }

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await saveBusinessSettings({ industry: selected });
      onIndustrySet(selected);
    } catch {
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
        const parentSelected = selected && getParentId(selected) === ind.id;
        const isExpanded     = expanded === ind.id;
        const isDirectSelected = selected === ind.id;
        const highlight      = parentSelected || isDirectSelected;

        return (
          <TouchableOpacity
            key={ind.id}
            style={[
              styles.card,
              { borderColor: highlight ? ind.color : Colors.border },
              highlight && { backgroundColor: ind.bg },
            ]}
            onPress={() => handleCardPress(ind)}
            activeOpacity={0.85}
          >
            {/* Selected tick (shown when directly selected or sub-type chosen) */}
            {highlight && (
              <View style={[styles.tick, { backgroundColor: ind.color }]}>
                <Text style={styles.tickText}>✓</Text>
              </View>
            )}

            <View style={styles.cardTop}>
              <View style={[styles.iconBox, { backgroundColor: ind.bg, borderColor: ind.color + "44" }]}>
                <Text style={styles.iconText}>{ind.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, highlight && { color: ind.color }]}>{ind.title}</Text>
                <Text style={styles.cardSubtitle}>{ind.subtitle}</Text>
              </View>
              {ind.subtypes && (
                <Text style={[styles.chevron, highlight && { color: ind.color }]}>
                  {isExpanded ? "▲" : "▼"}
                </Text>
              )}
            </View>

            {/* Example chips (shown when not expanded / no subtypes) */}
            {(!ind.subtypes || !isExpanded) && (
              <View style={styles.examplesRow}>
                {ind.examples.map(ex => (
                  <View
                    key={ex}
                    style={[
                      styles.exampleChip,
                      highlight && { borderColor: ind.color + "66", backgroundColor: ind.color + "15" },
                    ]}
                  >
                    <Text style={[styles.exampleText, highlight && { color: ind.color }]}>{ex}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Sub-type picker (food card only, when expanded) */}
            {ind.subtypes && isExpanded && (
              <View style={styles.subtypeContainer}>
                <Text style={[styles.subtypeHint, { color: ind.color }]}>Choose your shop type:</Text>
                {ind.subtypes.map(sub => {
                  const isSubSelected = selected === sub.id;
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subtypeRow,
                        isSubSelected && {
                          backgroundColor : ind.color + "18",
                          borderColor     : ind.color,
                        },
                      ]}
                      onPress={() => handleSubtypePress(sub.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.subtypeIcon}>{sub.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.subtypeTitle, isSubSelected && { color: ind.color }]}>
                          {sub.title}
                        </Text>
                        <Text style={styles.subtypeDesc}>{sub.desc}</Text>
                      </View>
                      {isSubSelected && (
                        <View style={[styles.subTick, { backgroundColor: ind.color }]}>
                          <Text style={styles.tickText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Error */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Confirm button */}
      <TouchableOpacity
        style={[styles.confirmBtn, !selected && styles.confirmBtnDisabled]}
        onPress={confirm}
        disabled={!selected || saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.confirmBtnText}>
              {selected
                ? `Continue with ${getDisplayName(selected)} →`
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
  chevron    : { fontSize: 14, color: Colors.textMuted, marginLeft: 8 },

  cardTop    : { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  iconBox    : { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  iconText   : { fontSize: 26 },
  cardTitle  : { fontSize: 18, fontWeight: "800", color: Colors.textPrimary, marginBottom: 3 },
  cardSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 17 },

  examplesRow : { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  exampleChip : { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.bgInput || Colors.bg, borderWidth: 1, borderColor: Colors.border },
  exampleText : { fontSize: 11, color: Colors.textSecondary, fontWeight: "500" },

  // Sub-type picker (food)
  subtypeContainer: { marginTop: 4, gap: 8 },
  subtypeHint     : { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  subtypeRow      : { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  subtypeIcon     : { fontSize: 24 },
  subtypeTitle    : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 2 },
  subtypeDesc     : { color: Colors.textSecondary, fontSize: 11, lineHeight: 15 },
  subTick         : { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },

  error: { color: "#ef4444", fontSize: 13, textAlign: "center", marginBottom: 12 },

  confirmBtn        : { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText    : { color: "#fff", fontSize: 16, fontWeight: "800" },

  note: { textAlign: "center", color: Colors.textMuted, fontSize: 12, marginTop: 14 },
});
