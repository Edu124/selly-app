// ── Query Inbox Screen ─────────────────────────────────────────────────────────
// Shows all customer text queries. Owner can reply — bot DMs them back via WA.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator,
  RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchQueries, replyToQuery } from "../lib/api";

const TYPE_LABELS = { query: "Query", product_request: "Product Request" };
const TYPE_EMOJI  = { query: "💬", product_request: "📦" };

export default function QueryInboxScreen() {
  const [queries, setQueries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending]     = useState(false);
  const [filter, setFilter]       = useState("all"); // "all" | "pending" | "replied"

  const load = async () => {
    try {
      const r = await fetchQueries();
      setQueries(r.queries || []);
    } catch (e) {
      console.warn("Queries load error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

  const openDetail = (item) => {
    setSelected(item);
    setReplyText("");
  };

  const sendReply = async () => {
    if (!replyText.trim()) { Alert.alert("Reply required", "Type a message to send."); return; }
    setSending(true);
    try {
      await replyToQuery(selected.id, replyText.trim());
      setQueries(prev => prev.map(q =>
        q.id === selected.id ? { ...q, status: "replied", owner_reply: replyText.trim() } : q
      ));
      setSelected(null);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSending(false);
    }
  };

  const displayed = queries.filter(q => {
    if (filter === "pending") return q.status === "pending";
    if (filter === "replied") return q.status === "replied";
    return true;
  });

  const pendingCount = queries.filter(q => q.status === "pending").length;

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <StatChip label="Total"   value={queries.length}                   color={Colors.primary} />
        <StatChip label="Pending" value={pendingCount}                     color={Colors.yellow}  />
        <StatChip label="Replied" value={queries.length - pendingCount}    color={Colors.green}   />
      </View>

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {["all", "pending", "replied"].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, filter === t && styles.tabActive]}
            onPress={() => setFilter(t)}
          >
            <Text style={[styles.tabText, filter === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={q => q.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.8}>
              <View style={styles.cardRow}>
                <View style={styles.emojiWrap}>
                  <Text style={styles.typeEmoji}>{TYPE_EMOJI[item.type] || "💬"}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {item.customer_name || item.customer_id?.slice(0, 12) + "..."}
                    </Text>
                    <View style={[styles.badge, item.status === "pending" ? styles.badgePending : styles.badgeReplied]}>
                      <Text style={[styles.badgeText, item.status === "pending" ? { color: Colors.yellow } : { color: Colors.green }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.typeLabel}>{TYPE_LABELS[item.type] || "Query"}</Text>
                  <Text style={styles.messagePreview} numberOfLines={2}>{item.message}</Text>
                  <Text style={styles.timeText}>
                    {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>
                {filter === "pending" ? "No pending queries!" : "No queries yet."}
              </Text>
              <Text style={styles.emptyDesc}>
                When customers send questions or requests, they'll appear here for you to reply.
              </Text>
            </View>
          }
        />
      )}

      {/* Detail / Reply Modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Customer Query</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Customer info */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>From</Text>
                  <Text style={styles.infoValue}>{selected.customer_name || selected.customer_id}</Text>
                  <Text style={styles.infoLabel}>Type</Text>
                  <Text style={styles.infoValue}>{TYPE_LABELS[selected.type] || "Query"}</Text>
                  <Text style={styles.infoLabel}>Received</Text>
                  <Text style={styles.infoValue}>{new Date(selected.created_at).toLocaleString("en-IN")}</Text>
                </View>

                {/* Message bubble */}
                <View style={styles.msgBubble}>
                  <Text style={styles.msgText}>{selected.message}</Text>
                </View>

                {selected.status === "replied" ? (
                  <View style={styles.repliedBox}>
                    <Text style={styles.repliedLabel}>✅ Already replied:</Text>
                    <Text style={styles.repliedText}>{selected.owner_reply}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.sectionTitle}>Your Reply</Text>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Type your reply to this customer..."
                      placeholderTextColor={Colors.textMuted}
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                      numberOfLines={4}
                    />
                    <TouchableOpacity
                      style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                      onPress={sendReply}
                      disabled={sending}
                    >
                      {sending
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.sendBtnText}>Send Reply via WhatsApp 💬</Text>
                      }
                    </TouchableOpacity>
                  </>
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

function StatChip({ label, value, color }) {
  return (
    <View style={[styles.statChip, { borderColor: color + "44" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: Colors.bg },
  center     : { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },

  statsRow   : { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 8 },
  statChip   : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  statValue  : { fontSize: 22, fontWeight: "900" },
  statLabel  : { color: Colors.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },

  tabs       : { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab        : { flex: 1, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  tabActive  : { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  tabText    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: Colors.primary },

  list       : { padding: 16, gap: 10, paddingBottom: 32 },

  card       : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  cardRow    : { flexDirection: "row", gap: 12 },
  emojiWrap  : { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.bgInput, alignItems: "center", justifyContent: "center" },
  typeEmoji  : { fontSize: 22 },
  cardInfo   : { flex: 1 },
  cardTopRow : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  customerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  badge      : { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePending: { backgroundColor: "rgba(234,179,8,0.15)" },
  badgeReplied: { backgroundColor: "rgba(34,197,94,0.15)" },
  badgeText  : { fontSize: 11, fontWeight: "700" },
  typeLabel  : { color: Colors.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 3 },
  messagePreview: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  timeText   : { color: Colors.textMuted, fontSize: 11, marginTop: 4 },

  empty      : { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon  : { fontSize: 48, marginBottom: 12 },
  emptyText  : { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  emptyDesc  : { color: Colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalSheet  : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%" },
  modalHandle : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  closeBtn    : { color: Colors.textSecondary, fontSize: 18, padding: 4 },

  infoBox     : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 14, gap: 4 },
  infoLabel   : { color: Colors.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  infoValue   : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 6 },

  msgBubble   : { backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  msgText     : { color: Colors.textPrimary, fontSize: 15, lineHeight: 22 },

  repliedBox  : { backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" },
  repliedLabel: { color: Colors.green, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  repliedText : { color: Colors.textPrimary, fontSize: 14 },

  sectionTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  replyInput  : { backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border, textAlignVertical: "top", minHeight: 100, marginBottom: 12 },

  sendBtn     : { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 4 },
  sendBtnText : { color: "#fff", fontWeight: "800", fontSize: 15 },
});
