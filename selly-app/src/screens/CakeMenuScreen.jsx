// ── CakeMenuScreen.jsx — Cake & Bakery Menu Catalog ──────────────────────────
// Category filter · cake cards with flavors + price per kg
// Add/Edit modal with occasion type, available flavors, photo
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  Modal, TextInput, Switch, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { Colors }                                        from "../constants/colors";
import { fetchCatalog, addProduct, updateProduct, deleteProduct } from "../lib/api";

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "All", "Birthday", "Wedding", "Anniversary", "Custom", "Cupcakes", "Pastries & Breads",
];

const CAT_COLORS = {
  "Birthday"         : { bg: "#fce7f3", text: "#be185d" },
  "Wedding"          : { bg: "#ede9fe", text: "#6d28d9" },
  "Anniversary"      : { bg: "#fef3c7", text: "#d97706" },
  "Custom"           : { bg: "#dbeafe", text: "#1d4ed8" },
  "Cupcakes"         : { bg: "#fecdd3", text: "#be123c" },
  "Pastries & Breads": { bg: "#d1fae5", text: "#065f46" },
};

// ── Available flavors ─────────────────────────────────────────────────────────
const FLAVORS_LIST = [
  "Chocolate", "Vanilla", "Strawberry", "Red Velvet", "Black Forest",
  "Butterscotch", "Blueberry", "Pineapple", "Mango", "Oreo",
  "Truffle", "Lemon", "Carrot", "Coffee", "Marble",
];

// ── Cake sizes ────────────────────────────────────────────────────────────────
const SIZES = ["½ kg", "1 kg", "2 kg", "3 kg", "4 kg", "5 kg", "Custom"];

