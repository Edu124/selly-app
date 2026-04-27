// ── Photo Inquiries Screen ─────────────────────────────────────────────────────
// Shows customer photo search requests — owner replies and bot DMs them back
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator,
  RefreshControl, Image, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchInquiries, replyToInquiry, fetchCatalog } from "../lib/api";

export default function PhotoInquiriesScreen() {
  const [inquiries, setInquiries]   = useState([]);
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]     = useState(null);   // inquiry in detail modal
  const [replyText, setReplyText]   = useState("");
  const [linkedProd, setLinkedProd] = useState(null);   // optional product to link
  const [sending, setSending]       = useState(false);
  const [pickProd, setPickProd]     = useState(false);  // product picker modal
  const [filter, setFilter]         = useState("all");  // "all" | "pending" | "replied"

  const load = async () => {
    try {
      const [iq, cat] = await Promise.all([fetchInquiries(), fetchCatalog()]);
      setInquiries(iq.inquiries || []);
      setProducts(cat.products || []);
    } catch (e) {
      console.warn("Inquiries load error:", e.message);
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
    setLinkedProd(null);
  };

  const sendReply = async () => {
    if (!replyText.trim()) { Alert.alert("Reply required", "Type a message to send."); return; }
    setSending(true);
    try {
      await replyToInquiry(selected.id, replyText.trim(), linkedProd?.id || null);
      // Update local state
      setInquiries(prev => prev.map(i =>
        i.id === selected.id ? { ...i, status: "replied", owner_reply: replyText.trim() } : i
      ));
      setSelected(null);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSending(false);
    }
  };

  const displayed = inquiries.filter(i => {
    if (filter === "pending") return i.status === "pending";
    if (filter === "replied") return i.status === "replied";
    return true;
  });

  const pendingCount = inquiries.filter(i => i.status === "pending").length;

  return (
    <View style={styles.container}>
      {/* Header counts */}
      <View style={styles.statsRow}>
        <StatChip label="Total"    value={inquiries.length}  color={Colors.primary} />
        <StatChip label="Pending"  value={pendingCount}       color={Colors.yellow}  />
        <StatChip label="Replied"  value={inquiries.length - pendingCount} color={Colors.green} />
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
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.8}>
              <View style={styles.cardRow}>
                {/* Thumbnail */}
                <View style={styles.thumbWrap}>
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                </View>
                {/* Info */}
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
                  <Text style={styles.timeText}>
                    {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  {item.owner_reply ? (
                    <Text style={styles.replyPreview} numberOfLines={1}>✉️ {item.owner_reply}</Text>
                  ) : (
                    <Text style={styles.pendingNote}>Tap to reply →</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📷</Text>
              <Text style={styles.emptyText}>
                {filter === "pending" ? "No pending inquiries!" : "No photo inquiries yet."}
              </Text>
              <Text style={styles.emptyDesc}>
                When customers send photos searching for products, they'll appear here.
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
                  <Text style={styles.modalTitle}>Photo Inquiry</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Customer photo */}
                <Image
                  source={{ uri: selected.image_url }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />

                {/* Customer info */}
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>From</Text>
                  <Text style={styles.infoValue}>
                    {selected.customer_name || selected.customer_id}
                  </Text>
                  <Text style={styles.infoLabel}>Received</Text>
                  <Text style={styles.infoValue}>
                    {new Date(selected.created_at).toLocaleString("en-IN")}
                  </Text>
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

                    {/* Optional: link a product */}
                    <TouchableOpacity style={styles.linkProdBtn} onPress={() => setPickProd(true)}>
                      <Text style={styles.linkProdText}>
                        {linkedProd ? `🛍️ Linked: ${linkedProd.name}` : "🛍️ Link a product (optional)"}
                      </Text>
                    </TouchableOpacity>
                    {linkedProd && (
                      <TouchableOpacity onPress={() => setLinkedProd(null)}>
                        <Text style={styles.unlinkText}>✕ Remove product link</Text>
                      </TouchableOpacity>
                    )}

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

      {/* Product picker modal */}
      <Modal visible={pickProd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Link a Product</Text>
              <TouchableOpacity onPress={() => setPickProd(false)}>
                <Text style={styles.closeBtn}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={products}
              keyExtractor={p => String(p.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickItem, linkedProd?.id === item.id && styles.pickItemActive]}
                  onPress={() => { setLinkedProd(item); setPickProd(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName}>{item.name}</Text>
                    <Text style={styles.pickPrice}>₹{(item.price || 0).toLocaleString("en-IN")}</Text>
                  </View>
                  {linkedProd?.id === item.id && <Text style={{ color: Colors.green, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
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
  thumbWrap  : { width: 72, height: 72, borderRadius: 10, overflow: "hidden", backgroundColor: Colors.bgInput },
  thumb      : { width: 72, height: 72 },
  cardInfo   : { flex: 1, justifyContent: "space-between" },
  cardTopRow : { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  customerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  badge      : { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePending: { backgroundColor: "rgba(234,179,8,0.15)" },
  badgeReplied: { backgroundColor: "rgba(34,197,94,0.15)" },
  badgeText  : { fontSize: 11, fontWeight: "700" },
  timeText   : { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  replyPreview: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  pendingNote: { color: Colors.primary, fontSize: 12, marginTop: 4, fontWeight: "600" },

  empty      : { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon  : { fontSize: 48, marginBottom: 12 },
  emptyText  : { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  emptyDesc  : { color: Colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalSheet  : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%" },
  modalHandle : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  closeBtn    : { color: Colors.textSecondary, fontSize: 18, padding: 4 },

  fullImage   : { width: "100%", height: 240, borderRadius: 14, backgroundColor: Colors.bgInput, marginBottom: 16 },

  infoBox     : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginBottom: 16, gap: 4 },
  infoLabel   : { color: Colors.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  infoValue   : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600", marginBottom: 6 },

  repliedBox  : { backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)" },
  repliedLabel: { color: Colors.green, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  repliedText : { color: Colors.textPrimary, fontSize: 14 },

  sectionTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  replyInput  : { backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border, textAlignVertical: "top", minHeight: 100, marginBottom: 12 },

  linkProdBtn : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center", marginBottom: 6 },
  linkProdText: { color: Colors.primary, fontWeight: "600", fontSize: 13 },
  unlinkText  : { color: Colors.red, fontSize: 12, textAlign: "center", marginBottom: 12 },

  sendBtn     : { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  sendBtnText : { color: "#fff", fontWeight: "800", fontSize: 15 },

  pickItem    : { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.primary + "15" },
  pickName    : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  pickPrice   : { color: Colors.primary, fontSize: 12, fontWeight: "700", marginTop: 2 },
});
