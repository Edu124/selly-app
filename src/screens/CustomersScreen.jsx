import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { Colors } from "../constants/colors";
import { fetchCustomers } from "../lib/api";

const TAG_COLORS = {
  vip       : { bg: "#2d1535", text: "#ff6b9d" },
  frequent  : { bg: "#0f1f2d", text: "#3b82f6" },
  referrer  : { bg: "#0f2d1a", text: "#22c55e" },
  new       : { bg: "#13131a", text: "#8888aa" },
};

export default function CustomersScreen() {
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(null);
  const [copied, setCopied]         = useState(false);
  const [filterTag, setFilterTag]   = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchCustomers();
      setCustomers(d.customers || []);
    } catch (e) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const copyReferral = async (code) => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tags = ["all", "vip", "frequent", "referrer"];

  const filtered = customers.filter(c => {
    const matchSearch = !search.trim() ||
      (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.igUsername || "").toLowerCase().includes(search.toLowerCase());
    const matchTag = filterTag === "all" || (c.tags || []).includes(filterTag);
    return matchSearch && matchTag;
  });

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Text>🔍 </Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or @username…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Tag filters */}
      <View style={styles.tagsRow}>
        {tags.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tagChip, filterTag === t && styles.tagChipActive]}
            onPress={() => setFilterTag(t)}
          >
            <Text style={[styles.tagChipText, filterTag === t && styles.tagChipTextActive]}>
              {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.countLabel}>{filtered.length} customers</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text style={styles.customerName}>{item.name || "Unknown"}</Text>
                  <Text style={styles.orderCount}>{item.orderCount || 0} orders</Text>
                </View>
                {item.igUsername && (
                  <Text style={styles.igHandle}>@{item.igUsername}</Text>
                )}
                <View style={styles.tagsWrap}>
                  {(item.tags || []).map(tag => (
                    <View key={tag} style={[styles.tagBadge, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.bgCard }]}>
                      <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.textSecondary }]}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No customers yet</Text></View>}
        />
      )}

      {/* Customer detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selected.name || "Customer"}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Avatar */}
                <View style={styles.bigAvatar}>
                  <Text style={styles.bigAvatarText}>
                    {(selected.name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Tags */}
                <View style={[styles.tagsWrap, { justifyContent: "center", marginBottom: 20 }]}>
                  {(selected.tags || []).map(tag => (
                    <View key={tag} style={[styles.tagBadge, { backgroundColor: TAG_COLORS[tag]?.bg || Colors.bgCard }]}>
                      <Text style={[styles.tagText, { color: TAG_COLORS[tag]?.text || Colors.textSecondary }]}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <InfoRow label="Instagram" value={selected.igUsername ? `@${selected.igUsername}` : null} />
                <InfoRow label="Phone"     value={selected.mobile} />
                <InfoRow label="Member since" value={selected.createdAt ? new Date(selected.createdAt).toLocaleDateString("en-IN") : null} />

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <StatBox label="Orders"   value={selected.orderCount || 0} />
                  <StatBox label="Spent"    value={`₹${(selected.totalSpent || 0).toLocaleString("en-IN")}`} />
                  <StatBox label="Referrals" value={selected.referralCount || 0} />
                </View>

                {/* Referral code */}
                {selected.referralCode && (
                  <View style={styles.referralBox}>
                    <Text style={styles.referralLabel}>Referral Code</Text>
                    <TouchableOpacity
                      style={styles.referralCode}
                      onPress={() => copyReferral(selected.referralCode)}
                    >
                      <Text style={styles.referralCodeText}>{selected.referralCode}</Text>
                      <Text style={styles.copyIcon}>{copied ? "✓" : "📋"}</Text>
                    </TouchableOpacity>
                    <Text style={styles.referralEarnings}>
                      Earned: ₹{(selected.referralEarnings || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
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

function StatBox({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: Colors.bg },
  center      : { flex: 1, alignItems: "center", justifyContent: "center" },
  searchWrap  : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, margin: 16, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput : { flex: 1, color: Colors.textPrimary, paddingVertical: 10, fontSize: 14 },
  tagsRow     : { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tagChip     : { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  tagChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  tagChipText : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  tagChipTextActive: { color: Colors.primary },
  countLabel  : { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list        : { padding: 16, gap: 10, paddingBottom: 32 },
  empty       : { alignItems: "center", paddingTop: 60 },
  emptyText   : { color: Colors.textMuted, fontSize: 15 },

  card        : { backgroundColor: Colors.bgCard, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: Colors.border },
  avatar      : { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "33", alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarText  : { color: Colors.primary, fontWeight: "800", fontSize: 18 },
  cardBody    : { flex: 1 },
  cardRow     : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  customerName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  orderCount  : { color: Colors.textSecondary, fontSize: 12 },
  igHandle    : { color: Colors.accent, fontSize: 12, marginBottom: 4 },
  tagsWrap    : { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tagBadge    : { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tagText     : { fontSize: 11, fontWeight: "700" },
  chevron     : { color: Colors.textMuted, fontSize: 20, marginLeft: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet  : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%" },
  modalHandle : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle  : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  closeBtn    : { color: Colors.textSecondary, fontSize: 20, padding: 4 },

  bigAvatar   : { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary + "33", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 12 },
  bigAvatarText: { color: Colors.primary, fontWeight: "900", fontSize: 32 },

  infoRow     : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel   : { color: Colors.textSecondary, fontSize: 13 },
  infoValue   : { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },

  statsRow    : { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 8 },
  statBox     : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  statValue   : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", marginBottom: 2 },
  statLabel   : { color: Colors.textSecondary, fontSize: 11 },

  referralBox : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.primary + "33" },
  referralLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 8 },
  referralCode: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary + "22", borderRadius: 8, padding: 10 },
  referralCodeText: { color: Colors.primary, fontWeight: "800", fontSize: 16, letterSpacing: 2 },
  copyIcon    : { fontSize: 18 },
  referralEarnings: { color: Colors.green, fontSize: 12, marginTop: 8, fontWeight: "600" },
});
