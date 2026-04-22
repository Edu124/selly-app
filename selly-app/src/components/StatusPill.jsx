import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";

const LABELS = {
  pending_payment : "Pending",
  confirmed       : "Confirmed",
  packed          : "Packed",
  shipped         : "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered       : "Delivered",
  cancelled       : "Cancelled",
};

export default function StatusPill({ status, small }) {
  const style = Colors.status[status] || { bg: Colors.bgCard, text: Colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: style.bg }, small && styles.pillSmall]}>
      <Text style={[styles.text, { color: style.text }, small && styles.textSmall]}>
        {LABELS[status] || status || "Unknown"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill      : { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" },
  pillSmall : { paddingHorizontal: 8, paddingVertical: 3 },
  text      : { fontWeight: "700", fontSize: 13 },
  textSmall : { fontSize: 11 },
});
