import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";
import StatusPill from "./StatusPill";
import { orderTotal } from "../lib/whatsapp";

// Subtitle: the table for a dine-in order, the cake spec for a bakery order,
// otherwise an item count. Driven off the order itself rather than a business
// type, so one row component serves all three.
function getSubtitle(order) {
  const cart = order.cart || [];

  if (order.order_kind === "cake") {
    const { flavour, kg, eggless } = order.extra || {};
    const spec = [flavour, kg ? `${kg} kg` : null, eggless ? "eggless" : null]
      .filter(Boolean).join(" · ");
    if (spec) return spec;
  }

  const count = `${cart.length} item${cart.length !== 1 ? "s" : ""}`;
  return order.table_no ? `Table ${order.table_no} · ${count}` : count;
}

export default function OrderRow({ order, onPress }) {
  const total = orderTotal(order);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.idCol}>
        <Text style={styles.orderId}>#{String(order.id).slice(-5)}</Text>
        <Text style={styles.date}>
          {order.createdAt
            ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
            : ""}
        </Text>
      </View>

      <View style={styles.midCol}>
        <Text style={styles.customerName} numberOfLines={1}>{order.name || "Guest"}</Text>
        <Text style={styles.itemCount} numberOfLines={1}>{getSubtitle(order)}</Text>
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.amount}>₹{Number(total).toLocaleString("en-IN")}</Text>
        <StatusPill status={order.status} small />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row         : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  idCol       : { width: 56 },
  orderId     : { color: Colors.textPrimary, fontWeight: "700", fontSize: 13 },
  date        : { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  midCol      : { flex: 1, paddingHorizontal: 10 },
  customerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  itemCount   : { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  rightCol    : { alignItems: "flex-end", gap: 4 },
  amount      : { color: Colors.primary, fontWeight: "800", fontSize: 14 },
});
