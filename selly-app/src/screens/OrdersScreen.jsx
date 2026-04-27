import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchOrders, updateOrderStatus, fetchOrderOTPs, fetchTracking } from "../lib/api";
import OrderRow from "../components/OrderRow";
import StatusPill from "../components/StatusPill";

const STATUS_FILTERS = ["all", "pending_payment", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
const STATUS_FLOW    = ["pending_payment", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

export default function OrdersScreen({ navigation, route }) {
  const [orders, setOrders]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [filter, setFilter]       = useState("all");
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState(null);   // order detail modal
  const [updating, setUpdating]   = useState(false);
  const [trackNum, setTrackNum]   = useState("");
  const [trackUrl, setTrackUrl]   = useState("");
  const [orderOTPs, setOrderOTPs] = useState(null);  // OTP data for selected order
  const [tracking, setTracking]   = useState(null);  // live tracking data
  const [trackLoading, setTrackLoading] = useState(false);

  const load = async (reset = false) => {
    const p = reset ? 1 : page;
    if (reset) { setLoading(true); setPage(1); }
    try {
      const d = await fetchOrders({ status: filter === "all" ? null : filter, page: p });
      if (reset) {
        setOrders(d.orders || []);
      } else {
        setOrders(prev => [...prev, ...(d.orders || [])]);
      }
      setTotal(d.total || 0);
    } catch (e) {
      console.warn("Orders load error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(true); }, [filter]));

  const onRefresh = () => { setRefreshing(true); load(true); };

  const loadMore = () => {
    if (orders.length < total) {
      const next = page + 1;
      setPage(next);
      load(false);
    }
  };

  const filtered = search.trim()
    ? orders.filter(o =>
        String(o.id).includes(search) ||
        (o.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (o.mobile || "").includes(search)
      )
    : orders;

  const openDetail = async (order) => {
    setSelected(order);
    setTrackNum(order.trackingNumber || "");
    setTrackUrl(order.trackingUrl || "");
    setOrderOTPs(null);
    setTracking(null);
    // Load OTPs for COD orders
    if (order.paymentMode === "cod") {
      fetchOrderOTPs(order.id).then(d => setOrderOTPs(d.otps || null)).catch(() => {});
    }
  };

  const loadTracking = async () => {
    if (!selected?.trackingNumber) return;
    setTrackLoading(true);
    try {
      const d = await fetchTracking(selected.trackingNumber, "shiprocket", selected.id);
      setTracking(d.tracking || null);
    } catch {
      setTracking(null);
    } finally {
      setTrackLoading(false);
    }
  };

  const advanceStatus = async () => {
    if (!selected) return;
    const idx  = STATUS_FLOW.indexOf(selected.status);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    setUpdating(true);
    try {
      const extra = next === "shipped"
        ? { trackingNumber: trackNum, trackingUrl: trackUrl }
        : {};
      const updated = await updateOrderStatus(selected.id, next, extra);
      setSelected(updated.order || { ...selected, status: next });
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: next } : o));
    } catch (e) {
      console.warn("Update error:", e.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by ID, name, or phone…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, filter === s && styles.filterChipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>
              {s === "all" ? "All" : s.replace(/_/g, " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <Text style={styles.countLabel}>{total} orders</Text>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={o => String(o.id)}
          renderItem={({ item }) => (
            <OrderRow order={item} onPress={() => openDetail(item)} />
          )}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          }
        />
      )}

      {/* Order detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Order #{selected.id}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                <StatusPill status={selected.status} />

                {/* Customer */}
                <InfoRow label="Customer"  value={selected.name} />
                <InfoRow label="Phone"     value={selected.mobile} />
                <InfoRow label="Address"   value={selected.address} />

                {/* Cart */}
                <Text style={styles.subTitle}>Cart Items</Text>
                {(selected.cart || []).map((item, i) => (
                  <View key={i} style={styles.cartItem}>
                    <Text style={styles.cartName}>{item.name}</Text>
                    <Text style={styles.cartMeta}>
                      {item.size ? `Size: ${item.size}  ` : ""} Qty: {item.qty || 1}
                    </Text>
                    <Text style={styles.cartPrice}>₹{(item.price || 0).toLocaleString("en-IN")}</Text>
                  </View>
                ))}

                {/* Bill */}
                <View style={styles.billBox}>
                  <BillRow label="Subtotal"  value={selected.bill?.subtotal} />
                  {selected.bill?.discount > 0 && <BillRow label="Discount" value={`-₹${selected.bill.discount}`} color={Colors.green} />}
                  <BillRow label="Shipping"  value={selected.bill?.shipping === 0 ? "FREE" : `₹${selected.bill?.shipping}`} />
                  <View style={styles.divider} />
                  <BillRow label="Total"     value={`₹${(selected.bill?.total || 0).toLocaleString("en-IN")}`} bold />
                </View>

                {/* Promo source */}
                {selected.promoSource && (
                  <View style={[styles.promoBadge, { backgroundColor: Colors.promo[selected.promoSource]?.bg || Colors.bgCard }]}>
                    <Text style={[styles.promoText, { color: Colors.promo[selected.promoSource]?.text || Colors.textSecondary }]}>
                      📣 {selected.promoSource.replace(/_/g, " ")}
                    </Text>
                  </View>
                )}

                {/* COD OTP display */}
                {selected.paymentMode === "cod" && orderOTPs && (
                  <View style={styles.otpBox}>
                    <Text style={styles.subTitle}>🔐 Order OTPs</Text>
                    <View style={styles.otpRow}>
                      <View style={styles.otpItem}>
                        <Text style={styles.otpLabel}>Delivery OTP</Text>
                        <Text style={styles.otpCode}>{orderOTPs.cod_otp || "—"}</Text>
                        <Text style={[styles.otpStatus, { color: orderOTPs.cod_otp_verified ? Colors.green : Colors.yellow }]}>
                          {orderOTPs.cod_otp_verified ? "✅ Verified" : "⏳ Pending"}
                        </Text>
                      </View>
                      {orderOTPs.delivery_otp && (
                        <View style={styles.otpItem}>
                          <Text style={styles.otpLabel}>At-Door OTP</Text>
                          <Text style={styles.otpCode}>{orderOTPs.delivery_otp}</Text>
                          <Text style={[styles.otpStatus, { color: orderOTPs.delivery_otp_verified ? Colors.green : Colors.yellow }]}>
                            {orderOTPs.delivery_otp_verified ? "✅ Verified" : "⏳ Pending"}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Tracking (for packing/shipping step) */}
                {selected.status === "confirmed" || selected.status === "packed" ? (
                  <View style={styles.trackingBox}>
                    <Text style={styles.subTitle}>Tracking Info (for shipping)</Text>
                    <TextInput
                      style={styles.trackInput}
                      placeholder="Tracking number (AWB)"
                      placeholderTextColor={Colors.textMuted}
                      value={trackNum}
                      onChangeText={setTrackNum}
                    />
                    <TextInput
                      style={styles.trackInput}
                      placeholder="Tracking URL (optional)"
                      placeholderTextColor={Colors.textMuted}
                      value={trackUrl}
                      onChangeText={setTrackUrl}
                    />
                  </View>
                ) : null}

                {/* Live tracking for shipped orders */}
                {selected.trackingNumber && (selected.status === "shipped" || selected.status === "out_for_delivery") ? (
                  <View style={styles.trackingBox}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={styles.subTitle}>Live Tracking</Text>
                      <TouchableOpacity onPress={loadTracking} disabled={trackLoading}>
                        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: "700" }}>
                          {trackLoading ? "Loading..." : "Refresh ↻"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {tracking ? (
                      <View style={styles.liveTrackBox}>
                        <Text style={styles.liveStatus}>{tracking.statusText || tracking.status}</Text>
                        <Text style={styles.liveCarrier}>{tracking.carrier} · AWB: {tracking.awb}</Text>
                        {tracking.estimatedDate ? (
                          <Text style={styles.liveEta}>ETA: {tracking.estimatedDate}</Text>
                        ) : null}
                        {(tracking.events || []).slice(0, 3).map((e, i) => (
                          <View key={i} style={styles.eventRow}>
                            <Text style={styles.eventDot}>•</Text>
                            <Text style={styles.eventText}>{e.status} {e.location ? `— ${e.location}` : ""}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.liveTrackBtn} onPress={loadTracking}>
                        <Text style={{ color: Colors.primary, fontWeight: "600", fontSize: 13 }}>
                          🔍 Fetch Live Tracking
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}

                {/* Advance status button */}
                {STATUS_FLOW.indexOf(selected.status) < STATUS_FLOW.length - 1 && (
                  <TouchableOpacity
                    style={[styles.advanceBtn, updating && styles.advanceBtnDisabled]}
                    onPress={advanceStatus}
                    disabled={updating}
                  >
                    {updating
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.advanceBtnText}>
                          Mark as {STATUS_FLOW[STATUS_FLOW.indexOf(selected.status) + 1].replace(/_/g, " ")} →
                        </Text>
                    }
                  </TouchableOpacity>
                )}

                <View style={{ height: 24 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function BillRow({ label, value, bold, color }) {
  return (
    <View style={styles.billRow}>
      <Text style={[styles.billLabel, bold && styles.billBold]}>{label}</Text>
      <Text style={[styles.billValue, bold && styles.billBold, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container     : { flex: 1, backgroundColor: Colors.bg },
  center        : { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },

  // Search
  searchWrap    : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, margin: 16, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchIcon    : { fontSize: 16, marginRight: 8 },
  searchInput   : { flex: 1, color: Colors.textPrimary, paddingVertical: 10, fontSize: 14 },
  clearBtn      : { color: Colors.textMuted, fontSize: 16, padding: 4 },

  // Filters
  filterScroll  : { maxHeight: 44 },
  filterContent : { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filterChip    : { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  filterText    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: Colors.primary },

  countLabel    : { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list          : { padding: 16, gap: 10, paddingBottom: 32 },
  empty         : { alignItems: "center", paddingTop: 60 },
  emptyText     : { color: Colors.textMuted, fontSize: 15 },

  // Modal
  modalOverlay  : { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet    : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%" },
  modalHandle   : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader   : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle    : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  closeBtn      : { color: Colors.textSecondary, fontSize: 20, padding: 4 },

  subTitle      : { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 8 },

  infoRow       : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel     : { color: Colors.textSecondary, fontSize: 13 },
  infoValue     : { color: Colors.textPrimary, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },

  cartItem      : { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cartName      : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", flex: 1 },
  cartMeta      : { color: Colors.textSecondary, fontSize: 12, marginHorizontal: 8 },
  cartPrice     : { color: Colors.primary, fontSize: 14, fontWeight: "700" },

  billBox       : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginTop: 16 },
  billRow       : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  billLabel     : { color: Colors.textSecondary, fontSize: 13 },
  billValue     : { color: Colors.textPrimary, fontSize: 13 },
  billBold      : { fontWeight: "800", fontSize: 15, color: Colors.textPrimary },
  divider       : { height: 1, backgroundColor: Colors.border, marginVertical: 8 },

  promoBadge    : { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12, alignSelf: "flex-start" },
  promoText     : { fontSize: 12, fontWeight: "700" },

  trackingBox   : { marginTop: 12 },
  trackInput    : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 13, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },

  otpBox        : { marginTop: 16 },
  otpRow        : { flexDirection: "row", gap: 10 },
  otpItem       : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  otpLabel      : { color: Colors.textSecondary, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  otpCode       : { color: Colors.textPrimary, fontSize: 28, fontWeight: "900", letterSpacing: 4, fontFamily: "monospace" },
  otpStatus     : { fontSize: 11, fontWeight: "700", marginTop: 4 },

  liveTrackBox  : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  liveStatus    : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 4 },
  liveCarrier   : { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  liveEta       : { color: Colors.green, fontSize: 12, fontWeight: "600", marginBottom: 8 },
  eventRow      : { flexDirection: "row", alignItems: "flex-start", marginTop: 4 },
  eventDot      : { color: Colors.primary, marginRight: 6 },
  eventText     : { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  liveTrackBtn  : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.primary + "44" },

  advanceBtn    : { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  advanceBtnDisabled: { opacity: 0.6 },
  advanceBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
