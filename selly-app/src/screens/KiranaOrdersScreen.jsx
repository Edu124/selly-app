// ── KiranaOrdersScreen.jsx ────────────────────────────────────────────────────
// Grocery list orders for Kirana shops.
// Customer sends a raw list via WhatsApp → owner reviews, checks availability,
// edits prices (auto-pulled from Inventory or set manually), confirms total.
// Status: Requested → Confirmed → Packed → Out for Delivery → Delivered
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Colors }                  from "../constants/colors";
import { fetchOrders, updateOrderStatus, fetchCatalog } from "../lib/api";

// ── Status config ─────────────────────────────────────────────────────────────
const FILTERS = ["all", "pending_payment", "confirmed", "packed", "shipped", "delivered"];

const STATUS_LABELS = {
  pending_payment: "Requested",
  confirmed      : "Confirmed",
  packed         : "Packed",
  shipped        : "Out for Delivery",
  delivered      : "Delivered",
  cancelled      : "Cancelled",
};

const STATUS_STYLE = {
  pending_payment: { bg: "#fef3c7", text: "#d97706" },
  confirmed      : { bg: "#dbeafe", text: "#1d4ed8" },
  packed         : { bg: "#ede9fe", text: "#7c3aed" },
  shipped        : { bg: "#fce7f3", text: "#be185d" },
  delivered      : { bg: "#d1fae5", text: "#065f46" },
  cancelled      : { bg: "#fee2e2", text: "#dc2626" },
};

const STATUS_FLOW  = ["pending_payment", "confirmed", "packed", "shipped", "delivered"];

const FILTER_LABELS = {
  all            : "All",
  pending_payment: "Requested",
  confirmed      : "Confirmed",
  packed         : "Packed",
  shipped        : "Out for Delivery",
  delivered      : "Delivered",
};

