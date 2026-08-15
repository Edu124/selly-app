import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Contacts from "expo-contacts";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import { fetchCustomers, importContacts, updateCustomerTags, deleteCustomer } from "../lib/api";
import { friendlyError } from "../lib/errors";

// All three food business types share one customer model — a diner is a diner
// whether they ate in, ordered a cake or had it delivered. Only the stat wording
// differs, and not enough to justify a per-type config.
const CONFIG = {
  personLabel      : "Customer",
  personLabelPlural: "customers",
  emptyText        : "No customers yet",
  searchPlaceholder: "Search by name or phone…",
  orderCountLabel  : (n) => `${n} order${n !== 1 ? "s" : ""}`,
  filters: [
    { key: "all",      label: "All"      },
    { key: "frequent", label: "Frequent" },
    { key: "new",      label: "New"      },
  ],
  stat1Label  : "Orders",
  stat2Label  : "Spent",
  stat3Label  : "Referrals",
  stat3Key    : "referralCount",
  showReferral: true,
  showIg      : true,
};

// Tag badge colours
const TAG_COLORS = {
  vip      : { bg: "#2d1535", text: "#ff6b9d" },
  frequent : { bg: "#0f1f2d", text: "#3b82f6" },
  referrer : { bg: "#0f2d1a", text: "#22c55e" },
  new      : { bg: "#13131a", text: "#8888aa" },
};

