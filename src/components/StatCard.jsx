import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";

export default function StatCard({ label, value, icon, color }) {
  return (
    <View style={[styles.card, { borderColor: color + "33" }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card  : {
    backgroundColor: Colors.bgCard,
    borderRadius   : 14,
    padding        : 14,
    alignItems     : "center",
    borderWidth    : 1,
    width          : "47%",
  },
  icon  : { fontSize: 22, marginBottom: 4 },
  value : { fontSize: 26, fontWeight: "900", marginBottom: 2 },
  label : { color: Colors.textSecondary, fontSize: 12, textAlign: "center" },
});
