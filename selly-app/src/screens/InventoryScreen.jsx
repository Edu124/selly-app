// ── InventoryScreen.jsx — Kirana Stock Catalog ───────────────────────────────
// Category filter chips · stock level badge · unit types
// Quick available toggle · Add/Edit modal
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  Modal, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { Colors } from "../constants/colors";
import { fetchCatalog, addProduct, updateProduct, deleteProduct, toggleStock } from "../lib/api";

// ── Categories ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "All", "Rice & Dal", "Oils & Ghee", "Dairy", "Snacks & Biscuits",
  "Beverages", "Spices", "Atta & Flours", "Vegetables", "Fruits",
  "Personal Care", "Household", "Frozen", "Other",
];

const CAT_COLORS = {
  "Rice & Dal"      : { bg: "#fef3c7", text: "#92400e" },
  "Oils & Ghee"     : { bg: "#fed7aa", text: "#c2410c" },
  "Dairy"           : { bg: "#dbeafe", text: "#1d4ed8" },
  "Snacks & Biscuits": { bg: "#fce7f3", text: "#9d174d" },
  "Beverages"       : { bg: "#ede9fe", text: "#6d28d9" },
  "Spices"          : { bg: "#fef9c3", text: "#a16207" },
  "Atta & Flours"   : { bg: "#f0fdf4", text: "#166534" },
  "Vegetables"      : { bg: "#d1fae5", text: "#065f46" },
  "Fruits"          : { bg: "#fce7f3", text: "#be185d" },
  "Personal Care"   : { bg: "#e0e7ff", text: "#3730a3" },
  "Household"       : { bg: "#f3f4f6", text: "#374151" },
  "Frozen"          : { bg: "#e0f2fe", text: "#075985" },
  "Other"           : { bg: "#f1f5f9", text: "#475569" },
};

// ── Unit types ─────────────────────────────────────────────────────────────────
const UNITS = ["kg", "g", "litre", "ml", "piece", "dozen", "pack", "box", "bottle", "bag", "bundle"];

// ── Stock levels ───────────────────────────────────────────────────────────────
const STOCK_LEVELS = [
  { id: "in_stock",  label: "In Stock",   color: "#22c55e", bg: "#f0fdf4" },
  { id: "low_stock", label: "Low Stock",  color: "#f59e0b", bg: "#fffbeb" },
  { id: "out",       label: "Out of Stock", color: "#ef4444", bg: "#fef2f2" },
];

