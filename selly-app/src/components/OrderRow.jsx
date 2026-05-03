import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";
import StatusPill from "./StatusPill";

// Middle subtitle text per industry
// For education: show first course name
// For tourism: show first package name + duration if available
// For product: show item count
function getSubtitle(order, industry) {
  const cart = order.cart || [];
  if (industry === "education") {
    const firstName = cart[0]?.name;
    return firstName
      ? firstName.length > 28 ? firstName.slice(0, 28) + "…" : firstName
      : `${cart.length} course${cart.length !== 1 ? "s" : ""}`;
  }
  if (industry === "tourism") {
    const firstName = cart[0]?.name;
    return firstName
      ? firstName.length > 28 ? firstName.slice(0, 28) + "…" : firstName
      : `${cart.length} package${cart.length !== 1 ? "s" : ""}`;
  }
  // product (default)
  return `${cart.length} item${cart.length !== 1 ? "s" : ""}`;
}

export default function OrderRow({ order, industry, onPress }) {
  const total    = order.bill?.total || 0;
  const subtitle = getSubtitle(order, industry);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.idCol}>
        <Text style={styles.orderId}>#{order.id}</Text>
        <Text style={styles.date}>
          {order.createdAt
            ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
            : ""}
        </Text>
      </View>

      <View style={styles.midCol}>
        <Text style={styles.customerName} numberOfLines={1}>{order.name || "Unknown"}</Text>
        <Text style={styles.itemCount} numberOfLines={1}>{subtitle}</Text>
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.amount}>₹{total.toLocaleString("en-IN")}</Text>
        <StatusPill status={order.status} industry={industry} small />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row         : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  idCol       : { width: 52 },
  orderId     : { color: Colors.textPrimary, fontWeight: "700", fontSize: 13 },
  date        : { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  midCol      : { flex: 1, paddingHorizontal: 10 },
  customerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  itemCount   : { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  rightCol    : { alignItems: "flex-end", gap: 4 },
  amount      : { color: Colors.primary, fontWeight: "800", fontSize: 14 },
});
