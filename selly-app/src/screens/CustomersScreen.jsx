import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import { fetchCustomers, importContacts } from "../lib/api";

// ── Industry configuration ────────────────────────────────────────────────────
const CUSTOMER_CONFIG = {
  product: {
    personLabel   : "Customer",
    personLabelPlural: "customers",
    emptyText     : "No customers yet",
    searchPlaceholder: "Search by name or @username…",
    orderCountLabel  : (n) => `${n} order${n !== 1 ? "s" : ""}`,
    filters: [
      { key: "all",      label: "All"       },
      { key: "vip",      label: "⭐ VIP"    },
      { key: "frequent", label: "🔁 Frequent" },
      { key: "referrer", label: "🎁 Referrer" },
      { key: "new",      label: "🆕 New"     },
    ],
    // stat box labels in detail modal
    stat1Label: "Orders",
    stat2Label: "Spent",
    stat3Label: "Referrals",
    stat3Key  : "referralCount",
    showReferral: true,
    showIg      : true,
  },
  education: {
    personLabel      : "Student",
    personLabelPlural: "students",
    emptyText        : "No students yet",
    searchPlaceholder: "Search by name or phone…",
    orderCountLabel  : (n) => `${n} course${n !== 1 ? "s" : ""} enrolled`,
    filters: [
      { key: "all",         label: "All"           },
      { key: "online",      label: "💻 Online"      },
      { key: "offline",     label: "🏫 Offline"     },
      { key: "active",      label: "✅ Active"      },
      { key: "completed",   label: "🏆 Completed"   },
      { key: "vip",         label: "⭐ VIP"         },
    ],
    stat1Label  : "Courses",
    stat2Label  : "Fees Paid",
    stat3Label  : "Completed",
    stat3Key    : "completedCount",
    showReferral: false,
    showIg      : false,
  },
  tourism: {
    personLabel      : "Traveler",
    personLabelPlural: "travelers",
    emptyText        : "No travelers yet",
    searchPlaceholder: "Search by name or phone…",
    orderCountLabel  : (n) => `${n} trip${n !== 1 ? "s" : ""} booked`,
    filters: [
      { key: "all",       label: "All"              },
      { key: "frequent",  label: "🔁 Repeat Traveler" },
      { key: "honeymoon", label: "💑 Honeymoon"      },
      { key: "adventure", label: "🏔️ Adventure"      },
      { key: "family",    label: "👨‍👩‍👧 Family"         },
      { key: "corporate", label: "💼 Corporate"      },
      { key: "vip",       label: "⭐ VIP"            },
    ],
    stat1Label  : "Trips",
    stat2Label  : "Total Spent",
    stat3Label  : "Referrals",
    stat3Key    : "referralCount",
    showReferral: false,
    showIg      : false,
  },
  kirana: {
    personLabel      : "Customer",
    personLabelPlural: "customers",
    emptyText        : "No customers yet",
    searchPlaceholder: "Search by name or phone…",
    orderCountLabel  : (n) => `${n} order${n !== 1 ? "s" : ""}`,
    filters: [
      { key: "all",     label: "All"             },
      { key: "daily",   label: "📅 Daily Regular" },
      { key: "weekly",  label: "📆 Weekly"        },
      { key: "new",     label: "🆕 New"           },
      { key: "vip",     label: "⭐ VIP"           },
    ],
    stat1Label  : "Orders",
    stat2Label  : "Total Spent",
    stat3Label  : "Referrals",
    stat3Key    : "referralCount",
    showReferral: true,
    showIg      : false,
  },
  cakes: {
    personLabel      : "Customer",
    personLabelPlural: "customers",
    emptyText        : "No customers yet",
    searchPlaceholder: "Search by name or phone…",
    orderCountLabel  : (n) => `${n} cake order${n !== 1 ? "s" : ""}`,
    filters: [
      { key: "all",       label: "All"            },
      { key: "birthday",  label: "🎂 Birthday"    },
      { key: "wedding",   label: "💒 Wedding"     },
      { key: "corporate", label: "💼 Corporate"   },
      { key: "regular",   label: "🔁 Regular"     },
      { key: "vip",       label: "⭐ VIP"         },
    ],
    stat1Label  : "Orders",
    stat2Label  : "Total Spent",
    stat3Label  : "Referrals",
    stat3Key    : "referralCount",
    showReferral: true,
    showIg      : false,
  },
  icecream: {
    personLabel      : "Customer",
    personLabelPlural: "customers",
    emptyText        : "No customers yet",
    searchPlaceholder: "Search by name or phone…",
    orderCountLabel  : (n) => `${n} order${n !== 1 ? "s" : ""}`,
    filters: [
      { key: "all",     label: "All"          },
      { key: "regular", label: "🔁 Regular"   },
      { key: "bulk",    label: "📦 Bulk Order" },
      { key: "vip",     label: "⭐ VIP"       },
      { key: "new",     label: "🆕 New"       },
    ],
    stat1Label  : "Orders",
    stat2Label  : "Total Spent",
    stat3Label  : "Referrals",
    stat3Key    : "referralCount",
    showReferral: true,
    showIg      : false,
  },
};