function StockBadge({ level }) {
  const s = STOCK_LEVELS.find(l => l.id === level) || STOCK_LEVELS[0];
  return (
    <View style={[stockStyles.badge, { backgroundColor: s.bg }]}>
      <Text style={[stockStyles.text, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// ── ChipRow ────────────────────────────────────────────────────────────────────
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

// ── InventoryCard ──────────────────────────────────────────────────────────────
function InventoryCard({ item, onEdit, onDelete, onStockChange }) {
  const cat     = item.extraFields?.category || "Other";
  const palette = CAT_COLORS[cat] || { bg: "#f1f5f9", text: "#475569" };
  const unit    = item.extraFields?.unit || item.unit || "piece";
  const stock   = item.extraFields?.stockLevel || (item.inStock === false ? "out" : "in_stock");

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        {/* Category badge */}
        <View style={[cardStyles.catBadge, { backgroundColor: palette.bg }]}>
          <Text style={[cardStyles.catText, { color: palette.text }]}>{cat}</Text>
        </View>
        {/* Stock level picker */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          {STOCK_LEVELS.map(lvl => (
            <TouchableOpacity
              key={lvl.id}
              onPress={() => onStockChange(item, lvl.id)}
              style={[
                cardStyles.stockBtn,
                stock === lvl.id && { backgroundColor: lvl.bg, borderColor: lvl.color + "66" },
              ]}
            >
              <Text style={[
                cardStyles.stockBtnText,
                stock === lvl.id && { color: lvl.color, fontWeight: "800" },
              ]}>
                {lvl.id === "in_stock" ? "✓" : lvl.id === "low_stock" ? "⚠" : "✗"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={cardStyles.midRow}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.name} numberOfLines={2}>{item.name}</Text>
          <Text style={cardStyles.unit}>per {unit}</Text>
        </View>
        <View style={cardStyles.priceBlock}>
          <Text style={cardStyles.price}>₹{Number(item.price || 0).toLocaleString("en-IN")}</Text>
          <StockBadge level={stock} />
        </View>
      </View>

      <View style={cardStyles.footer}>
        {item.description ? (
          <Text style={cardStyles.desc} numberOfLines={1}>{item.description}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => onEdit(item)} style={cardStyles.btnEdit}>
            <Text style={cardStyles.btnEditText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item)} style={cardStyles.btnDel}>
            <Text style={cardStyles.btnDelText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────
function ItemModal({ visible, initial, onSave, onClose }) {
  const isEdit = !!initial;

  const [name,       setName]       = useState("");
  const [price,      setPrice]      = useState("");
  const [category,   setCategory]   = useState("Other");
  const [unit,       setUnit]       = useState("piece");
  const [stockLevel, setStockLevel] = useState("in_stock");
  const [description,setDescription]= useState("");
  const [saving,     setSaving]     = useState(false);

  React.useEffect(() => {
    if (visible) {
      if (initial) {
        setName(initial.name || "");
        setPrice(initial.price != null ? String(initial.price) : "");
        setCategory(initial.extraFields?.category || "Other");
        setUnit(initial.extraFields?.unit || "piece");
        setStockLevel(initial.extraFields?.stockLevel || (initial.inStock === false ? "out" : "in_stock"));
        setDescription(initial.description || "");
      } else {
        setName(""); setPrice(""); setCategory("Other");
        setUnit("piece"); setStockLevel("in_stock"); setDescription("");
      }
    }
  }, [visible, initial]);

  async function handleSave() {
    if (!name.trim())  { Alert.alert("Missing", "Enter item name.");  return; }
    if (!price.trim()) { Alert.alert("Missing", "Enter item price."); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      price: parseFloat(price) || 0,
      description: description.trim(),
      inStock: stockLevel !== "out",
      extraFields: { category, unit, stockLevel },
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
          <Text style={modalStyles.title}>{isEdit ? "Edit Item" : "Add Item"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}
            style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]}>
            <Text style={modalStyles.saveTxt}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>

            {/* Category */}
            <Text style={modalStyles.label}>CATEGORY</Text>
            <ChipRow
              items={CATEGORIES.filter(c => c !== "All")}
              selected={category}
              onSelect={setCategory}
              colors={CAT_COLORS}
            />

            {/* Name */}
            <Text style={[modalStyles.label, { marginTop: 8 }]}>ITEM NAME *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Basmati Rice, Amul Butter…"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            {/* Price */}
            <Text style={modalStyles.label}>PRICE (₹) *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 60"
              placeholderTextColor={Colors.textMuted}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />

            {/* Unit */}
            <Text style={modalStyles.label}>UNIT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingVertical: 6 }}>
                {UNITS.map(u => (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setUnit(u)}
                    style={[
                      chipStyles.chip,
                      unit === u && chipStyles.chipActive,
                    ]}
                  >
                    <Text style={[chipStyles.chipText, unit === u && chipStyles.chipTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Stock level */}
            <Text style={modalStyles.label}>STOCK STATUS</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {STOCK_LEVELS.map(lvl => (
                <TouchableOpacity
                  key={lvl.id}
                  onPress={() => setStockLevel(lvl.id)}
                  style={[
                    modalStyles.stockOption,
                    stockLevel === lvl.id && { backgroundColor: lvl.bg, borderColor: lvl.color },
                  ]}
                >
                  <Text style={[modalStyles.stockOptionText, stockLevel === lvl.id && { color: lvl.color, fontWeight: "800" }]}>
                    {lvl.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={modalStyles.label}>NOTES (optional)</Text>
            <TextInput
              style={[modalStyles.input, { height: 72 }]}
              placeholder="Brand name, size variant, supplier note…"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function InventoryScreen() {
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget,setEditTarget]= useState(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    try {
      const data = await fetchCatalog();
      setItems(data?.products || []);
    } catch {
      Alert.alert("Error", "Could not load inventory.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "All"
    ? items
    : items.filter(i => i.extraFields?.category === filter);

  async function handleSave(payload, editId) {
    try {
      editId ? await updateProduct(editId, payload) : await addProduct(payload);
      setModalOpen(false); setEditTarget(null);
      await load();
    } catch {
      Alert.alert("Error", "Could not save item.");
    }
  }

  async function handleDelete(item) {
    Alert.alert("Delete Item", `Remove "${item.name}" from inventory?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await deleteProduct(item.id); await load(); }
        catch { Alert.alert("Error", "Could not delete."); }
      }},
    ]);
  }

  async function handleStockChange(item, newLevel) {
    const inStock = newLevel !== "out";
    try {
      await updateProduct(item.id, {
        inStock,
        extraFields: { ...item.extraFields, stockLevel: newLevel },
      });
      setItems(prev => prev.map(i =>
        i.id === item.id
          ? { ...i, inStock, extraFields: { ...i.extraFields, stockLevel: newLevel } }
          : i
      ));
    } catch { /* silent */ }
  }

  // Count low/out for header badge
  const lowCount = items.filter(i => {
    const lvl = i.extraFields?.stockLevel;
    return lvl === "low_stock" || lvl === "out" || i.inStock === false;
  }).length;

  return (
    <View style={styles.root}>
      {/* Low stock alert */}
      {lowCount > 0 && (
        <View style={styles.alertBar}>
          <Text style={styles.alertText}>⚠️ {lowCount} item{lowCount > 1 ? "s" : ""} low or out of stock</Text>
        </View>
      )}

      {/* Category filter */}
      <ChipRow
        items={CATEGORIES}
        selected={filter}
        onSelect={setFilter}
        colors={CAT_COLORS}
      />

      {/* Count + Add */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {filtered.length} {filter === "All" ? "items" : filter}
        </Text>
        <TouchableOpacity onPress={() => { setEditTarget(null); setModalOpen(true); }}
          style={styles.addBtn} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptyDesc}>Add items to your inventory so prices auto-fill in orders</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <InventoryCard
              item={item}
              onEdit={i => { setEditTarget(i); setModalOpen(true); }}
              onDelete={handleDelete}
              onStockChange={handleStockChange}
            />
          )}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ItemModal
        visible={modalOpen}
        initial={editTarget}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root    : { flex: 1, backgroundColor: Colors.bg },
  alertBar: { backgroundColor: "#fffbeb", borderBottomWidth: 1, borderBottomColor: "#f59e0b44", paddingHorizontal: 16, paddingVertical: 8 },
  alertText: { color: "#92400e", fontSize: 12, fontWeight: "700" },
  countBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  countText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  addBtn  : { backgroundColor: "#F59E0B", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  empty   : { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyIcon : { fontSize: 52, marginBottom: 4 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  emptyDesc : { color: Colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
});

const chipStyles = StyleSheet.create({
  chip         : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  chipActive   : { backgroundColor: "#F59E0B22", borderColor: "#F59E0B88" },
  chipText     : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#F59E0B", fontWeight: "800" },
});

const stockStyles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  text : { fontSize: 10, fontWeight: "800" },
});

const cardStyles = StyleSheet.create({
  card   : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  topRow : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  catText : { fontSize: 11, fontWeight: "700" },
  stockBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  stockBtnText: { fontSize: 13, color: Colors.textMuted },
  midRow  : { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  name    : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 3, lineHeight: 20 },
  unit    : { color: Colors.textMuted, fontSize: 12 },
  priceBlock: { alignItems: "flex-end", gap: 4 },
  price   : { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  footer  : { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  desc    : { color: Colors.textMuted, fontSize: 11, flex: 1, marginRight: 8 },
  btnEdit : { backgroundColor: "#F59E0B18", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "#F59E0B44" },
  btnEditText: { color: "#F59E0B", fontSize: 12, fontWeight: "700" },
  btnDel  : { backgroundColor: "rgba(239,68,68,0.1)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  btnDelText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
  root   : { flex: 1, backgroundColor: Colors.bg },
  header : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title  : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  closeBtn: { padding: 4, minWidth: 32 },
  closeTxt: { color: Colors.textSecondary, fontSize: 18 },
  saveBtn : { backgroundColor: "#F59E0B", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveTxt : { color: "#fff", fontSize: 13, fontWeight: "800" },
  body    : { flex: 1, padding: 16 },
  label   : { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  input   : { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 15, marginBottom: 14 },
  stockOption: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", backgroundColor: Colors.bgCard },
  stockOptionText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
});
