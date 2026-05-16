// ── EnrollmentsScreen ─────────────────────────────────────────────────────────
// Education industry — student enrollments (replaces OrdersScreen for education)
// Filters: All · Pending Fees · Active · Completed
// Detail: student info, course details, fees breakdown (no shipping/tracking)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchOrders, updateOrderStatus, sendMessageToCustomer, fetchCustomer } from "../lib/api";

// ── Status config ─────────────────────────────────────────────────────────────
const FILTERS = [
  { key: "all",             label: "All"           },
  { key: "pending_payment", label: "Pending Fees"  },
  { key: "confirmed",       label: "Active"        },
  { key: "in_progress",     label: "In Progress"   },  // education bot uses "in_progress"
  { key: "completed",       label: "Completed"     },  // education bot uses "completed"
];
// STATUS_FLOW uses education-native statuses (what the bot actually writes to DB)
const STATUS_FLOW   = ["pending_payment", "confirmed", "in_progress", "completed"];
const STATUS_LABELS = {
  pending_payment: "Pending Fees",
  confirmed      : "Active",
  in_progress    : "In Progress",
  completed      : "Completed",
  // also handle product-style statuses so cross-industry orders still display correctly
  shipped        : "In Progress",
  delivered      : "Completed",
  cancelled      : "Cancelled",
};
const STATUS_STYLE = {
  pending_payment: { bg: "rgba(234,179,8,0.15)",   text: "#eab308" },
  confirmed      : { bg: "rgba(34,197,94,0.15)",   text: "#22c55e" },
  in_progress    : { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6" },
  completed      : { bg: "rgba(168,85,247,0.15)",  text: "#a855f7" },
  // product-style aliases so pills render correctly if status is shipped/delivered
  shipped        : { bg: "rgba(59,130,246,0.15)",  text: "#3b82f6" },
  delivered      : { bg: "rgba(168,85,247,0.15)",  text: "#a855f7" },
  cancelled      : { bg: "rgba(239,68,68,0.15)",   text: "#ef4444" },
};

const MODE_CONFIG = {
  "Online" : { bg: "rgba(14,165,233,0.15)", text: "#0ea5e9", icon: "💻" },
  "Offline": { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", icon: "🏫" },
  "Hybrid" : { bg: "rgba(168,85,247,0.15)", text: "#a855f7", icon: "🔄" },
};

// ── Status Pill ───────────────────────────────────────────────────────────────
function Pill({ status, small }) {
  const s = STATUS_STYLE[status] || { bg: Colors.bgCard, text: Colors.textSecondary };
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }, small && styles.pillSm]}>
      <Text style={[styles.pillText, { color: s.text }, small && styles.pillTextSm]}>
        {STATUS_LABELS[status] || status}
      </Text>
    </View>
  );
}

