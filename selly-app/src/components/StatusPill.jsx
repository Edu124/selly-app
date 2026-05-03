import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";

// Raw status → display label per industry
const STATUS_LABELS = {
  product: {
    pending_payment : "Pending",
    confirmed       : "Confirmed",
    packed          : "Packed",
    shipped         : "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered       : "Delivered",
    cancelled       : "Cancelled",
  },
  education: {
    pending_payment : "Pending Fees",
    confirmed       : "Active",
    packed          : "In Progress",
    shipped         : "In Progress",
    out_for_delivery: "In Progress",
    delivered       : "Completed",
    cancelled       : "Cancelled",
  },
  tourism: {
    pending_payment : "Inquiry",
    confirmed       : "Confirmed",
    packed          : "In Progress",
    shipped         : "Upcoming",
    out_for_delivery: "Upcoming",
    delivered       : "Completed",
    cancelled       : "Cancelled",
  },
};

export default function StatusPill({ status, industry, small }) {
  const labels = STATUS_LABELS[industry] || STATUS_LABELS.product;
  const style  = Colors.status[status] || { bg: Colors.bgCard, text: Colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: style.bg }, small && styles.pillSmall]}>
      <Text style={[styles.text, { color: style.text }, small && styles.textSmall]}>
        {labels[status] || status || "Unknown"}
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
