// ── BookingsScreen.jsx — Tourism Bookings ────────────────────────────────────
// Ground-up bookings screen for the Tourism industry.
// Status flow: Inquiry → Confirmed → Upcoming → Completed
// No shipping field, no tracking — shows traveler, package, travel date, group size.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Colors }    from "../constants/colors";
import { fetchOrders, updateOrderStatus } from "../lib/api";

// ── Status config ─────────────────────────────────────────────────────────────
const FILTERS = ["all", "pending_payment", "confirmed", "shipped", "delivered"];

const STATUS_LABELS = {
  pending_payment: "Inquiry",
  confirmed      : "Confirmed",
  shipped        : "Upcoming",
  delivered      : "Completed",
  cancelled      : "Cancelled",
};

const STATUS_STYLE = {
  pending_payment: { bg: "#fef3c7", text: "#d97706" },
  confirmed      : { bg: "#dbeafe", text: "#1d4ed8" },
  shipped        : { bg: "#d1fae5", text: "#065f46" },
  delivered      : { bg: "#f0fdf4", text: "#15803d" },
  cancelled      : { bg: "#fee2e2", text: "#dc2626" },
};

const STATUS_FLOW  = ["pending_payment", "confirmed", "shipped", "delivered"];

const FILTER_LABELS = {
  all            : "All",
  pending_payment: "Inquiry",
  confirmed      : "Confirmed",
  shipped        : "Upcoming",
  delivered      : "Completed",
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

// ── BookingRow ────────────────────────────────────────────────────────────────
function BookingRow({ item, onPress }) {
  const traveler   = item.customer_name || item.customer?.name || "Unknown Traveler";
  const initials   = traveler.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const pkgName    = item.items?.[0]?.name || item.order_items?.[0]?.product_name || "Package";
  const travelDate = item.extraFields?.travelDate || "";
  const groupSz    = item.extraFields?.groupSize  || "";
  const total      = item.total_amount || item.total || 0;
  const dateStr    = item.created_at
    ? new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";

  return (
    <TouchableOpacity style={rowStyles.card} onPress={() => onPress(item)} activeOpacity={0.8}>
      {/* Avatar */}
      <View style={rowStyles.avatar}>
        <Text style={rowStyles.avatarText}>{initials || "T"}</Text>
      </View>

      <View style={{ flex: 1 }}>
        {/* Top row: name + amount */}
        <View style={rowStyles.topRow}>
          <Text style={rowStyles.name} numberOfLines={1}>{traveler}</Text>
          <Text style={rowStyles.amount}>₹{Number(total).toLocaleString("en-IN")}</Text>
        </View>

        {/* Package name */}
        <Text style={rowStyles.pkg} numberOfLines={1}>🌍 {pkgName}</Text>

        {/* Bottom row: meta + status */}
        <View style={rowStyles.bottomRow}>
          <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
            {travelDate ? (
              <Text style={rowStyles.meta}>📅 {travelDate}</Text>
            ) : null}
            {groupSz ? (
              <Text style={rowStyles.meta}>👥 {groupSz} pax</Text>
            ) : null}
            {!travelDate && !groupSz ? (
              <Text style={rowStyles.meta}>{dateStr}</Text>
            ) : null}
          </View>
          <Pill status={item.status} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Booking Detail Modal ──────────────────────────────────────────────────────
function BookingModal({ booking, onClose, onStatusAdvanced }) {
  if (!booking) return null;

  const traveler   = booking.customer_name || booking.customer?.name || "Unknown";
  const phone      = booking.customer?.phone || booking.customer_phone || "—";
  const travelDate = booking.extraFields?.travelDate || "—";
  const groupSz    = booking.extraFields?.groupSize  || "—";
  const pickup     = booking.extraFields?.pickup     || "";

  const items = booking.items || booking.order_items || [];
  const discount = booking.discount_amount || 0;
  const total    = booking.total_amount || booking.total || 0;
  const subtotal = discount > 0 ? total + discount : total;

  const currentIdx = STATUS_FLOW.indexOf(booking.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentIdx + 1]
    : null;

  const [advancing, setAdvancing] = useState(false);

  async function advance() {
    if (!nextStatus) return;
    setAdvancing(true);
    await onStatusAdvanced(booking.id, nextStatus);
    setAdvancing(false);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={detailStyles.root}>
        {/* Header */}
        <View style={detailStyles.header}>
          <TouchableOpacity onPress={onClose} style={detailStyles.closeBtn}>
            <Text style={detailStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={detailStyles.title}>Booking #{booking.id?.toString().slice(-4) || "—"}</Text>
            <Pill status={booking.status} />
          </View>
          <View style={{ minWidth: 32 }} />
        </View>

        <ScrollView style={detailStyles.body} showsVerticalScrollIndicator={false}>

          {/* TRAVELER section */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>🧳 TRAVELER</Text>
            <View style={detailStyles.infoRow}>
              <Text style={detailStyles.infoLabel}>Name</Text>
              <Text style={detailStyles.infoValue}>{traveler}</Text>
            </View>
            <View style={detailStyles.infoRow}>
              <Text style={detailStyles.infoLabel}>Phone</Text>
              <Text style={detailStyles.infoValue}>{phone}</Text>
            </View>
            <View style={detailStyles.infoRow}>
              <Text style={detailStyles.infoLabel}>Travel Date</Text>
              <Text style={detailStyles.infoValue}>{travelDate}</Text>
            </View>
            <View style={detailStyles.infoRow}>
              <Text style={detailStyles.infoLabel}>Group Size</Text>
              <Text style={detailStyles.infoValue}>{groupSz} {groupSz !== "—" ? "pax" : ""}</Text>
            </View>
            {pickup ? (
              <View style={detailStyles.infoRow}>
                <Text style={detailStyles.infoLabel}>Pickup</Text>
                <Text style={detailStyles.infoValue}>{pickup}</Text>
              </View>
            ) : null}
          </View>

          {/* PACKAGE(S) section */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>🌍 PACKAGE(S)</Text>
            {items.length === 0 ? (
              <Text style={detailStyles.emptyItems}>No packages listed</Text>
            ) : items.map((pkg, idx) => {
              const pName    = pkg.name || pkg.product_name || "Package";
              const dest     = pkg.extraFields?.destination || pkg.destination || "";
              const nights   = pkg.extraFields?.nights   || pkg.nights   || "";
              const days     = pkg.extraFields?.days     || pkg.days     || "";
              const inclList = pkg.extraFields?.inclusions || [];
              const inclChips= inclList.map(k => {
                const found = [
                  { key: "hotel", icon: "🏨" }, { key: "flight", icon: "✈️" },
                  { key: "meals", icon: "🍽️" }, { key: "transport", icon: "🚌" },
                  { key: "guide", icon: "🧭" }, { key: "visa", icon: "📋" },
                  { key: "insurance", icon: "🛡️" }, { key: "activities", icon: "🎯" },
                ].find(i => i.key === k);
                return found ? found.icon : k;
              });
              const qty      = pkg.quantity || 1;
              const price    = pkg.price || pkg.unit_price || 0;

              return (
                <View key={idx} style={detailStyles.pkgCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <Text style={detailStyles.pkgName} numberOfLines={2}>{pName}</Text>
                    <Text style={detailStyles.pkgPrice}>₹{Number(price).toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    {dest ? (
                      <Text style={detailStyles.pkgMeta}>📍 {dest}</Text>
                    ) : null}
                    {nights ? (
                      <Text style={detailStyles.pkgMeta}>🌙 {nights}N/{days}D</Text>
                    ) : null}
                    {qty > 1 ? (
                      <Text style={detailStyles.pkgMeta}>× {qty} pax</Text>
                    ) : null}
                  </View>
                  {inclChips.length > 0 && (
                    <Text style={detailStyles.pkgIncl}>{inclChips.join("  ")}</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* PAYMENT section */}
          <View style={detailStyles.section}>
            <Text style={detailStyles.sectionTitle}>💳 PAYMENT</Text>
            {discount > 0 && (
              <>
                <View style={detailStyles.feeRow}>
                  <Text style={detailStyles.feeLabel}>Package Total</Text>
                  <Text style={detailStyles.feeValue}>₹{Number(subtotal).toLocaleString("en-IN")}</Text>
                </View>
                <View style={detailStyles.feeRow}>
                  <Text style={[detailStyles.feeLabel, { color: "#22c55e" }]}>Discount</Text>
                  <Text style={[detailStyles.feeValue, { color: "#22c55e" }]}>−₹{Number(discount).toLocaleString("en-IN")}</Text>
                </View>
              </>
            )}
            <View style={[detailStyles.feeRow, detailStyles.feeRowTotal]}>
              <Text style={detailStyles.feeTotalLabel}>Total</Text>
              <Text style={detailStyles.feeTotalValue}>₹{Number(total).toLocaleString("en-IN")}</Text>
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

          {booking.status === "delivered" && (
            <View style={detailStyles.completedBadge}>
              <Text style={detailStyles.completedText}>✅ Trip Completed</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BookingsScreen() {
  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("all");
  const [selected,    setSelected]    = useState(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    try {
      const data = await fetchOrders();
      setBookings(data || []);
    } catch {
      Alert.alert("Error", "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }

  // ── filtered list ──────────────────────────────────────────────────────────
  const filtered = filter === "all"
    ? bookings
    : bookings.filter(b => b.status === filter);

  // ── counts per filter ──────────────────────────────────────────────────────
  function countFor(f) {
    if (f === "all") return bookings.length;
    return bookings.filter(b => b.status === f).length;
  }

  // ── advance status ─────────────────────────────────────────────────────────
  async function handleStatusAdvanced(bookingId, newStatus) {
    try {
      await updateOrderStatus(bookingId, newStatus);
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: newStatus } : b
      ));
      // Also update the selected modal booking
      setSelected(prev => prev && prev.id === bookingId ? { ...prev, status: newStatus } : prev);
    } catch {
      Alert.alert("Error", "Could not update status.");
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
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
              {FILTER_LABELS[f]}
              {countFor(f) > 0 ? ` (${countFor(f)})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count bar */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {filtered.length} {filtered.length === 1 ? "booking" : "bookings"}
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🗓️</Text>
          <Text style={styles.emptyTitle}>No bookings found</Text>
          <Text style={styles.emptyDesc}>
            {filter === "all"
              ? "Bookings made via WhatsApp will appear here"
              : `No ${FILTER_LABELS[filter]} bookings`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <BookingRow item={item} onPress={setSelected} />
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail Modal */}
      {selected && (
        <BookingModal
          booking={selected}
          onClose={() => setSelected(null)}
          onStatusAdvanced={handleStatusAdvanced}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root          : { flex: 1, backgroundColor: Colors.bg },
  filterScroll  : { flexGrow: 0 },
  filterContent : { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterChip    : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary + "66" },
  filterChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: Colors.primary, fontWeight: "800" },
  countBar      : { paddingHorizontal: 16, paddingBottom: 6 },
  countText     : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  empty         : { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyIcon     : { fontSize: 52, marginBottom: 4 },
  emptyTitle    : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyDesc     : { color: Colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
});

const pillStyles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: "800" },
});

const rowStyles = StyleSheet.create({
  card      : { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  avatar    : { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0ea5e9" + "33", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#0ea5e9", fontSize: 15, fontWeight: "900" },
  topRow    : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  name      : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", flex: 1, marginRight: 8 },
  amount    : { color: Colors.textPrimary, fontSize: 15, fontWeight: "900" },
  pkg       : { color: Colors.textSecondary, fontSize: 12, marginBottom: 6 },
  bottomRow : { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meta      : { color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
});

const detailStyles = StyleSheet.create({
  root    : { flex: 1, backgroundColor: Colors.bg },
  header  : { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  title   : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", marginBottom: 4 },
  closeBtn: { padding: 4, minWidth: 32 },
  closeTxt: { color: Colors.textSecondary, fontSize: 18 },
  body    : { flex: 1, padding: 16 },
  section : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  sectionTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  infoRow : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border + "66" },
  infoLabel: { color: Colors.textSecondary, fontSize: 13 },
  infoValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", textAlign: "right", flex: 1, marginLeft: 16 },
  emptyItems: { color: Colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 8 },
  pkgCard : { backgroundColor: Colors.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  pkgName : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", flex: 1, lineHeight: 20 },
  pkgPrice: { color: Colors.textPrimary, fontSize: 14, fontWeight: "900" },
  pkgMeta : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  pkgIncl : { color: Colors.textMuted, fontSize: 13, letterSpacing: 2, marginTop: 4 },
  feeRow  : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + "44" },
  feeRowTotal: { borderBottomWidth: 0, paddingTop: 10 },
  feeLabel: { color: Colors.textSecondary, fontSize: 14 },
  feeValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  feeTotalLabel: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  feeTotalValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  advanceBtn : { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10 },
  advanceBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  completedBadge: { backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", marginBottom: 10 },
  completedText : { color: "#22c55e", fontSize: 14, fontWeight: "800" },
});
