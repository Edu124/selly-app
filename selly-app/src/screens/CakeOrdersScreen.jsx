// ── CakeOrdersScreen.jsx — Cake & Bakery Orders ───────────────────────────────
// Custom cake orders: size, flavor, message, delivery date & time.
// Status: Inquiry → Confirmed → Baking → Ready → Delivered
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Modal, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Colors }                        from "../constants/colors";
import { fetchOrders, updateOrderStatus } from "../lib/api";

// ── Status config ─────────────────────────────────────────────────────────────
const FILTERS = ["all", "pending_payment", "confirmed", "packed", "shipped", "delivered"];

const STATUS_LABELS = {
  pending_payment: "Inquiry",
  confirmed      : "Confirmed",
  packed         : "Baking",
  shipped        : "Ready",
  delivered      : "Delivered",
  cancelled      : "Cancelled",
};

const STATUS_STYLE = {
  pending_payment: { bg: "#fef3c7", text: "#d97706" },
  confirmed      : { bg: "#dbeafe", text: "#1d4ed8" },
  packed         : { bg: "#fce7f3", text: "#be185d" },
  shipped        : { bg: "#d1fae5", text: "#065f46" },
  delivered      : { bg: "#f0fdf4", text: "#15803d" },
  cancelled      : { bg: "#fee2e2", text: "#dc2626" },
};

const STATUS_FLOW = ["pending_payment", "confirmed", "packed", "shipped", "delivered"];

const FILTER_LABELS = {
  all            : "All",
  pending_payment: "Inquiry",
  confirmed      : "Confirmed",
  packed         : "Baking",
  shipped        : "Ready",
  delivered      : "Delivered",
};

function Pill({ status }) {
  const s   = STATUS_STYLE[status] || STATUS_STYLE.pending_payment;
  const lbl = STATUS_LABELS[status] || status;
  return (
    <View style={[pillStyles.pill, { backgroundColor: s.bg }]}>
      <Text style={[pillStyles.text, { color: s.text }]}>{lbl}</Text>
    </View>
  );
}