// Tag badge colors — shared + industry-specific
const TAG_COLORS = {
  vip      : { bg: "#2d1535", text: "#ff6b9d"  },
  frequent : { bg: "#0f1f2d", text: "#3b82f6"  },
  referrer : { bg: "#0f2d1a", text: "#22c55e"  },
  new      : { bg: "#13131a", text: "#8888aa"  },
  // Education
  online   : { bg: "#0d1f2d", text: "#38bdf8"  },
  offline  : { bg: "#1a1508", text: "#f59e0b"  },
  active   : { bg: "#0f2d1a", text: "#22c55e"  },
  completed: { bg: "#1a0d2d", text: "#a78bfa"  },
  // Tourism
  honeymoon: { bg: "#2d0f1f", text: "#f472b6"  },
  adventure: { bg: "#1a1508", text: "#fb923c"  },
  family   : { bg: "#0f1f2d", text: "#60a5fa"  },
  corporate: { bg: "#13131a", text: "#94a3b8"  },
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CustomersScreen() {
  const { industry } = useAuth();
  const cfg = CUSTOMER_CONFIG[industry] || CUSTOMER_CONFIG.product;

  const [customers,   setCustomers]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState(null);
  const [copied,      setCopied]      = useState(false);
  const [filterTag,   setFilterTag]   = useState("all");

  // ── Import contacts state ────────────────────────────────────────────────────
  const [importModal,   setImportModal]   = useState(false);
  const [importTab,     setImportTab]     = useState("single"); // "single" | "bulk"
  const [singleName,    setSingleName]    = useState("");
  const [singlePhone,   setSinglePhone]   = useState("");
  const [bulkText,      setBulkText]      = useState("");
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null);

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

  useFocusEffect(useCallback(() => {
    setFilterTag("all"); // reset filter when switching industry
    load();
  }, [industry]));

  const copyReferral = async (code) => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Import handlers ──────────────────────────────────────────────────────────
  const doImport = async (contacts) => {
    if (!contacts.length) return;
    setImporting(true);
    setImportResult(null);
    try {
      const d = await importContacts(contacts);
      setImportResult({ ok: true, msg: `✅ ${d.imported} ${cfg.personLabelPlural} added!${d.skipped ? `  (${d.skipped} skipped — invalid number)` : ""}` });
      setSingleName(""); setSinglePhone(""); setBulkText("");
      load(); // refresh list
    } catch (e) {
      setImportResult({ ok: false, msg: "Error: " + e.message });
    } finally {
      setImporting(false);
    }
  };

  const importSingle = () => {
    const phone = singlePhone.replace(/[^0-9]/g, "");
    if (phone.length < 10) { setImportResult({ ok: false, msg: "Enter a valid 10-digit number." }); return; }
    doImport([{ name: singleName.trim() || "Contact", phone }]);
  };

  const importBulk = () => {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    const contacts = lines.map(line => {
      // Support formats: "Name, Phone" / "Name Phone" / just "Phone"
      const comma = line.indexOf(",");
      if (comma > -1) {
        return { name: line.slice(0, comma).trim(), phone: line.slice(comma + 1).trim() };
      }
      // Try to split on last whitespace-group that looks like a phone number
      const parts = line.split(/\s+/);
      const lastPart = parts[parts.length - 1];
      if (/^[+0-9\s-]{9,15}$/.test(lastPart) && parts.length > 1) {
        return { name: parts.slice(0, -1).join(" "), phone: lastPart };
      }
      return { name: "", phone: line };
    });
    if (!contacts.length) { setImportResult({ ok: false, msg: "No valid lines found." }); return; }
    doImport(contacts);
  };

  const filtered = customers.filter(c => {
    const matchSearch = !search.trim() ||
      (c.name     || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.igUsername || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.mobile   || "").includes(search);
    const matchTag = filterTag === "all" || (c.tags || []).includes(filterTag);
    return matchSearch && matchTag;
  });

  return (
    <View style={styles.container}>
      {/* Search + Import button row */}
      <View style={styles.topRow}>
        <View style={[styles.searchWrap, { flex: 1, marginRight: 8 }]}>
          <Text>🔍 </Text>
          <TextInput
            style={styles.searchInput}
            placeholder={cfg.searchPlaceholder}
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
        <TouchableOpacity style={styles.addContactBtn} onPress={() => { setImportResult(null); setImportModal(true); }}>
          <Text style={styles.addContactBtnText}>➕ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips — scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {cfg.filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filterTag === f.key && styles.filterChipActive]}
            onPress={() => setFilterTag(f.key)}
          >
            <Text style={[styles.filterText, filterTag === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.countLabel}>
        {filtered.length} {cfg.personLabelPlural}
      </Text>

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
                  <Text style={styles.customerName} numberOfLines={1}>{item.name || "Unknown"}</Text>
                  <Text style={styles.orderCount}>{cfg.orderCountLabel(item.orderCount || 0)}</Text>
                </View>
                {/* Show Instagram handle for product, phone for education/tourism */}
                {cfg.showIg && item.igUsername ? (
                  <Text style={styles.igHandle}>@{item.igUsername}</Text>
                ) : item.mobile ? (
                  <Text style={styles.igHandle}>{item.mobile}</Text>
                ) : null}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>
                {industry === "education" ? "👨‍🎓" : industry === "tourism" ? "🧳" : "👥"}
              </Text>
              <Text style={styles.emptyText}>{cfg.emptyText}</Text>
              {filterTag !== "all" && (
                <Text style={styles.emptyHint}>Try switching the filter to "All"</Text>
              )}
            </View>
          }
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selected.name || cfg.personLabel}</Text>
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

                {/* Info rows */}
                {cfg.showIg && <InfoRow label="Instagram" value={selected.igUsername ? `@${selected.igUsername}` : null} />}
                <InfoRow label="Phone"        value={selected.mobile} />
                <InfoRow label="Member since" value={selected.createdAt ? new Date(selected.createdAt).toLocaleDateString("en-IN") : null} />

                {/* Stats */}
                <View style={styles.statsRow}>
                  <StatBox label={cfg.stat1Label} value={selected.orderCount || 0} />
                  <StatBox label={cfg.stat2Label} value={`₹${(selected.totalSpent || 0).toLocaleString("en-IN")}`} />
                  <StatBox label={cfg.stat3Label} value={selected[cfg.stat3Key] || 0} />
                </View>

                {/* Referral section — product industry only */}
                {cfg.showReferral && selected.referralCode && (
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

      {/* ── Import / Add Contacts Modal ────────────────────────────────────── */}
      <Modal visible={importModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                ➕ Add {cfg.personLabelPlural.charAt(0).toUpperCase() + cfg.personLabelPlural.slice(1)}
              </Text>
              <TouchableOpacity onPress={() => { setImportModal(false); setImportResult(null); }}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Tab switcher */}
            <View style={styles.importTabRow}>
              <TouchableOpacity
                style={[styles.importTab, importTab === "single" && styles.importTabActive]}
                onPress={() => { setImportTab("single"); setImportResult(null); }}
              >
                <Text style={[styles.importTabText, importTab === "single" && styles.importTabTextActive]}>
                  👤 Add One
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importTab, importTab === "bulk" && styles.importTabActive]}
                onPress={() => { setImportTab("bulk"); setImportResult(null); }}
              >
                <Text style={[styles.importTabText, importTab === "bulk" && styles.importTabTextActive]}>
                  📋 Bulk Import
                </Text>
              </TouchableOpacity>
            </View>

            {/* Result banner */}
            {importResult && (
              <View style={[styles.importResult, { backgroundColor: importResult.ok ? Colors.green + "22" : Colors.red + "22" }]}>
                <Text style={{ color: importResult.ok ? Colors.green : Colors.red, fontWeight: "700", fontSize: 13 }}>
                  {importResult.msg}
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
              {importTab === "single" ? (
                <>
                  <Text style={styles.importFieldLabel}>Name (optional)</Text>
                  <TextInput
                    style={styles.importInput}
                    placeholder={`e.g. Rahul Sharma`}
                    placeholderTextColor={Colors.textMuted}
                    value={singleName}
                    onChangeText={setSingleName}
                    autoCapitalize="words"
                  />
                  <Text style={styles.importFieldLabel}>WhatsApp Number *</Text>
                  <TextInput
                    style={styles.importInput}
                    placeholder="e.g. 9876543210 (10-digit, no spaces)"
                    placeholderTextColor={Colors.textMuted}
                    value={singlePhone}
                    onChangeText={setSinglePhone}
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                  <Text style={styles.importHint}>
                    💡 The {cfg.personLabel.toLowerCase()} will be added to your list. They will receive WhatsApp broadcasts you send from Promotions.
                  </Text>
                  <TouchableOpacity
                    style={[styles.importBtn, importing && styles.importBtnDisabled]}
                    onPress={importSingle}
                    disabled={importing}
                  >
                    {importing
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.importBtnText}>Add {cfg.personLabel} →</Text>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.importFieldLabel}>Paste contacts (one per line)</Text>
                  <Text style={styles.importHint}>
                    Formats supported:{"\n"}
                    • <Text style={{ color: Colors.textPrimary }}>9876543210</Text>  (just number){"\n"}
                    • <Text style={{ color: Colors.textPrimary }}>Rahul, 9876543210</Text>  (name, number){"\n"}
                    • <Text style={{ color: Colors.textPrimary }}>Priya Verma 9123456789</Text>  (name space number)
                  </Text>
                  <TextInput
                    style={[styles.importInput, { minHeight: 160, textAlignVertical: "top" }]}
                    placeholder={"9876543210\nRahul Sharma, 9123456789\nPriya 9001234567"}
                    placeholderTextColor={Colors.textMuted}
                    value={bulkText}
                    onChangeText={setBulkText}
                    multiline
                    autoCapitalize="none"
                  />
                  <Text style={styles.importCountHint}>
                    {bulkText.split("\n").filter(l => l.trim()).length} line{bulkText.split("\n").filter(l => l.trim()).length !== 1 ? "s" : ""} entered
                  </Text>
                  <TouchableOpacity
                    style={[styles.importBtn, importing && styles.importBtnDisabled]}
                    onPress={importBulk}
                    disabled={importing}
                  >
                    {importing
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.importBtnText}>Import All {cfg.personLabelPlural.charAt(0).toUpperCase() + cfg.personLabelPlural.slice(1)} →</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
              <View style={{ height: 32 }} />
            </ScrollView>
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
  container  : { flex: 1, backgroundColor: Colors.bg },
  center     : { flex: 1, alignItems: "center", justifyContent: "center" },

  filterScroll : { maxHeight: 46 },
  filterContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filterChip   : { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  filterText      : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: Colors.primary },

  countLabel : { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list       : { padding: 16, gap: 10, paddingBottom: 32 },
  empty      : { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyIcon  : { fontSize: 44, marginBottom: 4 },
  emptyText  : { color: Colors.textMuted, fontSize: 15 },
  emptyHint  : { color: Colors.textMuted, fontSize: 12 },

  card        : { backgroundColor: Colors.bgCard, borderRadius: 14, flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: Colors.border },
  avatar      : { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "33", alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarText  : { color: Colors.primary, fontWeight: "800", fontSize: 18 },
  cardBody    : { flex: 1 },
  cardRow     : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  customerName: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  orderCount  : { color: Colors.textSecondary, fontSize: 11 },
  igHandle    : { color: Colors.accent, fontSize: 12, marginBottom: 4 },
  tagsWrap    : { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tagBadge    : { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  tagText     : { fontSize: 11, fontWeight: "700" },
  chevron     : { color: Colors.textMuted, fontSize: 20, marginLeft: 8 },

  // Modal
  modalOverlay : { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet   : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%" },
  modalHandle  : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader  : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle   : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  closeBtn     : { color: Colors.textSecondary, fontSize: 20, padding: 4 },

  bigAvatar    : { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary + "33", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 12 },
  bigAvatarText: { color: Colors.primary, fontWeight: "900", fontSize: 32 },

  infoRow    : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel  : { color: Colors.textSecondary, fontSize: 13 },
  infoValue  : { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },

  statsRow   : { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 8 },
  statBox    : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  statValue  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", marginBottom: 2 },
  statLabel  : { color: Colors.textSecondary, fontSize: 11 },

  referralBox      : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.primary + "33" },
  referralLabel    : { color: Colors.textSecondary, fontSize: 12, marginBottom: 8 },
  referralCode     : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.primary + "22", borderRadius: 8, padding: 10 },
  referralCodeText : { color: Colors.primary, fontWeight: "800", fontSize: 16, letterSpacing: 2 },
  copyIcon         : { fontSize: 18 },
  referralEarnings : { color: Colors.green, fontSize: 12, marginTop: 8, fontWeight: "600" },

  // Search + Add button row
  topRow        : { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16 },
  searchWrap    : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput   : { flex: 1, color: Colors.textPrimary, paddingVertical: 10, fontSize: 14 },
  clearBtn      : { color: Colors.textMuted, fontSize: 16, padding: 4 },
  addContactBtn : { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  addContactBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  // Import modal
  importTabRow      : { flexDirection: "row", backgroundColor: Colors.bgInput, borderRadius: 12, padding: 4, marginBottom: 16 },
  importTab         : { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  importTabActive   : { backgroundColor: Colors.primary },
  importTabText     : { color: Colors.textSecondary, fontSize: 13, fontWeight: "700" },
  importTabTextActive: { color: "#fff" },
  importFieldLabel  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  importInput       : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  importHint        : { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 4 },
  importCountHint   : { color: Colors.textSecondary, fontSize: 12, marginTop: 6, marginBottom: 2 },
  importResult      : { borderRadius: 10, padding: 12, marginBottom: 8 },
  importBtn         : { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: "center", marginTop: 16 },
  importBtnDisabled : { opacity: 0.6 },
  importBtnText     : { color: "#fff", fontWeight: "800", fontSize: 15 },
});