// ── Pill ──────────────────────────────────────────────────────────────────────
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
  const customer  = item.customer_name || item.customer?.name || "Customer";
  const initials  = customer.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const rawItems  = item.items || item.order_items || [];
  const itemCount = rawItems.length;
  const total     = item.total_amount || item.total || 0;
  const dateStr   = item.created_at
    ? new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <TouchableOpacity style={rowStyles.card} onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={rowStyles.avatar}>
        <Text style={rowStyles.avatarText}>{initials || "K"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={rowStyles.topRow}>
          <Text style={rowStyles.name} numberOfLines={1}>{customer}</Text>
          <Text style={rowStyles.amount}>
            {total > 0 ? `₹${Number(total).toLocaleString("en-IN")}` : "—"}
          </Text>
        </View>
        <Text style={rowStyles.itemCount}>
          🛒 {itemCount} {itemCount === 1 ? "item" : "items"} requested
        </Text>
        <View style={rowStyles.bottomRow}>
          <Text style={rowStyles.date}>{dateStr}</Text>
          <Pill status={item.status} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Item Row inside detail modal ──────────────────────────────────────────────
function ItemEditRow({ line, inventoryMap, onChange }) {
  const [priceText, setPriceText] = useState(
    line.price != null ? String(line.price) : ""
  );
  const [available, setAvailable] = useState(line.available !== false);

  // Look up from inventory
  const invItem = inventoryMap[line.name?.toLowerCase().trim()] || null;
  const suggestedPrice = invItem ? invItem.price : null;

  function applyInventoryPrice() {
    if (suggestedPrice != null) {
      setPriceText(String(suggestedPrice));
      onChange({ ...line, price: suggestedPrice, available: true });
      setAvailable(true);
    }
  }

  function handlePriceChange(val) {
    setPriceText(val);
    const parsed = parseFloat(val);
    onChange({ ...line, price: isNaN(parsed) ? null : parsed, available });
  }

  function handleAvailableToggle(val) {
    setAvailable(val);
    onChange({ ...line, available: val, price: parseFloat(priceText) || line.price || null });
  }

  const qty = line.quantity || line.qty || 1;
  const unitTotal = (parseFloat(priceText) || 0) * qty;

  return (
    <View style={[itemRowStyles.row, !available && itemRowStyles.rowUnavailable]}>
      {/* Available toggle */}
      <TouchableOpacity
        onPress={() => handleAvailableToggle(!available)}
        style={[itemRowStyles.checkBox, available && itemRowStyles.checkBoxOn]}
      >
        <Text style={{ color: available ? "#fff" : Colors.textMuted, fontSize: 12, fontWeight: "900" }}>
          {available ? "✓" : "✗"}
        </Text>
      </TouchableOpacity>

      {/* Item info */}
      <View style={{ flex: 1 }}>
        <Text style={[itemRowStyles.itemName, !available && { color: Colors.textMuted }]}>
          {line.name || line.product_name || "Item"}
        </Text>
        <Text style={itemRowStyles.itemQty}>Qty: {qty} {line.unit || ""}</Text>
        {!available && (
          <Text style={itemRowStyles.unavailText}>Not available</Text>
        )}
      </View>

      {/* Price input */}
      {available && (
        <View style={itemRowStyles.priceSection}>
          {suggestedPrice != null && String(priceText) !== String(suggestedPrice) && (
            <TouchableOpacity onPress={applyInventoryPrice} style={itemRowStyles.autoBtn}>
              <Text style={itemRowStyles.autoBtnText}>₹{suggestedPrice} ↑</Text>
            </TouchableOpacity>
          )}
          <TextInput
            style={itemRowStyles.priceInput}
            value={priceText}
            onChangeText={handlePriceChange}
            keyboardType="numeric"
            placeholder="₹ price"
            placeholderTextColor={Colors.textMuted}
          />
          {unitTotal > 0 && (
            <Text style={itemRowStyles.lineTotal}>= ₹{unitTotal.toLocaleString("en-IN")}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function OrderModal({ order, inventoryMap, onClose, onStatusAdvanced }) {
  if (!order) return null;

  const rawItems = order.items || order.order_items || [];

  // Local editable item list
  const [editedItems, setEditedItems] = useState(() =>
    rawItems.map(item => ({
      ...item,
      available: item.available !== false,
      price: item.price ?? item.unit_price ?? null,
    }))
  );

  const customer   = order.customer_name || order.customer?.name || "Customer";
  const phone      = order.customer?.phone || order.customer_phone || "—";
  const address    = order.customer?.address || order.delivery_address || "";
  const notes      = order.notes || order.delivery_notes || "";

  // Compute totals from editable items
  const availItems  = editedItems.filter(i => i.available !== false);
  const subtotal    = availItems.reduce((sum, i) => {
    const p = parseFloat(i.price) || 0;
    const q = i.quantity || i.qty || 1;
    return sum + p * q;
  }, 0);
  const discount    = order.discount_amount || 0;
  const deliveryFee = order.delivery_charge || 0;
  const total       = subtotal - discount + deliveryFee;

  function updateItem(index, updated) {
    setEditedItems(prev => prev.map((it, i) => i === index ? updated : it));
  }

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentIdx + 1]
    : null;

  const [advancing, setAdvancing] = useState(false);

  async function advance() {
    if (!nextStatus) return;
    setAdvancing(true);
    await onStatusAdvanced(order.id, nextStatus);
    setAdvancing(false);
  }

  const unavailCount = editedItems.filter(i => i.available === false).length;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detailStyles.root}>
        {/* Header */}
        <View style={detailStyles.header}>
          <TouchableOpacity onPress={onClose} style={detailStyles.closeBtn}>
            <Text style={detailStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={detailStyles.title}>
              Order #{order.id?.toString().slice(-4) || "—"}
            </Text>
            <Pill status={order.status} />
          </View>
          <View style={{ minWidth: 32 }} />
        </View>

        <ScrollView style={detailStyles.body} showsVerticalScrollIndicator={false}>

          {/* CUSTOMER section */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>👤 CUSTOMER</Text>
            <View style={detailStyles.infoRow}>
              <Text style={detailStyles.infoLabel}>Name</Text>
              <Text style={detailStyles.infoValue}>{customer}</Text>
            </View>
            <View style={detailStyles.infoRow}>
              <Text style={detailStyles.infoLabel}>Phone</Text>
              <Text style={detailStyles.infoValue}>{phone}</Text>
            </View>
            {address ? (
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>Address</Text>
                <Text style={detailStyles.infoValue}>{address}</Text>
              </View>
            ) : null}
            {notes ? (
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>Notes</Text>
                <Text style={detailStyles.infoValue}>{notes}</Text>
              </View>
            ) : null}
          </View>

          {/* ITEM LIST section */}
          <View style={detailStyles.section}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={detailStyles.sectionTitle}>🛒 ITEM LIST</Text>
              {unavailCount > 0 && (
                <Text style={detailStyles.unavailBadge}>{unavailCount} unavailable</Text>
              )}
            </View>

            <View style={detailStyles.inventoryHint}>
              <Text style={detailStyles.inventoryHintText}>
                💡 Prices auto-pulled from Inventory. Tap ↑ button to apply, or type manually.
              </Text>
            </View>

            {editedItems.length === 0 ? (
              <Text style={detailStyles.emptyItems}>No items listed</Text>
            ) : editedItems.map((line, idx) => (
              <ItemEditRow
                key={idx}
                line={line}
                inventoryMap={inventoryMap}
                onChange={(updated) => updateItem(idx, updated)}
              />
            ))}
          </View>

          {/* PAYMENT SUMMARY */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>💳 PAYMENT SUMMARY</Text>
            <View style={detailStyles.feeRow}>
              <Text style={detailStyles.feeLabel}>
                Items ({availItems.length}/{editedItems.length} available)
              </Text>
              <Text style={detailStyles.feeValue}>₹{subtotal.toLocaleString("en-IN")}</Text>
            </View>
            {discount > 0 && (
              <View style={detailStyles.feeRow}>
                <Text style={[detailStyles.feeLabel, { color: "#22c55e" }]}>Discount</Text>
                <Text style={[detailStyles.feeValue, { color: "#22c55e" }]}>
                  −₹{Number(discount).toLocaleString("en-IN")}
                </Text>
              </View>
            )}
            {deliveryFee > 0 && (
              <View style={detailStyles.feeRow}>
                <Text style={detailStyles.feeLabel}>Delivery</Text>
                <Text style={detailStyles.feeValue}>₹{Number(deliveryFee).toLocaleString("en-IN")}</Text>
              </View>
            )}
            <View style={[detailStyles.feeRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
              <Text style={detailStyles.feeTotalLabel}>Total</Text>
              <Text style={detailStyles.feeTotalValue}>₹{total.toLocaleString("en-IN")}</Text>
            </View>
          </View>

          {/* Advance status */}
          {nextStatus && (
            <TouchableOpacity
              style={[detailStyles.advanceBtn, advancing && { opacity: 0.5 }]}
              onPress={advance}
              disabled={advancing}
              activeOpacity={0.85}
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

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function KiranaOrdersScreen() {
  const [orders,       setOrders]       = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});  // lowercase name → { price, unit }
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState("all");
  const [selected,     setSelected]     = useState(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    try {
      const [ordersData, catalogData] = await Promise.all([
        fetchOrders(),
        fetchCatalog(),
      ]);
      setOrders(ordersData?.orders || []);

      // Build lowercase name → item map for auto-pricing
      const map = {};
      (catalogData?.products || []).forEach(item => {
        if (item.name) {
          map[item.name.toLowerCase().trim()] = {
            price: item.price,
            unit : item.extraFields?.unit || item.unit || "",
          };
        }
      });
      setInventoryMap(map);
    } catch {
      Alert.alert("Error", "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "all"
    ? orders
    : orders.filter(o => o.status === filter);

  function countFor(f) {
    if (f === "all") return orders.length;
    return orders.filter(o => o.status === f).length;
  }

  async function handleStatusAdvanced(orderId, newStatus) {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      setSelected(prev => prev?.id === orderId ? { ...prev, status: newStatus } : prev);
    } catch {
      Alert.alert("Error", "Could not update status.");
    }
  }

  return (
    <View style={styles.root}>
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {FILTER_LABELS[f]}{countFor(f) > 0 ? ` (${countFor(f)})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {filtered.length} {filtered.length === 1 ? "order" : "orders"}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyDesc}>
            {filter === "all"
              ? "Grocery list orders from WhatsApp will appear here"
              : `No ${FILTER_LABELS[filter]} orders`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <OrderRow item={item} onPress={setSelected} />
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selected && (
        <OrderModal
          order={selected}
          inventoryMap={inventoryMap}
          onClose={() => setSelected(null)}
          onStatusAdvanced={handleStatusAdvanced}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root          : { flex: 1, backgroundColor: Colors.bg },
  filterScroll  : { flexGrow: 0 },
  filterContent : { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip    : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: "#F59E0B22", borderColor: "#F59E0B88" },
  filterChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "#F59E0B", fontWeight: "800" },
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
  avatar    : { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F59E0B33", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#F59E0B", fontSize: 15, fontWeight: "900" },
  topRow    : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  name      : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", flex: 1, marginRight: 8 },
  amount    : { color: Colors.textPrimary, fontSize: 15, fontWeight: "900" },
  itemCount : { color: Colors.textSecondary, fontSize: 12, marginBottom: 6 },
  bottomRow : { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date      : { color: Colors.textMuted, fontSize: 11 },
});

const itemRowStyles = StyleSheet.create({
  row           : { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + "55" },
  rowUnavailable: { opacity: 0.5 },
  checkBox      : { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkBoxOn    : { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  itemName      : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  itemQty       : { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  unavailText   : { color: "#ef4444", fontSize: 11, fontWeight: "600", marginTop: 2 },
  priceSection  : { alignItems: "flex-end", gap: 4 },
  autoBtn       : { backgroundColor: "#F59E0B22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#F59E0B66" },
  autoBtnText   : { color: "#F59E0B", fontSize: 11, fontWeight: "800" },
  priceInput    : { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, color: Colors.textPrimary, fontSize: 14, fontWeight: "700", width: 90, textAlign: "right" },
  lineTotal     : { color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
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
  inventoryHint: { backgroundColor: "#F59E0B11", borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "#F59E0B33" },
  inventoryHintText: { color: "#F59E0B", fontSize: 11, lineHeight: 16 },
  unavailBadge: { backgroundColor: "#fee2e2", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  // This is a label style for the badge text
  emptyItems: { color: Colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 8 },
  feeRow    : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + "44" },
  feeLabel  : { color: Colors.textSecondary, fontSize: 14 },
  feeValue  : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  feeTotalLabel: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  feeTotalValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  advanceBtn : { backgroundColor: "#F59E0B", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 },
  advanceBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  completedBadge: { backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", marginBottom: 10 },
  completedText : { color: "#22c55e", fontSize: 14, fontWeight: "800" },
});
