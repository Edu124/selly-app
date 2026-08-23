// ── Complaints Screen ─────────────────────────────────────────────────────────
// Complaints raised by customers, mostly from the WhatsApp thread right after
// delivery. Resolving one records the outcome AND messages the customer back in
// the same thread — that second half is what decides whether they order again.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator,
  RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchComplaints, resolveComplaint } from "../lib/api";
import { tplComplaintResolved, inr } from "../lib/whatsapp";
import { deliver, isReachable } from "../lib/messaging";
import { friendlyError } from "../lib/errors";
import { useAuth } from "../context/AuthContext";
import { typeConfig } from "../lib/businessTypes";

// Food businesses don't take returns — they field complaints and issue refunds.
const RETURN_LABEL = {
  cafe        : "Complaints & Refunds",
  bakery      : "Complaints & Refunds",
  cloudkitchen: "Complaints & Refunds",
};

// You cannot return a biryani. The outcomes that mean something for food are
// money back, credit against the next order, or cooking it again.
const RESOLUTIONS = [
  { key: "refund",  status: "approved", label: "Refund",  hint: "Money back",
    doneTitle: "Refund recorded", doneBody: "Marked for refund." },
  { key: "credit",  status: "approved", label: "Credit",  hint: "Off next order",
    doneTitle: "Credit recorded", doneBody: "Credit added for their next order." },
  { key: "remake",  status: "approved", label: "Remake",  hint: "Cook it again",
    doneTitle: "Remake recorded", doneBody: "Marked to cook again, no charge." },
  { key: "decline", status: "rejected", label: "Decline", hint: "With a reason",
    doneTitle: "Declined",        doneBody: "Declined and your note saved." },
];

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
  const screenLabel  = RETURN_LABEL[typeConfig(industry).id] || "Complaints & Refunds";

  const [returns,    setReturns]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState("all");   // all | pending | approved | rejected
  const [selected,   setSelected]   = useState(null);
  const [ownerNote,  setOwnerNote]  = useState("");
  const [saving,     setSaving]     = useState(false);

  const load = async () => {
    try {
      // Now a plain array from Supabase, where the Railway endpoint returned
      // { returns: [...] }. Both shapes accepted so a stale cache can't blank it.
      const d = await fetchComplaints(filter === "all" ? null : filter);
      setReturns(Array.isArray(d) ? d : (d && d.returns) || []);
    } catch (e) {
      console.warn("Complaints load error:", e.message);
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

  // Resolving a complaint does two things: it records the outcome, and it tells
  // the customer in the thread they complained in. The second half is the part
  // that decides whether they order again, so a failure to send is surfaced
  // rather than swallowed behind a cheerful "they have been notified".
  const handleDecision = async (res) => {
    if (!selected) return;
    setSaving(true);
    const note = ownerNote.trim();
    try {
      await resolveComplaint(selected.id, {
        status: res.status, resolution: res.key, note, amount: selected.order_total,
      });
      setReturns(prev => prev.map(r =>
        r.id === selected.id
          ? { ...r, status: res.status, owner_note: note, resolution: res.key }
          : r
      ));

      // The complaint carries the mobile number, which is all anyone needs to
      // reach someone. Unlike the old path it does not require the WhatsApp bot
      // to have created the customer first, so a complaint about a manually
      // entered order can actually be answered.
      let told = "";
      if (isReachable(selected)) {
        const out = await deliver({
          mobile : selected.mobile,
          channel: selected.preferred_channel || "whatsapp",
          text   : tplComplaintResolved({
            order     : { id: selected.order_id },
            resolution: res.key,
            note,
            amount    : selected.order_total,
          }),
        });
        told = out.ok
          ? `\n\nThe message to ${selected.name || "the customer"} is ready to send.`
          : `\n\nSaved, but the message could not be opened: ${out.error}`;
      } else {
        told = "\n\nNo mobile number on this complaint, so nothing was sent.";
      }

      setSelected(null);
      Alert.alert(res.doneTitle, res.doneBody + told);
    } catch (e) {
      Alert.alert("Error", friendlyError(e));
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
            <Text style={styles.orderId}>Order #{String(item.order_id || "").slice(-5)}</Text>
            <Text style={styles.customerName}>{item.customer_name || "Customer"}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.reason}>
          {item.reason}
          {item.resolution ? <Text style={styles.resTag}>{"  ·  " + item.resolution}</Text> : null}
        </Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardBottom}>
          <Text style={styles.meta}>{item.mobile || item.customer_email || "no contact"}</Text>
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
                      ["Order",     selected.order_id ? `#${String(selected.order_id).slice(-5)}` : "—"],
                      ["Customer",  selected.customer_name || "—"],
                      ["Phone",     selected.mobile || selected.customer_email || "—"],
                      // What the order was worth decides what a refund costs.
                      ["Order value", selected.order_total ? inr(selected.order_total) : "—"],
                      ["Kitchen",   selected.kitchen || "—"],
                      ["Reason",    selected.reason],
                      ["Raised",    ago(selected.created_at)],
                      ...(selected.resolution ? [["Outcome", selected.resolution]] : []),
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

                    {/* How this gets put right. Each one sends a different
                        message to the customer, so the choice is the reply. */}
                    {selected.status === "pending" && (
                      <View>
                        <Text style={[styles.infoLabel, { marginBottom: 8 }]}>
                          Put it right
                        </Text>
                        <View style={styles.resGrid}>
                          {RESOLUTIONS.map(r => (
                            <TouchableOpacity
                              key={r.key}
                              style={[styles.resBtn, r.key === "decline" && styles.resBtnDecline]}
                              onPress={() => handleDecision(r)}
                              disabled={saving}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.resLabel, r.key === "decline" && { color: Colors.red }]}>
                                {saving ? "…" : r.label}
                              </Text>
                              <Text style={styles.resHint}>{r.hint}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {!selected.customer_id && (
                          <Text style={styles.noWaWarn}>
                            No WhatsApp number on this one — the outcome will be
                            recorded, but nothing will be sent to the customer.
                          </Text>
                        )}
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

  // Four outcomes, two up — thumb-sized, since this gets used mid-service.
  resGrid      : { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  resBtn       : { flexBasis: "47%", flexGrow: 1, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.green, backgroundColor: "rgba(34,197,94,0.10)" },
  resBtnDecline: { borderColor: Colors.red, backgroundColor: "rgba(239,68,68,0.09)" },
  resLabel     : { color: Colors.green, fontSize: 15, fontWeight: "800" },
  resHint      : { color: Colors.textMuted, fontSize: 11.5, marginTop: 2 },
  noWaWarn     : { color: Colors.yellow, fontSize: 11.5, lineHeight: 16, marginTop: 10 },

  resTag       : { color: Colors.primaryLight, fontWeight: "700" },

  savedNote    : { backgroundColor: Colors.bgCard, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  savedNoteLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
  savedNoteText : { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
