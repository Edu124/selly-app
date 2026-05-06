// ── FlavorsScreen.jsx — Ice Cream Flavor Catalog ─────────────────────────────
// Category filter · flavor cards with per-scoop + per-500ml price
// Availability toggle · Add/Edit modal
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  Modal, TextInput, Switch, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Colors } from "../constants/colors";
import { fetchCatalog, addProduct, updateProduct, deleteProduct } from "../lib/api";

const CATEGORIES = ["All", "Classic", "Fruit", "Premium", "Seasonal", "Sugar-Free", "Combo Packs"];

const CAT_COLORS = {
  "Classic"     : { bg: "#fef3c7", text: "#92400e" },
  "Fruit"       : { bg: "#fce7f3", text: "#be185d" },
  "Premium"     : { bg: "#ede9fe", text: "#6d28d9" },
  "Seasonal"    : { bg: "#d1fae5", text: "#065f46" },
  "Sugar-Free"  : { bg: "#dbeafe", text: "#1d4ed8" },
  "Combo Packs" : { bg: "#fecdd3", text: "#be123c" },
};

// Flavor dot colors for visual preview
const FLAVOR_COLORS = [
  "#ec4899", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f59e0b", "#6366f1",
];

function ChipRow({ items, selected, onSelect, colors }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 6 }}>
        {items.map(item => {
          const active  = item === selected;
          const palette = colors?.[item];
          return (
            <TouchableOpacity
              key={item}
              onPress={() => onSelect(item)}
              style={[
                chipStyles.chip,
                active && (palette
                  ? { backgroundColor: palette.bg, borderColor: palette.text + "55" }
                  : chipStyles.chipActive),
              ]}
            >
              <Text style={[
                chipStyles.chipText,
                active && (palette ? { color: palette.text, fontWeight: "800" } : chipStyles.chipTextActive),
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── FlavorCard ────────────────────────────────────────────────────────────────
function FlavorCard({ item, colorDot, onEdit, onDelete, onToggle }) {
  const cat     = item.extraFields?.category || "Classic";
  const palette = CAT_COLORS[cat] || { bg: "#fef3c7", text: "#92400e" };
  const perScoop  = item.price || 0;
  const per500ml  = item.extraFields?.per500ml || 0;
  const isAvail   = item.inStock !== false;

  return (
    <View style={[cardStyles.card, !isAvail && cardStyles.cardUnavail]}>
      {/* Color dot + name row */}
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.colorDot, { backgroundColor: colorDot }]} />
        <View style={{ flex: 1 }}>
          <Text style={[cardStyles.name, !isAvail && { color: Colors.textMuted }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[cardStyles.catBadge, { backgroundColor: palette.bg }]}>
            <Text style={[cardStyles.catText, { color: palette.text }]}>{cat}</Text>
          </View>
        </View>
        <Switch
          value={isAvail}
          onValueChange={v => onToggle(item, v)}
          trackColor={{ false: Colors.border, true: "#a855f766" }}
          thumbColor={isAvail ? "#a855f7" : Colors.textMuted}
          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
        />
      </View>

      {/* Description */}
      {item.description ? (
        <Text style={cardStyles.desc} numberOfLines={1}>{item.description}</Text>
      ) : null}

      {/* Prices + actions */}
      <View style={cardStyles.footer}>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View>
            <Text style={cardStyles.price}>₹{Number(perScoop).toLocaleString("en-IN")}</Text>
            <Text style={cardStyles.priceLabel}>per scoop</Text>
          </View>
          {per500ml > 0 && (
            <View>
              <Text style={cardStyles.price}>₹{Number(per500ml).toLocaleString("en-IN")}</Text>
              <Text style={cardStyles.priceLabel}>500 ml</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => onEdit(item)} style={cardStyles.btnEdit}>
            <Text style={cardStyles.btnEditText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item)} style={cardStyles.btnDel}>
            <Text style={cardStyles.btnDelText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isAvail && (
        <View style={cardStyles.unavailOverlay}>
          <Text style={cardStyles.unavailText}>Out of Stock</Text>
        </View>
      )}
    </View>
  );
}

// ── Add/Edit Modal ────────────────────────────────────────────────────────────
function FlavorModal({ visible, initial, onSave, onClose }) {
  const isEdit = !!initial;
  const [name,        setName]        = useState("");
  const [perScoop,    setPerScoop]    = useState("");
  const [per500ml,    setPer500ml]    = useState("");
  const [category,    setCategory]    = useState("Classic");
  const [description, setDescription] = useState("");
  const [available,   setAvailable]   = useState(true);
  const [saving,      setSaving]      = useState(false);

  React.useEffect(() => {
    if (visible) {
      if (initial) {
        setName(initial.name || "");
        setPerScoop(initial.price != null ? String(initial.price) : "");
        setPer500ml(initial.extraFields?.per500ml != null ? String(initial.extraFields.per500ml) : "");
        setCategory(initial.extraFields?.category || "Classic");
        setDescription(initial.description || "");
        setAvailable(initial.inStock !== false);
      } else {
        setName(""); setPerScoop(""); setPer500ml(""); setCategory("Classic");
        setDescription(""); setAvailable(true);
      }
    }
  }, [visible, initial]);

  async function handleSave() {
    if (!name.trim())     { Alert.alert("Missing", "Enter flavor name.");     return; }
    if (!perScoop.trim()) { Alert.alert("Missing", "Enter per scoop price."); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      price: parseFloat(perScoop) || 0,
      description: description.trim(),
      inStock: available,
      extraFields: {
        category,
        per500ml: per500ml ? parseFloat(per500ml) || 0 : 0,
      },
    };
    await onSave(payload, isEdit ? initial.id : null);
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.root}>
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
            <Text style={modalStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={modalStyles.title}>{isEdit ? "Edit Flavor" : "Add Flavor"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}
            style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]}>
            <Text style={modalStyles.saveTxt}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>

            <Text style={modalStyles.label}>CATEGORY</Text>
            <ChipRow
              items={CATEGORIES.filter(c => c !== "All")}
              selected={category}
              onSelect={setCategory}
              colors={CAT_COLORS}
            />

            <Text style={[modalStyles.label, { marginTop: 8 }]}>FLAVOR NAME *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Belgian Dark Chocolate"
              placeholderTextColor={Colors.textMuted}
              value={name} onChangeText={setName}
            />

            <Text style={modalStyles.label}>PRICE PER SCOOP (₹) *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 40"
              placeholderTextColor={Colors.textMuted}
              value={perScoop} onChangeText={setPerScoop}
              keyboardType="numeric"
            />

            <Text style={modalStyles.label}>PRICE PER 500 ML (₹)</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 180  (leave blank if not applicable)"
              placeholderTextColor={Colors.textMuted}
              value={per500ml} onChangeText={setPer500ml}
              keyboardType="numeric"
            />

            <Text style={modalStyles.label}>DESCRIPTION (optional)</Text>
            <TextInput
              style={[modalStyles.input, { height: 72 }]}
              placeholder="e.g. Rich Belgian cocoa with cookie crumble…"
              placeholderTextColor={Colors.textMuted}
              value={description} onChangeText={setDescription}
              multiline textAlignVertical="top"
            />

            {/* Availability */}
            <View style={modalStyles.availRow}>
              <Text style={modalStyles.availLabel}>Available</Text>
              <Switch
                value={available}
                onValueChange={setAvailable}
                trackColor={{ false: Colors.border, true: "#a855f766" }}
                thumbColor={available ? "#a855f7" : Colors.textMuted}
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FlavorsScreen() {
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget,setEditTarget]= useState(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    try { setItems((await fetchCatalog()) || []); }
    catch { Alert.alert("Error", "Could not load flavors."); }
    finally { setLoading(false); }
  }

  const filtered = filter === "All"
    ? items
    : items.filter(i => i.extraFields?.category === filter);

  const availCount = items.filter(i => i.inStock !== false).length;

  async function handleSave(payload, editId) {
    try {
      editId ? await updateProduct(editId, payload) : await addProduct(payload);
      setModalOpen(false); setEditTarget(null); await load();
    } catch { Alert.alert("Error", "Could not save flavor."); }
  }

  async function handleDelete(item) {
    Alert.alert("Delete", `Remove "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await deleteProduct(item.id); await load(); }
        catch { Alert.alert("Error", "Could not delete."); }
      }},
    ]);
  }

  async function handleToggle(item, value) {
    try {
      await updateProduct(item.id, { inStock: value });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, inStock: value } : i));
    } catch { /* silent */ }
  }

  return (
    <View style={styles.root}>
      {/* Available count bar */}
      {items.length > 0 && (
        <View style={styles.availBar}>
          <Text style={styles.availText}>
            🍦 {availCount} of {items.length} flavors available today
          </Text>
        </View>
      )}

      <ChipRow
        items={CATEGORIES}
        selected={filter}
        onSelect={setFilter}
        colors={CAT_COLORS}
      />

      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {filtered.length} {filter === "All" ? "flavors" : filter}
        </Text>
        <TouchableOpacity
          onPress={() => { setEditTarget(null); setModalOpen(true); }}
          style={styles.addBtn} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add Flavor</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🍦</Text>
          <Text style={styles.emptyTitle}>No flavors yet</Text>
          <Text style={styles.emptyDesc}>Add your ice cream flavors and set prices</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item, index }) => (
            <FlavorCard
              item={item}
              colorDot={FLAVOR_COLORS[index % FLAVOR_COLORS.length]}
              onEdit={i => { setEditTarget(i); setModalOpen(true); }}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FlavorModal
        visible={modalOpen}
        initial={editTarget}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root    : { flex: 1, backgroundColor: Colors.bg },
  availBar: { backgroundColor: "#a855f711", borderBottomWidth: 1, borderBottomColor: "#a855f733", paddingHorizontal: 16, paddingVertical: 8 },
  availText: { color: "#a855f7", fontSize: 12, fontWeight: "700" },
  countBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  countText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  addBtn  : { backgroundColor: "#a855f7", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  empty   : { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyIcon : { fontSize: 52, marginBottom: 4 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  emptyDesc : { color: Colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
});

const chipStyles = StyleSheet.create({
  chip         : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  chipActive   : { backgroundColor: "#a855f722", borderColor: "#a855f788" },
  chipText     : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#a855f7", fontWeight: "800" },
});

const cardStyles = StyleSheet.create({
  card        : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, position: "relative" },
  cardUnavail : { opacity: 0.7 },
  topRow      : { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  colorDot    : { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  name        : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 4 },
  catBadge    : { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  catText     : { fontSize: 10, fontWeight: "700" },
  desc        : { color: Colors.textMuted, fontSize: 12, marginBottom: 8, marginLeft: 48 },
  footer      : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  price       : { color: Colors.textPrimary, fontSize: 16, fontWeight: "900" },
  priceLabel  : { color: Colors.textMuted, fontSize: 11 },
  btnEdit     : { backgroundColor: "#a855f718", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "#a855f744" },
  btnEditText : { color: "#a855f7", fontSize: 12, fontWeight: "700" },
  btnDel      : { backgroundColor: "rgba(239,68,68,0.1)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  btnDelText  : { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  unavailOverlay: { position: "absolute", top: 10, right: 60, backgroundColor: "#ef444422", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#ef444444" },
  unavailText   : { color: "#ef4444", fontSize: 10, fontWeight: "800" },
});

const modalStyles = StyleSheet.create({
  root    : { flex: 1, backgroundColor: Colors.bg },
  header  : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title   : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  closeBtn: { padding: 4, minWidth: 32 },
  closeTxt: { color: Colors.textSecondary, fontSize: 18 },
  saveBtn : { backgroundColor: "#a855f7", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveTxt : { color: "#fff", fontSize: 13, fontWeight: "800" },
  body    : { flex: 1, padding: 16 },
  label   : { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  input   : { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 15, marginBottom: 14 },
  availRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  availLabel: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
});