// ── ChipRow ───────────────────────────────────────────────────────────────────
function ChipRow({ items, selected, onSelect, colors, multi }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingVertical: 6 }}>
        {items.map(item => {
          const active  = multi ? selected.includes(item) : item === selected;
          const palette = colors?.[item];
          return (
            <TouchableOpacity
              key={item}
              onPress={() => onSelect(item)}
              style={[
                chipStyles.chip,
                active && (palette
                  ? { backgroundColor: palette.bg, borderColor: palette.text + "66" }
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

// ── PhotoPicker ───────────────────────────────────────────────────────────────
function PhotoPicker({ uri, onChange }) {
  async function pick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow gallery access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
      aspect: [4, 3], allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]?.uri) onChange(result.assets[0].uri);
  }
  return (
    <TouchableOpacity onPress={pick} style={photoStyles.wrap} activeOpacity={0.8}>
      {uri ? (
        <Image source={{ uri }} style={photoStyles.img} />
      ) : (
        <View style={photoStyles.placeholder}>
          <Text style={{ fontSize: 32 }}>🎂</Text>
          <Text style={photoStyles.placeholderText}>Tap to add photo</Text>
        </View>
      )}
      <View style={photoStyles.editBadge}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>EDIT</Text></View>
    </TouchableOpacity>
  );
}

// ── CakeCard ──────────────────────────────────────────────────────────────────
function CakeCard({ item, onEdit, onDelete, onToggle }) {
  const cat     = item.extraFields?.category || "Custom";
  const palette = CAT_COLORS[cat] || { bg: "#f1f5f9", text: "#475569" };
  const flavors = item.extraFields?.flavors || [];
  const sizes   = item.extraFields?.sizes   || [];

  return (
    <View style={cardStyles.card}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={cardStyles.cover} />
      ) : (
        <View style={[cardStyles.coverPlaceholder, { backgroundColor: palette.bg }]}>
          <Text style={{ fontSize: 40 }}>🎂</Text>
        </View>
      )}

      <View style={[cardStyles.catBadge, { backgroundColor: palette.bg }]}>
        <Text style={[cardStyles.catBadgeText, { color: palette.text }]}>{cat}</Text>
      </View>

      <View style={cardStyles.toggleWrap}>
        <Switch
          value={item.inStock !== false}
          onValueChange={v => onToggle(item, v)}
          trackColor={{ false: Colors.border, true: "#ec489966" }}
          thumbColor={item.inStock !== false ? "#ec4899" : Colors.textMuted}
          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
        />
      </View>

      <View style={cardStyles.body}>
        <Text style={cardStyles.name} numberOfLines={2}>{item.name}</Text>

        {/* Available flavors */}
        {flavors.length > 0 && (
          <View style={cardStyles.flavorsRow}>
            {flavors.slice(0, 4).map(f => (
              <Text key={f} style={cardStyles.flavorChip}>{f}</Text>
            ))}
            {flavors.length > 4 && (
              <Text style={cardStyles.moreChip}>+{flavors.length - 4} more</Text>
            )}
          </View>
        )}

        {/* Sizes */}
        {sizes.length > 0 && (
          <Text style={cardStyles.sizes}>Sizes: {sizes.join(" · ")}</Text>
        )}

        <View style={cardStyles.footer}>
          <View>
            <Text style={cardStyles.price}>₹{Number(item.price || 0).toLocaleString("en-IN")}</Text>
            <Text style={cardStyles.priceLabel}>per kg</Text>
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
      </View>
    </View>
  );
}

// ── Add/Edit Modal ────────────────────────────────────────────────────────────
function CakeModal({ visible, initial, onSave, onClose }) {
  const isEdit = !!initial;
  const [name,        setName]        = useState("");
  const [price,       setPrice]       = useState("");
  const [category,    setCategory]    = useState("Birthday");
  const [flavors,     setFlavors]     = useState([]);
  const [sizes,       setSizes]       = useState([]);
  const [description, setDescription] = useState("");
  const [photoUri,    setPhotoUri]    = useState(null);
  const [saving,      setSaving]      = useState(false);

  React.useEffect(() => {
    if (visible) {
      if (initial) {
        setName(initial.name || "");
        setPrice(initial.price != null ? String(initial.price) : "");
        setCategory(initial.extraFields?.category || "Birthday");
        setFlavors(initial.extraFields?.flavors  || []);
        setSizes(initial.extraFields?.sizes    || []);
        setDescription(initial.description || "");
        setPhotoUri(initial.image_url || null);
      } else {
        setName(""); setPrice(""); setCategory("Birthday");
        setFlavors([]); setSizes([]); setDescription(""); setPhotoUri(null);
      }
    }
  }, [visible, initial]);

  function toggleFlavor(f) {
    setFlavors(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }

  function toggleSize(s) {
    setSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function handleSave() {
    if (!name.trim())  { Alert.alert("Missing", "Enter cake name.");   return; }
    if (!price.trim()) { Alert.alert("Missing", "Enter price per kg."); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      price: parseFloat(price) || 0,
      description: description.trim(),
      image_url: photoUri,
      extraFields: { category, flavors, sizes },
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
          <Text style={modalStyles.title}>{isEdit ? "Edit Cake" : "Add Cake"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}
            style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]}>
            <Text style={modalStyles.saveTxt}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>

            <Text style={modalStyles.label}>PHOTO</Text>
            <PhotoPicker uri={photoUri} onChange={setPhotoUri} />

            <Text style={modalStyles.label}>CATEGORY</Text>
            <ChipRow
              items={CATEGORIES.filter(c => c !== "All")}
              selected={category}
              onSelect={setCategory}
              colors={CAT_COLORS}
            />

            <Text style={[modalStyles.label, { marginTop: 8 }]}>CAKE NAME *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Dark Chocolate Truffle Cake"
              placeholderTextColor={Colors.textMuted}
              value={name} onChangeText={setName}
            />

            <Text style={modalStyles.label}>PRICE PER KG (₹) *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 800"
              placeholderTextColor={Colors.textMuted}
              value={price} onChangeText={setPrice}
              keyboardType="numeric"
            />

            <Text style={modalStyles.label}>AVAILABLE FLAVORS (select all that apply)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {FLAVORS_LIST.map(f => {
                const active = flavors.includes(f);
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => toggleFlavor(f)}
                    style={[modalStyles.flavorChip, active && modalStyles.flavorChipActive]}
                  >
                    <Text style={[modalStyles.flavorChipText, active && modalStyles.flavorChipTextActive]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={modalStyles.label}>AVAILABLE SIZES</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {SIZES.map(s => {
                const active = sizes.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleSize(s)}
                    style={[modalStyles.flavorChip, active && modalStyles.flavorChipActive]}
                  >
                    <Text style={[modalStyles.flavorChipText, active && modalStyles.flavorChipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={modalStyles.label}>DESCRIPTION / SPECIAL NOTE</Text>
            <TextInput
              style={[modalStyles.input, { height: 80 }]}
              placeholder="Custom design available, order 2 days in advance…"
              placeholderTextColor={Colors.textMuted}
              value={description} onChangeText={setDescription}
              multiline textAlignVertical="top"
            />

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CakeMenuScreen() {
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget,setEditTarget]= useState(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    setLoading(true);
    try { setItems((await fetchCatalog()) || []); }
    catch { Alert.alert("Error", "Could not load menu."); }
    finally { setLoading(false); }
  }

  const filtered = filter === "All"
    ? items
    : items.filter(i => i.extraFields?.category === filter);

  async function handleSave(payload, editId) {
    try {
      editId ? await updateProduct(editId, payload) : await addProduct(payload);
      setModalOpen(false); setEditTarget(null); await load();
    } catch { Alert.alert("Error", "Could not save."); }
  }

  async function handleDelete(item) {
    Alert.alert("Delete", `Remove "${item.name}" from menu?`, [
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
        {CATEGORIES.map(c => {
          const active  = c === filter;
          const palette = CAT_COLORS[c];
          return (
            <TouchableOpacity key={c} onPress={() => setFilter(c)}
              style={[chipStyles.chip, active && (palette
                ? { backgroundColor: palette.bg, borderColor: palette.text + "66" }
                : chipStyles.chipActive)]}>
              <Text style={[chipStyles.chipText, active && (palette
                ? { color: palette.text, fontWeight: "800" }
                : chipStyles.chipTextActive)]}>
                {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.countBar}>
        <Text style={styles.countText}>{filtered.length} {filter === "All" ? "cakes & items" : filter}</Text>
        <TouchableOpacity onPress={() => { setEditTarget(null); setModalOpen(true); }}
          style={styles.addBtn} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎂</Text>
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptyDesc}>Add cakes and bakery items to your menu</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <CakeCard item={item}
              onEdit={i => { setEditTarget(i); setModalOpen(true); }}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          )}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <CakeModal
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
  countBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  countText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  addBtn  : { backgroundColor: "#ec4899", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  empty   : { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyIcon : { fontSize: 52, marginBottom: 4 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  emptyDesc : { color: Colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
});

const chipStyles = StyleSheet.create({
  chip         : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  chipActive   : { backgroundColor: "#ec489922", borderColor: "#ec489988" },
  chipText     : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#ec4899", fontWeight: "800" },
});

const photoStyles = StyleSheet.create({
  wrap       : { borderRadius: 12, overflow: "hidden", height: 140, marginBottom: 16, position: "relative" },
  img        : { width: "100%", height: "100%", resizeMode: "cover" },
  placeholder: { width: "100%", height: "100%", backgroundColor: Colors.bgCard, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border, alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12 },
  placeholderText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  editBadge  : { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
});

const cardStyles = StyleSheet.create({
  card    : { backgroundColor: Colors.bgCard, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  cover   : { width: "100%", height: 140, resizeMode: "cover" },
  coverPlaceholder: { width: "100%", height: 100, alignItems: "center", justifyContent: "center" },
  catBadge    : { position: "absolute", top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catBadgeText: { fontSize: 11, fontWeight: "800" },
  toggleWrap  : { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 2 },
  body    : { padding: 14 },
  name    : { color: Colors.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  flavorsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 6 },
  flavorChip: { backgroundColor: Colors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border },
  moreChip  : { color: "#ec4899", fontSize: 11, fontWeight: "700" },
  sizes     : { color: Colors.textMuted, fontSize: 11, marginBottom: 8 },
  footer  : { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  price   : { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  priceLabel: { color: Colors.textMuted, fontSize: 11 },
  btnEdit : { backgroundColor: "#ec489918", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "#ec489944" },
  btnEditText: { color: "#ec4899", fontSize: 12, fontWeight: "700" },
  btnDel  : { backgroundColor: "rgba(239,68,68,0.1)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  btnDelText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
  root   : { flex: 1, backgroundColor: Colors.bg },
  header : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title  : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  closeBtn: { padding: 4, minWidth: 32 },
  closeTxt: { color: Colors.textSecondary, fontSize: 18 },
  saveBtn : { backgroundColor: "#ec4899", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveTxt : { color: "#fff", fontSize: 13, fontWeight: "800" },
  body    : { flex: 1, padding: 16 },
  label   : { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  input   : { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 15, marginBottom: 14 },
  flavorChip     : { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  flavorChipActive: { backgroundColor: "#ec489922", borderColor: "#ec489988" },
  flavorChipText : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  flavorChipTextActive: { color: "#ec4899", fontWeight: "800" },
});