// Birthday / anniversary badge
const OCCASION_COLOR = { bg: "#2a1020", text: "#ff8fb8" };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CustomersScreen() {
  const cfg = CONFIG;

  const [customers,   setCustomers]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState(null);
  const [copied,      setCopied]      = useState(false);
  const [filterTag,   setFilterTag]   = useState("all");
  const [tagSaving,   setTagSaving]   = useState(false);
  const [loadError,   setLoadError]   = useState(null);

  // ── Import contacts state ────────────────────────────────────────────────────
  const [importModal,   setImportModal]   = useState(false);
  const [importTab,     setImportTab]     = useState("single"); // "single" | "bulk" | "phonebook" | "file"
  const [singleName,    setSingleName]    = useState("");
  const [singlePhone,   setSinglePhone]   = useState("");
  const [bulkText,      setBulkText]      = useState("");
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null);

  // ── CSV/Excel file import state ──────────────────────────────────────────────
  const [csvFileName,   setCsvFileName]   = useState("");
  const [csvContacts,   setCsvContacts]   = useState([]);    // parsed contacts
  const [csvError,      setCsvError]      = useState("");

  // ── Phone book state ─────────────────────────────────────────────────────────
  const [phoneContacts,  setPhoneContacts]  = useState([]);
  const [pbLoading,      setPbLoading]      = useState(false);
  const [pbSearch,       setPbSearch]       = useState("");
  const [selectedPb,     setSelectedPb]     = useState(new Set()); // Set of contact IDs

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await fetchCustomers();
      setCustomers(d.customers || []);
    } catch (e) {
      // Surface the failure — otherwise an empty list looks like "no customers"
      // when it actually means the load failed.
      console.warn(e.message);
      setLoadError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    setFilterTag("all");
    load();
  }, []));

  const copyReferral = async (code) => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Toggle a tag on the selected customer ────────────────────────────────────
  const toggleTag = async (tag) => {
    if (!selected || tagSaving) return;
    const current  = selected.tags || [];
    const newTags  = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    setTagSaving(true);
    try {
      await updateCustomerTags(selected.id, newTags);
      const updated = { ...selected, tags: newTags };
      setSelected(updated);
      setCustomers(prev => prev.map(c => c.id === selected.id ? updated : c));
    } catch (e) { Alert.alert("Error", friendlyError(e)); }
    finally { setTagSaving(false); }
  };

  // ── Remove a customer ────────────────────────────────────────────────────────
  const removeCustomerConfirm = () => {
    if (!selected) return;
    Alert.alert(
      "Remove customer",
      `Remove "${selected.name}" from your customer list? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: async () => {
            try {
              await deleteCustomer(selected.id);
              setCustomers(prev => prev.filter(c => c.id !== selected.id));
              setSelected(null);
            } catch (e) { Alert.alert("Error", friendlyError(e)); }
          }
        },
      ]
    );
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

  // ── Load phone contacts ──────────────────────────────────────────────────────
  const loadPhoneContacts = async () => {
    setPbLoading(true);
    setPbSearch("");
    setSelectedPb(new Set());
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow contacts access in your phone settings to use this feature.");
        setPbLoading(false);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort  : Contacts.SortTypes.FirstName,
      });
      // Filter only contacts with phone numbers
      const withPhone = (data || []).filter(c => c.phoneNumbers?.length);
      setPhoneContacts(withPhone);
    } catch (e) {
      Alert.alert("Error", "Could not load contacts: " + e.message);
    } finally {
      setPbLoading(false);
    }
  };

  const togglePbSelect = (id) => {
    setSelectedPb(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const importFromPhonebook = () => {
    const contacts = phoneContacts
      .filter(c => selectedPb.has(c.id))
      .map(c => ({
        name : c.name || "",
        phone: (c.phoneNumbers[0].number || "").replace(/[^0-9]/g, ""),
      }))
      .filter(c => c.phone.length >= 10);
    if (!contacts.length) { setImportResult({ ok: false, msg: "Select at least one contact with a valid number." }); return; }
    doImport(contacts);
  };

  const importSingle = () => {
    const phone = singlePhone.replace(/[^0-9]/g, "");
    if (phone.length < 10) { setImportResult({ ok: false, msg: "Enter a valid number (at least 10 digits)." }); return; }
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

  // ── CSV file parsing helpers ──────────────────────────────────────────────────
  // Parses a CSV / TSV text string → [{name, phone}]
  // Detects header row, handles Name/Phone columns in any order.
  const parseCsvText = (text) => {
    const separator = text.includes("\t") ? "\t" : ",";
    const rawLines  = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
    if (!rawLines.length) return [];

    // Try to detect header row: contains "name" or "phone" (case insensitive)
    const firstLower = rawLines[0].toLowerCase();
    const hasHeader  = firstLower.includes("name") || firstLower.includes("phone") ||
                       firstLower.includes("mobile") || firstLower.includes("number");

    let nameIdx = 0;
    let phoneIdx = 1;

    if (hasHeader) {
      const headers = rawLines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const ni = headers.findIndex(h => h.includes("name"));
      const pi = headers.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("number") || h.includes("whatsapp"));
      if (ni >= 0) nameIdx  = ni;
      if (pi >= 0) phoneIdx = pi;
    }

    const dataRows = hasHeader ? rawLines.slice(1) : rawLines;
    return dataRows
      .map(line => {
        const cols  = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ""));
        const name  = (cols[nameIdx]  || "").trim();
        const phone = (cols[phoneIdx] || cols[0] || "").replace(/[^0-9+]/g, "");
        return { name, phone };
      })
      .filter(c => c.phone.replace(/\D/g, "").length >= 10);
  };

  const pickCsvFile = async () => {
    setCsvError("");
    setCsvContacts([]);
    setCsvFileName("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "text/comma-separated-values",
               "application/csv", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const name  = asset.name || "file";

      // Only allow CSV or TXT files (no raw Excel — ask user to export as CSV)
      const ext = name.split(".").pop().toLowerCase();
      if (!["csv", "txt", "tsv"].includes(ext)) {
        setCsvError(`⚠️ "${name}" is not a CSV file. Please export your Excel sheet as CSV (File → Save As → CSV).`);
        return;
      }

      const content = await FileSystem.readAsStringAsync(asset.uri);
      const parsed  = parseCsvText(content);
      if (!parsed.length) {
        setCsvError("No valid contacts found in the file. Make sure it has a phone number column with 10-digit numbers.");
        return;
      }
      setCsvFileName(name);
      setCsvContacts(parsed);
    } catch (e) {
      setCsvError("Could not read file: " + e.message);
    }
  };

  const filtered = customers.filter(c => {
    const matchSearch = !search.trim() ||
      (c.name     || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.igUsername || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.mobile   || "").includes(search);
    const matchTag   = filterTag === "all" || (c.tags || []).includes(filterTag);
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
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.loadErrIcon}>⚠️</Text>
          <Text style={styles.loadErrText}>{loadError}</Text>
          <TouchableOpacity style={styles.loadErrBtn} onPress={load}>
            <Text style={styles.loadErrBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
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
                {/* Instagram handle when we have one, otherwise the phone number */}
                {cfg.showIg && item.igUsername ? (
                  <Text style={styles.igHandle}>@{item.igUsername}</Text>
                ) : item.mobile ? (
                  <Text style={styles.igHandle}>{item.mobile}</Text>
                ) : null}
                <View style={styles.tagsWrap}>
                  {item.occasionMonth && item.occasionDay ? (
                    <View style={[styles.tagBadge, { backgroundColor: OCCASION_COLOR.bg }]}>
                      <Text style={[styles.tagText, { color: OCCASION_COLOR.text }]}>
                        🎂 {item.occasionDay} {MONTHS[item.occasionMonth - 1]}
                      </Text>
                    </View>
                  ) : null}
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
              <Text style={styles.emptyIcon}>👥</Text>
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

                {/* Tags — tappable to toggle */}
                <Text style={[styles.sectionLabel, { textAlign: "center", marginBottom: 8 }]}>
                  {tagSaving ? "Saving…" : "Tap to add/remove tags"}
                </Text>
                <View style={[styles.tagsWrap, { justifyContent: "center", marginBottom: 16 }]}>
                  {cfg.filters.filter(f => f.key !== "all").map(f => {
                    const tag    = f.key;
                    const active = (selected.tags || []).includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        style={[
                          styles.tagBadge,
                          { backgroundColor: active ? (TAG_COLORS[tag]?.bg || Colors.bgCard) : Colors.bgInput },
                          active && { borderWidth: 1, borderColor: TAG_COLORS[tag]?.text || Colors.primary },
                        ]}
                      >
                        <Text style={[styles.tagText, { color: active ? (TAG_COLORS[tag]?.text || Colors.primary) : Colors.textMuted }]}>
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Info rows */}
                {cfg.showIg && <InfoRow label="Instagram" value={selected.igUsername ? `@${selected.igUsername}` : null} />}
                <InfoRow label="Phone"        value={selected.mobile} />
                <InfoRow label="Member since" value={selected.createdAt ? new Date(selected.createdAt).toLocaleDateString("en-IN") : null} />

                {selected.occasionMonth && selected.occasionDay ? (
                  <InfoRow
                    label="Occasion saved"
                    value={`🎂 ${selected.occasionDay} ${MONTHS[selected.occasionMonth - 1]}`}
                  />
                ) : null}

                {/* Stats */}
                <View style={styles.statsRow}>
                  <StatBox label={cfg.stat1Label} value={selected.orderCount || 0} />
                  <StatBox label={cfg.stat2Label} value={`₹${(selected.totalSpent || 0).toLocaleString("en-IN")}`} />
                  <StatBox label={cfg.stat3Label} value={selected[cfg.stat3Key] || 0} />
                </View>

                {/* Referral section */}
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

                <TouchableOpacity style={styles.removeBtn} onPress={removeCustomerConfirm}>
                  <Text style={styles.removeBtnText}>🗑 Remove customer</Text>
                </TouchableOpacity>

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
                  👤 One
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importTab, importTab === "bulk" && styles.importTabActive]}
                onPress={() => { setImportTab("bulk"); setImportResult(null); }}
              >
                <Text style={[styles.importTabText, importTab === "bulk" && styles.importTabTextActive]}>
                  📋 Text
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importTab, importTab === "phonebook" && styles.importTabActive]}
                onPress={() => { setImportTab("phonebook"); setImportResult(null); loadPhoneContacts(); }}
              >
                <Text style={[styles.importTabText, importTab === "phonebook" && styles.importTabTextActive]}>
                  📱 Phone
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importTab, importTab === "file" && styles.importTabActive]}
                onPress={() => { setImportTab("file"); setImportResult(null); setCsvError(""); setCsvContacts([]); setCsvFileName(""); }}
              >
                <Text style={[styles.importTabText, importTab === "file" && styles.importTabTextActive]}>
                  📄 CSV
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
              ) : importTab === "bulk" ? (
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
              ) : importTab === "phonebook" ? (
                <>
                  {pbLoading ? (
                    <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
                  ) : (
                    <>
                      <TextInput
                        style={[styles.importInput, { marginBottom: 8 }]}
                        placeholder="Search contacts…"
                        placeholderTextColor={Colors.textMuted}
                        value={pbSearch}
                        onChangeText={setPbSearch}
                        autoCapitalize="none"
                      />
                      <Text style={styles.importCountHint}>
                        {selectedPb.size} selected · {phoneContacts.length} contacts
                      </Text>
                      <View style={{ maxHeight: 300 }}>
                        <FlatList
                          data={phoneContacts.filter(c =>
                            !pbSearch.trim() ||
                            (c.name || "").toLowerCase().includes(pbSearch.toLowerCase()) ||
                            (c.phoneNumbers?.[0]?.number || "").includes(pbSearch)
                          )}
                          keyExtractor={c => c.id}
                          renderItem={({ item }) => {
                            const checked = selectedPb.has(item.id);
                            const phone   = item.phoneNumbers?.[0]?.number || "";
                            return (
                              <TouchableOpacity
                                style={[styles.pbRow, checked && styles.pbRowSelected]}
                                onPress={() => togglePbSelect(item.id)}
                              >
                                <View style={[styles.pbCheck, checked && styles.pbCheckActive]}>
                                  {checked && <Text style={styles.pbCheckMark}>✓</Text>}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.pbName}>{item.name || "Unknown"}</Text>
                                  <Text style={styles.pbPhone}>{phone}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          }}
                          ListEmptyComponent={
                            <Text style={[styles.importHint, { textAlign: "center", paddingTop: 20 }]}>
                              {pbSearch ? "No contacts match your search." : "No contacts found."}
                            </Text>
                          }
                          nestedScrollEnabled
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.importBtn, (importing || selectedPb.size === 0) && styles.importBtnDisabled]}
                        onPress={importFromPhonebook}
                        disabled={importing || selectedPb.size === 0}
                      >
                        {importing
                          ? <ActivityIndicator color="#fff" />
                          : <Text style={styles.importBtnText}>
                              Add {selectedPb.size || ""} Selected →
                            </Text>
                        }
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : importTab === "file" ? (
                <>
                  <Text style={styles.importHint}>
                    Pick a <Text style={{ color: Colors.textPrimary }}>CSV file</Text> exported from Excel, Google Sheets, or any spreadsheet app.{"\n\n"}
                    💡 In Excel: <Text style={{ color: Colors.textPrimary }}>File → Save As → CSV (Comma delimited)</Text>
                  </Text>

                  <TouchableOpacity style={styles.filePickBtn} onPress={pickCsvFile}>
                    <Text style={styles.filePickBtnText}>
                      {csvFileName ? `📄 ${csvFileName}` : "📂 Pick CSV File"}
                    </Text>
                  </TouchableOpacity>

                  {csvError ? (
                    <View style={[styles.importResult, { backgroundColor: Colors.red + "22" }]}>
                      <Text style={{ color: Colors.red, fontSize: 13 }}>{csvError}</Text>
                    </View>
                  ) : null}

                  {csvContacts.length > 0 && (
                    <View style={[styles.importResult, { backgroundColor: Colors.green + "22", marginTop: 8 }]}>
                      <Text style={{ color: Colors.green, fontWeight: "700", fontSize: 13 }}>
                        ✅ Found {csvContacts.length} valid contact{csvContacts.length !== 1 ? "s" : ""}
                      </Text>
                      <Text style={{ color: Colors.green, fontSize: 12, marginTop: 4 }}>
                        Preview: {csvContacts.slice(0, 3).map(c => c.name || c.phone).join(", ")}{csvContacts.length > 3 ? ` +${csvContacts.length - 3} more` : ""}
                      </Text>
                    </View>
                  )}

                  {csvContacts.length > 0 && (
                    <TouchableOpacity
                      style={[styles.importBtn, importing && styles.importBtnDisabled]}
                      onPress={() => doImport(csvContacts)}
                      disabled={importing}
                    >
                      {importing
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.importBtnText}>
                            Import {csvContacts.length} {cfg.personLabelPlural.charAt(0).toUpperCase() + cfg.personLabelPlural.slice(1)} →
                          </Text>
                      }
                    </TouchableOpacity>
                  )}
                </>
              ) : null}
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
  loadErrIcon: { fontSize: 30, marginBottom: 10 },
  loadErrText: { color: Colors.textSecondary, fontSize: 13.5, textAlign: "center", paddingHorizontal: 34, lineHeight: 19 },
  loadErrBtn : { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 9 },
  loadErrBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "700" },

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
  tagBadge    : { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagText     : { fontSize: 11, fontWeight: "700" },
  sectionLabel: { color: Colors.textMuted, fontSize: 11, fontStyle: "italic" },
  removeBtn   : { marginTop: 16, borderRadius: 10, padding: 14, alignItems: "center", backgroundColor: Colors.red + "18", borderWidth: 1, borderColor: Colors.red + "44" },
  removeBtnText: { color: Colors.red, fontWeight: "700", fontSize: 14 },
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

  // CSV File picker
  filePickBtn     : { borderWidth: 2, borderColor: Colors.primary, borderStyle: "dashed", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12, marginBottom: 4 },
  filePickBtnText : { color: Colors.primary, fontWeight: "700", fontSize: 14 },

  // Phone book
  pbRow         : { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  pbRowSelected : { backgroundColor: Colors.primary + "11" },
  pbCheck       : { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  pbCheckActive : { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pbCheckMark   : { color: "#fff", fontWeight: "900", fontSize: 12 },
  pbName        : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  pbPhone       : { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
});
