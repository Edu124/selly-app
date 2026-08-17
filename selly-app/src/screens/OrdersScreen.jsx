import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { fetchOrders, updateOrderStatus, fetchOrderOTPs, fetchTracking, fetchCustomers } from "../lib/api";
import { notifyOrderStatus } from "../lib/whatsapp";
import { friendlyError } from "../lib/errors";
import { useAuth } from "../context/AuthContext";
import OrderRow from "../components/OrderRow";
import StatusPill from "../components/StatusPill";
import { typeConfig, STATUS_LABELS, ADVANCE_LABELS, nextStatus } from "../lib/businessTypes";
import { subscribeDevOrders } from "../lib/devStore";

// ── Per-type screen config ────────────────────────────────────────────────────
// The status flow itself comes from businessTypes.js so the filter chips, the
// advance button and the dashboard buckets can never disagree.
const SCREEN_CONFIG = {
  cafe: {
    itemLabel: "order", itemLabelCap: "Order",
    personLabel: "Customer", cartLabel: "Items",
    showTracking: false, showAddress: false, showTable: true,
  },
  bakery: {
    itemLabel: "cake order", itemLabelCap: "Cake order",
    personLabel: "Customer", cartLabel: "Cake",
    showTracking: false, showAddress: true, showTable: false,
  },
  cloudkitchen: {
    itemLabel: "order", itemLabelCap: "Order",
    personLabel: "Customer", cartLabel: "Items",
    showTracking: true, showAddress: true, showTable: false,
  },
};

