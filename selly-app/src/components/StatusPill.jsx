import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";
import { STATUS_LABELS } from "../lib/businessTypes";

// Status labels are shared across all three food business types — a café order
// that is "preparing" and a bakery order that is "baking" use different status
// values, not different labels for the same value. So there is no per-type map
// any more; businessTypes.js owns the one vocabulary.
export default function StatusPill({ status, small }) {
  const style = Colors.status[status] || { bg: Colors.bgCard, text: Colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: style.bg }, small && styles.pillSmall]}>
      <Text style={[styles.text, { color: style.text }, small && styles.textSmall]}>
        {STATUS_LABELS[status] || status || "Unknown"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill     : { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" },
  pillSmall: { paddingHorizontal: 8, paddingVertical: 3 },
  text     : { fontWeight: "700", fontSize: 13 },
  textSmall: { fontSize: 11 },
});