// ── OrderRow ──────────────────────────────────────────────────────────────────
function OrderRow({ item, onPress }) {
  const customer   = item.customer_name || item.customer?.name || "Customer";
  const initials   = customer.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const cakeType   = item.extraFields?.cakeType || item.items?.[0]?.name || "Custom Cake";
  const delivDate  = item.extraFields?.deliveryDate || "";
  const total      = item.total_amount || item.total || 0;

  return (
    <TouchableOpacity style={rowStyles.card} onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={rowStyles.avatar}>
        <Text style={rowStyles.avatarText}>{initials || "C"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={rowStyles.topRow}>
          <Text style={rowStyles.name} numberOfLines={1}>{customer}</Text>
          <Text style={rowStyles.amount}>
            {total > 0 ? `₹${Number(total).toLocaleString("en-IN")}` : "—"}
          </Text>
        </View>
        <Text style={rowStyles.cakeType} numberOfLines={1}>🎂 {cakeType}</Text>
        <View style={rowStyles.bottomRow}>
          {delivDate ? (
            <Text style={rowStyles.meta}>📅 Delivery: {delivDate}</Text>
          ) : (
            <Text style={rowStyles.meta}>
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                : ""}
            </Text>
          )}
          <Pill status={item.status} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function OrderModal({ order, onClose, onStatusAdvanced }) {
  if (!order) return null;

  const customer    = order.customer_name || order.customer?.name || "Customer";
  const phone       = order.customer?.phone || order.customer_phone || "—";
  const address     = order.customer?.address || order.delivery_address || "";
  const cakeType    = order.extraFields?.cakeType    || "";
  const size        = order.extraFields?.size        || "";
  const flavor      = order.extraFields?.flavor      || "";
  const msgOnCake   = order.extraFields?.msgOnCake   || "";
  const designNotes = order.extraFields?.designNotes || "";
  const delivDate   = order.extraFields?.deliveryDate|| "";
  const delivTime   = order.extraFields?.deliveryTime|| "";

  const items    = order.items || order.order_items || [];
  const discount = order.discount_amount || 0;
  const total    = order.total_amount || order.total || 0;
  const subtotal = discount > 0 ? total + discount : total;

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentIdx + 1] : null;

  const [advancing, setAdvancing] = useState(false);

  async function advance() {
    if (!nextStatus) return;
    setAdvancing(true);
    await onStatusAdvanced(order.id, nextStatus);
    setAdvancing(false);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detailStyles.root}>
        <View style={detailStyles.header}>
          <TouchableOpacity onPress={onClose} style={detailStyles.closeBtn}>
            <Text style={detailStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={detailStyles.title}>Order #{order.id?.toString().slice(-4) || "—"}</Text>
            <Pill status={order.status} />
          </View>
          <View style={{ minWidth: 32 }} />
        </View>

        <ScrollView style={detailStyles.body} showsVerticalScrollIndicator={false}>

          {/* CUSTOMER */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>👤 CUSTOMER</Text>
            <InfoRow label="Name"    value={customer} />
            <InfoRow label="Phone"   value={phone} />
            {address ? <InfoRow label="Address" value={address} /> : null}
          </View>

          {/* CAKE DETAILS */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>🎂 CAKE DETAILS</Text>
            {cakeType    ? <InfoRow label="Type"          value={cakeType}    /> : null}
            {size        ? <InfoRow label="Size"          value={size}        /> : null}
            {flavor      ? <InfoRow label="Flavor"        value={flavor}      /> : null}
            {msgOnCake   ? <InfoRow label="Message"       value={`"${msgOnCake}"`} /> : null}
            {designNotes ? <InfoRow label="Design Notes"  value={designNotes} /> : null}
            {delivDate   ? <InfoRow label="Delivery Date" value={delivDate}   /> : null}
            {delivTime   ? <InfoRow label="Delivery Time" value={delivTime}   /> : null}
            {/* Items from catalog */}
            {items.length > 0 && items.map((it, i) => (
              <View key={i} style={detailStyles.itemRow}>
                <Text style={detailStyles.itemName}>{it.name || it.product_name}</Text>
                <Text style={detailStyles.itemPrice}>
                  ₹{Number(it.price || it.unit_price || 0).toLocaleString("en-IN")}
                  {it.quantity > 1 ? ` × ${it.quantity}` : ""}
                </Text>
              </View>
            ))}
          </View>

          {/* PAYMENT */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>💳 PAYMENT</Text>
            {discount > 0 && (
              <>
                <FeeRow label="Cake Total" value={`₹${Number(subtotal).toLocaleString("en-IN")}`} />
                <FeeRow label="Discount"   value={`−₹${Number(discount).toLocaleString("en-IN")}`} valueColor="#22c55e" />
              </>
            )}
            <FeeRow label="Total" value={`₹${Number(total).toLocaleString("en-IN")}`} isTotal />
          </View>

          {/* Advance status */}
          {nextStatus && (
            <TouchableOpacity
              style={[detailStyles.advanceBtn, advancing && { opacity: 0.5 }]}
              onPress={advance} disabled={advancing} activeOpacity={0.85}
            >
              <Text style={detailStyles.advanceBtnText}>
                {advancing ? "Updating…" : `Mark as ${STATUS_LABELS[nextStatus]} →`}
              </Text>
            </TouchableOpacity>
          )}
          {order.status === "delivered" && (
            <View style={detailStyles.completedBadge}>
              <Text style={detailStyles.completedText}>✅ Order Delivered</Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={detailStyles.infoRow}>
      <Text style={detailStyles.infoLabel}>{label}</Text>
      <Text style={detailStyles.infoValue}>{value}</Text>
    </View>
  );
}

function FeeRow({ label, value, valueColor, isTotal }) {
  return (
    <View style={[detailStyles.feeRow, isTotal && { borderBottomWidth: 0, paddingTop: 10 }]}>
      <Text style={isTotal ? detailStyles.feeTotalLabel : detailStyles.feeLabel}>{label}</Text>
      <Text style={[isTotal ? detailStyles.feeTotalValue : detailStyles.feeValue, valueColor && { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CakeOrdersScreen() {
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    try { setOrders((await fetchOrders())?.orders || []); }
    catch { Alert.alert("Error", "Could not load orders."); }
    finally { setLoading(false); }
  }

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  function countFor(f) {
    return f === "all" ? orders.length : orders.filter(o => o.status === f).length;
  }

  async function handleStatusAdvanced(id, newStatus) {
    try {
      await updateOrderStatus(id, newStatus);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      setSelected(prev => prev?.id === id ? { ...prev, status: newStatus } : prev);
    } catch { Alert.alert("Error", "Could not update status."); }
  }

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {FILTER_LABELS[f]}{countFor(f) > 0 ? ` (${countFor(f)})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.countBar}>
        <Text style={styles.countText}>{filtered.length} {filtered.length === 1 ? "order" : "orders"}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎂</Text>
          <Text style={styles.emptyTitle}>No cake orders yet</Text>
          <Text style={styles.emptyDesc}>
            {filter === "all" ? "Custom cake orders from WhatsApp will appear here" : `No ${FILTER_LABELS[filter]} orders`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <OrderRow item={item} onPress={setSelected} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selected && (
        <OrderModal
          order={selected}
          onClose={() => setSelected(null)}
          onStatusAdvanced={handleStatusAdvanced}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root          : { flex: 1, backgroundColor: Colors.bg },
  filterScroll  : { flexGrow: 0 },
  filterContent : { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip    : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: "#ec489922", borderColor: "#ec489988" },
  filterChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "#ec4899", fontWeight: "800" },
  countBar      : { paddingHorizontal: 16, paddingBottom: 6 },
  countText     : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  empty         : { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyIcon     : { fontSize: 52, marginBottom: 4 },
  emptyTitle    : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  emptyDesc     : { color: Colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
});

const pillStyles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: "800" },
});

const rowStyles = StyleSheet.create({
  card      : { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  avatar    : { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ec489933", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#ec4899", fontSize: 15, fontWeight: "900" },
  topRow    : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  name      : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", flex: 1, marginRight: 8 },
  amount    : { color: Colors.textPrimary, fontSize: 15, fontWeight: "900" },
  cakeType  : { color: Colors.textSecondary, fontSize: 12, marginBottom: 6 },
  bottomRow : { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meta      : { color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
});

const detailStyles = StyleSheet.create({
  root    : { flex: 1, backgroundColor: Colors.bg },
  header  : { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title   : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", marginBottom: 4 },
  closeBtn: { padding: 4, minWidth: 32 },
  closeTxt: { color: Colors.textSecondary, fontSize: 18 },
  body    : { flex: 1, padding: 16 },
  section : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  sectionTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  infoRow : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border + "55" },
  infoLabel: { color: Colors.textSecondary, fontSize: 13 },
  infoValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", flex: 1, textAlign: "right", marginLeft: 16 },
  itemRow : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border + "44" },
  itemName: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  itemPrice: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  feeRow  : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + "44" },
  feeLabel: { color: Colors.textSecondary, fontSize: 14 },
  feeValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  feeTotalLabel: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  feeTotalValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  advanceBtn : { backgroundColor: "#ec4899", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 },
  advanceBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  completedBadge: { backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", marginBottom: 10 },
  completedText : { color: "#22c55e", fontSize: 14, fontWeight: "800" },
});