export default function OrdersScreen({ navigation, route }) {
  const { industry } = useAuth();
  const type = typeConfig(industry);
  const cfg  = {
    ...(SCREEN_CONFIG[type.id] || SCREEN_CONFIG.cafe),
    statusFlow  : type.statusFlow,
    // "all" plus pending (the state the bot creates orders in) plus the flow.
    filters     : ["all", "pending_payment", ...type.statusFlow],
    filterLabels: { all: "All", ...STATUS_LABELS },
  };
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
  const [customers, setCustomers] = useState([]);    // needed to resolve a WhatsApp send
  const [notice,    setNotice]    = useState(null);  // result of the last status change

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

  useFocusEffect(useCallback(() => {
    // Reset filter to "all" when the business type changes and reload
    setFilter("all");
    load(true);
    fetchCustomers().then(c => setCustomers(c.customers || [])).catch(() => {});
    // Live-update when the guest ordering page places an order in another tab.
    // No-op outside the dev bypass.
    return subscribeDevOrders(() => load(true));
  }, [industry]));

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
    setNotice(null);
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
    // nextStatus() also handles the pending_payment orders the bot creates,
    // which sit before the flow starts.
    const next = nextStatus(industry, selected.status);
    if (!next) return;
    setUpdating(true);
    setNotice(null);
    try {
      const extra = next === "shipped"
        ? { trackingNumber: trackNum, trackingUrl: trackUrl }
        : {};
      const updated = await updateOrderStatus(selected.id, next, extra);
      setSelected(updated.order || { ...selected, status: next });
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: next } : o));

      // Notify after the status lands, and never let a failed message block it.
      const res = await notifyOrderStatus(next, {
        order       : selected,
        customerName: selected.name,
        tableNo     : selected.table_no,
        address     : selected.address,
        flavour     : selected.extra?.flavour,
        cakeMsg     : selected.extra?.cakeMsg,
        due         : selected.extra?.due,
      }, customers);
      if (res.sent)       setNotice({ ok: true,  text: `${res.to} notified on WhatsApp`, body: res.text });
      else if (res.error) setNotice({ ok: false, text: `Customer not notified — ${res.error}`, body: res.text });
    } catch (e) {
      setNotice({ ok: false, text: friendlyError(e) });
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
        {cfg.filters.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, filter === s && styles.filterChipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.filterText, filter === s && styles.filterTextActive]}>
              {cfg.filterLabels[s] || s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <Text style={styles.countLabel}>{total} {cfg.itemLabel}{total !== 1 ? "s" : ""}</Text>

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
                  <Text style={styles.modalTitle}>
                    {cfg.itemLabelCap} #{String(selected.id).slice(-5)}
                  </Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                <StatusPill status={selected.status} />

                <InfoRow label={cfg.personLabel} value={selected.name} />
                <InfoRow label="Phone"           value={selected.mobile} />
                {cfg.showTable && <InfoRow label="Table" value={selected.table_no ? `Table ${selected.table_no}` : null} />}

                {/* Delivery address as its own block, not a squeezed table row —
                    it's what the rider reads, and it's usually two lines long. */}
                {cfg.showAddress && !!selected.address && (
                  <View style={styles.addrBox}>
                    <Ionicons name="location" size={14} color={Colors.primaryLight} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addrLbl}>Deliver to</Text>
                      <Text style={styles.addrVal}>{selected.address}</Text>
                    </View>
                  </View>
                )}

                {/* Note for the kitchen, from the ordering page */}
                {!!selected.extra?.note && (
                  <View style={styles.noteBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={13} color={Colors.yellow} />
                    <Text style={styles.noteText}>{selected.extra.note}</Text>
                  </View>
                )}

                {/* Items */}
                <Text style={styles.subTitle}>{cfg.cartLabel}</Text>
                {(selected.cart || []).map((item, i) => (
                  <View key={i} style={styles.cartItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartName}>{item.name}</Text>
                      {item.productNumber ? (
                        <Text style={styles.cartCode}>🏷 {item.productNumber}</Text>
                      ) : null}
                      <Text style={styles.cartMeta}>
                        {item.size ? `Size: ${item.size}  ` : ""}Qty: {item.qty || 1}
                      </Text>
                    </View>
                    <Text style={styles.cartPrice}>₹{(item.price || 0).toLocaleString("en-IN")}</Text>
                  </View>
                ))}

                {/* Bill */}
                <View style={styles.billBox}>
                  <BillRow label="Subtotal"  value={selected.bill?.subtotal} />
                  {selected.bill?.discount > 0 && <BillRow label="Discount" value={`-₹${selected.bill.discount}`} color={Colors.green} />}
                  {cfg.showAddress && <BillRow label="Delivery" value={selected.bill?.delivery === 0 ? "FREE" : `₹${selected.bill?.delivery || 0}`} />}
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
                        <Text style={styles.otpLabel}>{cfg.showAddress ? "Delivery OTP" : "Collection OTP"}</Text>
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

                {/* Tracking — delivery business types only */}
                {cfg.showTracking && (selected.status === "confirmed" || selected.status === "packed") ? (
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

                {cfg.showTracking && selected.trackingNumber && (selected.status === "shipped" || selected.status === "out_for_delivery") ? (
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

                {/* Did the customer get told? Shows the message that went out,
                    so the owner can see exactly what was said. */}
                {!!notice && (
                  <View style={[styles.notice, notice.ok ? styles.noticeOk : styles.noticeWarn]}>
                    <View style={styles.noticeHead}>
                      <Ionicons
                        name={notice.ok ? "logo-whatsapp" : "alert-circle-outline"}
                        size={14}
                        color={notice.ok ? Colors.green : Colors.yellow}
                      />
                      <Text style={[styles.noticeTitle, { color: notice.ok ? Colors.green : Colors.yellow }]}>
                        {notice.text}
                      </Text>
                    </View>
                    {!!notice.body && <Text style={styles.noticeBody}>{notice.body}</Text>}
                  </View>
                )}

                {/* Advance to the next status in this business type's flow */}
                {(() => {
                  const next = nextStatus(industry, selected.status);
                  if (!next) return null;
                  return (
                    <TouchableOpacity
                      style={[styles.advanceBtn, updating && styles.advanceBtnDisabled]}
                      onPress={advanceStatus}
                      disabled={updating}
                    >
                      {updating
                        ? <ActivityIndicator color="#fff" />
                        : (
                          <Text style={styles.advanceBtnText}>
                            {ADVANCE_LABELS[next] || `Mark as ${STATUS_LABELS[next] || next}`} →
                          </Text>
                        )}
                    </TouchableOpacity>
                  );
                })()}

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

  // Delivery address — its own block, since it's what the rider reads
  addrBox: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: Colors.primarySoft, borderRadius: 11, padding: 11, marginTop: 10 },
  addrLbl: { color: Colors.primaryLight, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  addrVal: { color: Colors.textPrimary, fontSize: 13.5, marginTop: 3, lineHeight: 19 },

  noteBox : { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(245,165,36,0.09)", borderRadius: 10, padding: 10, marginTop: 9 },
  noteText: { flex: 1, color: Colors.yellow, fontSize: 12.5, lineHeight: 18 },

  // What the customer was told after the last status change
  notice     : { borderRadius: 11, borderWidth: 1, padding: 11, marginTop: 14 },
  noticeOk   : { backgroundColor: "rgba(34,197,94,0.07)", borderColor: "rgba(34,197,94,0.28)" },
  noticeWarn : { backgroundColor: "rgba(245,165,36,0.08)", borderColor: "rgba(245,165,36,0.3)" },
  noticeHead : { flexDirection: "row", alignItems: "center", gap: 7 },
  noticeTitle: { flex: 1, fontSize: 12.5, fontWeight: "700" },
  noticeBody : { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel     : { color: Colors.textSecondary, fontSize: 13 },
  infoValue     : { color: Colors.textPrimary, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },

  cartItem      : { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cartName      : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  cartCode      : { color: Colors.textMuted, fontSize: 10, fontFamily: "monospace", letterSpacing: 0.5, marginTop: 1 },
  cartMeta      : { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  cartPrice     : { color: Colors.primary, fontSize: 14, fontWeight: "700", marginLeft: 8 },

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
