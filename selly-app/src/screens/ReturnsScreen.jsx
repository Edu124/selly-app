// ── Returns Screen ─────────────────────────────────────────────────────────────
// Shows customer return / refund / complaint requests.
// Owner can approve or reject each request with an optional note.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator,
  RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchReturns, updateReturn } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// Industry-aware labels
const RETURN_LABEL = {
  product  : "Returns & Exchanges",
  education: "Refund Requests",
  tourism  : "Cancellation Requests",
  kirana   : "Return Requests",
  cakes    : "Complaints & Concerns",
  icecream : "Complaints & Concerns",
};

const STATUS_STYLE = {
  pending  : { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b",  label: "Pending"  },
  approved : { bg: "rgba(34,197,94,0.12)",   text: "#22c55e",  label: "Approved" },
  rejected : { bg: "rgba(239,68,68,0.12)",   text: "#ef4444",  label: "Rejected" },
};

function ago(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ReturnsScreen() {
  const { industry } = useAuth();
  const screenLabel  = RETURN_LABEL[industry] || "Returns";

  const [returns,    setReturns]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState("all");   // all | pending | approved | rejected
  const [selected,   setSelected]   = useState(null);
  const [ownerNote,  setOwnerNote]  = useState("");
  const [saving,     setSaving]     = useState(false);

  const load = async () => {
    try {
      const d = await fetchReturns(filter === "all" ? null : filter);
      setReturns(d.returns || []);
    } catch (e) {
      console.warn("Returns load error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [filter]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const openDetail = (item) => {
    setSelected(item);
    setOwnerNote(item.owner_note || "");
  };

  const handleDecision = async (status) => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateReturn(selected.id, status, ownerNote.trim());
      setReturns(prev => prev.map(r =>
        r.id === selected.id ? { ...r, status, owner_note: ownerNote.trim() } : r
      ));
      setSelected(null);
      Alert.alert(
        status === "approved" ? "Approved ✓" : "Rejected",
        status === "approved"
          ? "Return approved. The customer will be notified."
          : "Return rejected. Your note has been saved."
      );
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const filters = ["all", "pending", "approved", "rejected"];

  const filtered = filter === "all" ? returns : returns.filter(r => r.status === filter);

  const pendingCount = returns.filter(r => r.status === "pending").length;

  // ── Return card ───────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending;
    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.8}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>Order #{item.order_id}</Text>
            <Text style={styles.customerName}>{item.customer_name || "Customer"}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.reason}>{item.reason}</Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardBottom}>
          <Text style={styles.meta}>{item.customer_email || "no email"}</Text>
          <Text style={styles.meta}>{ago(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}
      >
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "all" ? `All ${returns.length > 0 ? `(${returns.length})` : ""}` :
               f === "pending" && pendingCount > 0 ? `Pending (${pendingCount})` :
               f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>↩</Text>
              <Text style={styles.emptyTitle}>No {filter === "all" ? "" : filter} requests</Text>
              <Text style={styles.emptyDesc}>
                {filter === "pending"
                  ? "All caught up! No pending requests."
                  : "Return / refund requests from customers will appear here."}
              </Text>
            </View>
          }
        />
      )}

      {/* Detail modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Request Details</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={{ color: Colors.textSecondary, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
              {selected && (() => {
                const st = STATUS_STYLE[selected.status] || STATUS_STYLE.pending;
                return (
                  <>
                    {/* Status */}
                    <View style={[styles.detailStatusBar, { backgroundColor: st.bg }]}>
                      <Text style={[styles.detailStatusText, { color: st.text }]}>
                        {st.label.toUpperCase()}
                      </Text>
                    </View>

                    {/* Info rows */}
                    {[
                      ["Order ID",  `#${selected.order_id}`],
                      ["Customer",  selected.customer_name || "—"],
                      ["Email",     selected.customer_email || "—"],
                      ["Reason",    selected.reason],
                      ["Submitted", ago(selected.created_at)],
                    ].map(([label, val]) => (
                      <View key={label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{label}</Text>
                        <Text style={styles.infoVal}>{val}</Text>
                      </View>
                    ))}

                    {selected.description ? (
                      <View>
                        <Text style={styles.infoLabel}>Description</Text>
                        <Text style={[styles.infoVal, { marginTop: 4, lineHeight: 20 }]}>
                          {selected.description}
                        </Text>
                      </View>
                    ) : null}

                    {/* Owner note */}
                    <View>
                      <Text style={[styles.infoLabel, { marginBottom: 8 }]}>
                        Your Note (optional — saved with decision)
                      </Text>
                      <TextInput
                        style={styles.noteInput}
                        multiline
                        numberOfLines={3}
                        placeholder="Add a note for your records..."
                        placeholderTextColor={Colors.textMuted}
                        value={ownerNote}
                        onChangeText={setOwnerNote}
                        editable={selected.status === "pending"}
                      />
                    </View>

                    {/* Approve / Reject buttons (only for pending) */}
                    {selected.status === "pending" && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.approveBtn]}
                          onPress={() => handleDecision("approved")}
                          disabled={saving}
                        >
                          <Text style={styles.approveBtnText}>
                            {saving ? "..." : "✓ Approve"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectBtn]}
                          onPress={() => handleDecision("rejected")}
                          disabled={saving}
                        >
                          <Text style={styles.rejectBtnText}>
                            {saving ? "..." : "✕ Reject"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {selected.owner_note && selected.status !== "pending" ? (
                      <View style={styles.savedNote}>
                        <Text style={styles.savedNoteLabel}>Your note:</Text>
                        <Text style={styles.savedNoteText}>{selected.owner_note}</Text>
                      </View>
                    ) : null}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  filterBar    : { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterBtn    : { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  filterText   : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: Colors.primary },

  card         : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardTop      : { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  orderId      : { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  customerName : { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  statusBadge  : { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText   : { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  reason       : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 4 },
  description  : { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  cardBottom   : { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  meta         : { color: Colors.textMuted, fontSize: 12 },

  empty        : { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon    : { fontSize: 48, marginBottom: 12 },
  emptyTitle   : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  emptyDesc    : { color: Colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 },

  overlay      : { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet        : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", minHeight: "50%" },
  sheetHeader  : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sheetTitle   : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },

  detailStatusBar  : { borderRadius: 10, padding: 10, alignItems: "center" },
  detailStatusText : { fontSize: 13, fontWeight: "800", letterSpacing: 1 },

  infoRow      : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + "66" },
  infoLabel    : { color: Colors.textMuted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  infoVal      : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", flex: 1, textAlign: "right" },

  noteInput    : { backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 14, lineHeight: 20, textAlignVertical: "top" },

  actionRow    : { flexDirection: "row", gap: 12, marginTop: 4 },
  actionBtn    : { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1.5 },
  approveBtn   : { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "#22c55e" },
  rejectBtn    : { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "#ef4444" },
  approveBtnText: { color: "#22c55e", fontSize: 15, fontWeight: "700" },
  rejectBtnText : { color: "#ef4444", fontSize: 15, fontWeight: "700" },

  savedNote    : { backgroundColor: Colors.bgCard, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  savedNoteLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
  savedNoteText : { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