// ── Enrollment Row ────────────────────────────────────────────────────────────
function EnrollmentRow({ item, onPress }) {
  const courseName = (item.cart || [])[0]?.name || "Unknown Course";
  const fees       = item.bill?.total || 0;
  const date       = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={styles.rowAvatar}>
        <Text style={styles.rowAvatarText}>
          {(item.name || "?").charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name || "Unknown"}</Text>
          <Text style={styles.rowFees}>₹{fees.toLocaleString("en-IN")}</Text>
        </View>
        <Text style={styles.rowCourse} numberOfLines={1}>{courseName}</Text>
        <View style={styles.rowBottom}>
          <Pill status={item.status} small />
          <Text style={styles.rowDate}>{date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Info Row (detail modal) ───────────────────────────────────────────────────
function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EnrollmentsScreen() {
  const [enrollments, setEnrollments] = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [filter,      setFilter]      = useState("all");
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [updating,    setUpdating]    = useState(false);
  const [msgVisible,  setMsgVisible]  = useState(false);
  const [msgText,     setMsgText]     = useState("");
  const [sending,     setSending]     = useState(false);

  // Fetch customer batch when a detail is opened
  useEffect(() => {
    setSelectedBatch("");
    if (selected?.customerId) {
      fetchCustomer(selected.customerId)
        .then(d => setSelectedBatch(d.customer?.batch || ""))
        .catch(() => {});
    }
  }, [selected?.id]);

  const load = async (reset = false) => {
    const p = reset ? 1 : page;
    if (reset) { setLoading(true); setPage(1); }
    try {
      const d = await fetchOrders({ status: filter === "all" ? null : filter, page: p });
      if (reset) setEnrollments(d.orders || []);
      else setEnrollments(prev => [...prev, ...(d.orders || [])]);
      setTotal(d.total || 0);
    } catch (e) {
      console.warn("Enrollments load error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(true); }, [filter]));

  const onRefresh = () => { setRefreshing(true); load(true); };
  const loadMore  = () => {
    if (enrollments.length < total) { setPage(p => p + 1); load(false); }
  };

  const filtered = search.trim()
    ? enrollments.filter(e =>
        String(e.id).includes(search) ||
        (e.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.mobile || "").includes(search)
      )
    : enrollments;

  const advanceStatus = async () => {
    if (!selected) return;
    const idx  = STATUS_FLOW.indexOf(selected.status);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    setUpdating(true);
    try {
      const updated = await updateOrderStatus(selected.id, next, {});
      setSelected(updated.order || { ...selected, status: next });
      setEnrollments(prev => prev.map(e => e.id === selected.id ? { ...e, status: next } : e));
    } catch (e) { console.warn("Update error:", e.message); }
    finally { setUpdating(false); }
  };

  const sendMsg = async () => {
    if (!selected || !msgText.trim()) return;
    setSending(true);
    try {
      await sendMessageToCustomer(selected.mobile || selected.customerId, msgText.trim());
      setMsgText("");
      setMsgVisible(false);
      Alert.alert("Sent ✓", "Message delivered to student's WhatsApp.");
    } catch (e) {
      Alert.alert("Failed", e.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student name or phone…"
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

      {/* Status filters */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.countLabel}>
        {total} enrollment{total !== 1 ? "s" : ""}
      </Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => String(e.id)}
          renderItem={({ item }) => (
            <EnrollmentRow item={item} onPress={() => setSelected(item)} />
          )}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎓</Text>
              <Text style={styles.emptyText}>No enrollments yet</Text>
            </View>
          }
        />
      )}

      {/* Send message modal */}
      <Modal visible={msgVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "50%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Message Student</Text>
              <TouchableOpacity onPress={() => setMsgVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            {selected && (
              <Text style={styles.msgRecipient}>To: {selected.name} ({selected.mobile || selected.customerId})</Text>
            )}
            <TextInput
              style={styles.msgInput}
              placeholder="Type your message…"
              placeholderTextColor={Colors.textMuted}
              value={msgText}
              onChangeText={setMsgText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.advanceBtn, (!msgText.trim() || sending) && { opacity: 0.5 }]}
              onPress={sendMsg}
              disabled={!msgText.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.advanceBtnText}>Send via WhatsApp →</Text>
              }
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </View>
        </View>
      </Modal>

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected && (() => {
              const ef      = (selected.cart || [])[0]?.extraFields || {};
              const courses = selected.cart || [];
              const bill    = selected.bill || {};
              const nextIdx = STATUS_FLOW.indexOf(selected.status);
              const next    = STATUS_FLOW[nextIdx + 1];

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Header */}
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Enrollment #{selected.id}</Text>
                    <TouchableOpacity onPress={() => setSelected(null)}>
                      <Text style={styles.closeBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <Pill status={selected.status} />

                  {/* Student info */}
                  <Text style={styles.sectionTitle}>STUDENT</Text>
                  <InfoRow label="Name"     value={selected.name} />
                  <InfoRow label="Phone"    value={selected.mobile} />
                  <InfoRow label="Class / Batch" value={selectedBatch || null} />
                  <InfoRow label="Enrolled" value={selected.createdAt
                    ? new Date(selected.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                    : null} />

                  {/* Course details */}
                  <Text style={styles.sectionTitle}>COURSE{courses.length > 1 ? "S" : ""}</Text>
                  {courses.map((c, i) => {
                    const cef  = c.extraFields || {};
                    const mode = cef.mode || ef.mode;
                    const mCfg = MODE_CONFIG[mode];
                    return (
                      <View key={i} style={styles.courseDetailCard}>
                        <Text style={styles.courseDetailName}>{c.name}</Text>
                        <View style={styles.courseDetailMeta}>
                          {mode && (
                            <View style={[styles.modeBadge, { backgroundColor: mCfg?.bg || Colors.bgCard }]}>
                              <Text style={[styles.modeBadgeText, { color: mCfg?.text || Colors.textSecondary }]}>
                                {mCfg?.icon} {mode}
                              </Text>
                            </View>
                          )}
                          {cef.duration    && <Text style={styles.detailMeta}>⏱ {cef.duration}</Text>}
                          {cef.batchTiming && <Text style={styles.detailMeta}>📅 {cef.batchTiming}</Text>}
                        </View>
                        {cef.whatIncluded ? (
                          <Text style={styles.includedText}>✓ {cef.whatIncluded}</Text>
                        ) : null}
                        {cef.classLink ? (
                          <Text style={styles.classLinkText}>🔗 {cef.classLink}</Text>
                        ) : null}
                        <Text style={styles.courseDetailPrice}>₹{(c.price || 0).toLocaleString("en-IN")}</Text>
                      </View>
                    );
                  })}

                  {/* Fees breakdown — no shipping/COD */}
                  <Text style={styles.sectionTitle}>FEES</Text>
                  <View style={styles.feesBox}>
                    {(bill.subtotal !== undefined) && (
                      <View style={styles.feesRow}>
                        <Text style={styles.feesLabel}>Course Fees</Text>
                        <Text style={styles.feesValue}>₹{(bill.subtotal || 0).toLocaleString("en-IN")}</Text>
                      </View>
                    )}
                    {bill.discount > 0 && (
                      <View style={styles.feesRow}>
                        <Text style={styles.feesLabel}>Discount</Text>
                        <Text style={[styles.feesValue, { color: Colors.green }]}>-₹{bill.discount.toLocaleString("en-IN")}</Text>
                      </View>
                    )}
                    <View style={styles.feesDivider} />
                    <View style={styles.feesRow}>
                      <Text style={[styles.feesLabel, styles.feesBold]}>Total Fees</Text>
                      <Text style={[styles.feesValue, styles.feesBold]}>₹{(bill.total || 0).toLocaleString("en-IN")}</Text>
                    </View>
                  </View>

                  {/* Advance status */}
                  {next && (
                    <TouchableOpacity
                      style={[styles.advanceBtn, updating && { opacity: 0.6 }]}
                      onPress={advanceStatus}
                      disabled={updating}
                    >
                      {updating
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.advanceBtnText}>
                            Mark as {STATUS_LABELS[next]} →
                          </Text>
                      }
                    </TouchableOpacity>
                  )}

                  {/* Send WhatsApp message to student */}
                  <TouchableOpacity
                    style={styles.msgBtn}
                    onPress={() => { setMsgText(""); setMsgVisible(true); }}
                  >
                    <Text style={styles.msgBtnText}>💬 Send WhatsApp Message</Text>
                  </TouchableOpacity>

                  <View style={{ height: 32 }} />
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: Colors.bg },
  center     : { flex: 1, alignItems: "center", justifyContent: "center" },

  searchWrap : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, margin: 16, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchIcon : { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.textPrimary, paddingVertical: 10, fontSize: 14 },
  clearBtn   : { color: Colors.textMuted, fontSize: 16, padding: 4 },

  filterScroll  : { maxHeight: 46 },
  filterContent : { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filterChip    : { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  filterText    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: Colors.primary },

  countLabel : { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list       : { padding: 16, gap: 10, paddingBottom: 32 },
  empty      : { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyIcon  : { fontSize: 44 },
  emptyText  : { color: Colors.textMuted, fontSize: 15 },

  // Enrollment row
  row       : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  rowAvatar : { width: 42, height: 42, borderRadius: 21, backgroundColor: "#6C47FF22", alignItems: "center", justifyContent: "center" },
  rowAvatarText: { color: "#6C47FF", fontWeight: "900", fontSize: 17 },
  rowBody   : { flex: 1 },
  rowTop    : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  rowName   : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  rowFees   : { color: Colors.primary, fontWeight: "800", fontSize: 14 },
  rowCourse : { color: Colors.textSecondary, fontSize: 12, marginBottom: 6 },
  rowBottom : { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowDate   : { color: Colors.textMuted, fontSize: 11 },

  // Status pill
  pill      : { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start", marginBottom: 16 },
  pillSm    : { paddingHorizontal: 8, paddingVertical: 3 },
  pillText  : { fontWeight: "700", fontSize: 13 },
  pillTextSm: { fontSize: 11 },

  // Modal
  modalOverlay : { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet   : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%" },
  modalHandle  : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader  : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle   : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  closeBtn     : { color: Colors.textSecondary, fontSize: 20, padding: 4 },
  sectionTitle : { color: Colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 18, marginBottom: 8 },

  infoRow    : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel  : { color: Colors.textSecondary, fontSize: 13 },
  infoValue  : { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },

  // Course detail card
  courseDetailCard  : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  courseDetailName  : { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", marginBottom: 6 },
  courseDetailMeta  : { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  modeBadge         : { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modeBadgeText     : { fontSize: 11, fontWeight: "700" },
  detailMeta        : { color: Colors.textSecondary, fontSize: 12, backgroundColor: Colors.bgInput, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  includedText      : { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  classLinkText     : { color: "#3b82f6", fontSize: 12, marginBottom: 6 },
  courseDetailPrice : { color: Colors.primary, fontSize: 15, fontWeight: "800" },

  // Fees box
  feesBox    : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14 },
  feesRow    : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  feesLabel  : { color: Colors.textSecondary, fontSize: 13 },
  feesValue  : { color: Colors.textPrimary, fontSize: 13 },
  feesBold   : { fontWeight: "800", fontSize: 15, color: Colors.textPrimary },
  feesDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },

  advanceBtn     : { backgroundColor: "#6C47FF", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  advanceBtnText : { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Send message
  msgBtn         : { borderWidth: 1.5, borderColor: "#25D366", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  msgBtnText     : { color: "#25D366", fontWeight: "700", fontSize: 14 },
  msgRecipient   : { color: Colors.textSecondary, fontSize: 13, marginBottom: 10, paddingHorizontal: 4 },
  msgInput       : { backgroundColor: Colors.bgInput, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, color: Colors.textPrimary, padding: 12, fontSize: 14, minHeight: 90, marginBottom: 12 },
});
