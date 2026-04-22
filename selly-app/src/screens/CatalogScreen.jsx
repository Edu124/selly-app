import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, Image, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchCatalog, addProduct, toggleStock, deleteProduct, fetchInstaPost } from "../lib/api";

export default function CatalogScreen() {
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [search, setSearch]         = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchCatalog();
      setProducts(d.products || []);
    } catch (e) {
      console.warn(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const toggle = async (id, current) => {
    try {
      await toggleStock(id, !current);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, inStock: !current } : p));
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const del = (id, name) => {
    Alert.alert("Delete Product", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteProduct(id);
            setProducts(prev => prev.filter(p => p.id !== id));
          } catch (e) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  };

  const filtered = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <View style={styles.container}>
      {/* Search + Add */}
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Text>🔍 </Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countLabel}>{filtered.length} products</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => String(p.id)}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onToggle={() => toggle(item.id, item.inStock)}
              onDelete={() => del(item.id, item.name)}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No products yet</Text></View>}
        />
      )}

      <AddProductModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={(p) => { setProducts(prev => [p, ...prev]); setShowAdd(false); }}
      />
    </View>
  );
}

function ProductCard({ product: p, onToggle, onDelete }) {
  return (
    <View style={styles.card}>
      {p.imageUrl ? (
        <Image source={{ uri: p.imageUrl }} style={styles.productImage} />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Text style={{ fontSize: 28 }}>📦</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.productPrice}>₹{(p.price || 0).toLocaleString("en-IN")}</Text>
        </View>
        <Text style={styles.productCategory}>{p.category}</Text>
        {p.instaPostUrl ? <Text style={styles.postBadge}>📸 Instagram post</Text> : null}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.stockBtn, { backgroundColor: p.inStock ? Colors.green + "22" : Colors.red + "22" }]}
            onPress={onToggle}
          >
            <Text style={[styles.stockText, { color: p.inStock ? Colors.green : Colors.red }]}>
              {p.inStock ? "✓ In Stock" : "✗ Out of Stock"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function AddProductModal({ visible, onClose, onAdded }) {
  const blank = { name: "", price: "", category: "", description: "", sizes: "", imageUrl: "", instaPostUrl: "" };
  const [form, setForm]       = useState(blank);
  const [saving, setSaving]   = useState(false);
  const [fetching, setFetching] = useState(false);
  const [instaError, setInstaError] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onInstaBlur = async () => {
    if (!form.instaPostUrl.trim()) return;
    setFetching(true);
    setInstaError("");
    try {
      const d = await fetchInstaPost(form.instaPostUrl.trim());
      if (d.ok) {
        setForm(f => ({
          ...f,
          name    : f.name || d.name || "",
          category: f.category || d.category || "",
          imageUrl: d.imageUrl || f.imageUrl,
        }));
      } else {
        setInstaError(d.error || "Could not fetch post");
      }
    } catch (e) {
      setInstaError("Network error: " + e.message);
    } finally {
      setFetching(false);
    }
  };

  const submit = async () => {
    if (!form.name.trim() || !form.price) {
      Alert.alert("Missing fields", "Name and price are required."); return;
    }
    setSaving(true);
    try {
      const payload = {
        name       : form.name.trim(),
        price      : Number(form.price),
        category   : form.category.trim() || "General",
        description: form.description.trim(),
        sizes      : form.sizes ? form.sizes.split(",").map(s => s.trim()).filter(Boolean) : [],
        imageUrl   : form.imageUrl.trim(),
        instaPostUrl: form.instaPostUrl.trim(),
        inStock    : true,
      };
      const d = await addProduct(payload);
      onAdded(d.product || payload);
      setForm(blank);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Product</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Instagram URL */}
            <Text style={styles.fieldLabel}>Instagram Post URL (optional)</Text>
            <View style={styles.instaRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="https://instagram.com/p/…"
                placeholderTextColor={Colors.textMuted}
                value={form.instaPostUrl}
                onChangeText={v => set("instaPostUrl", v)}
                onBlur={onInstaBlur}
                autoCapitalize="none"
              />
              {fetching && <ActivityIndicator color={Colors.primary} style={{ marginLeft: 8 }} />}
            </View>
            {instaError ? <Text style={styles.errorText}>{instaError}</Text> : null}
            {form.imageUrl ? (
              <Image source={{ uri: form.imageUrl }} style={styles.previewImage} />
            ) : null}

            <Text style={styles.fieldLabel}>Product Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={v => set("name", v)} placeholder="e.g. Silk Saree" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Price (₹) *</Text>
            <TextInput style={styles.input} value={form.price} onChangeText={v => set("price", v)} keyboardType="numeric" placeholder="1500" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Category</Text>
            <TextInput style={styles.input} value={form.category} onChangeText={v => set("category", v)} placeholder="Sarees, Kurtis, Candles…" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Sizes (comma-separated)</Text>
            <TextInput style={styles.input} value={form.sizes} onChangeText={v => set("sizes", v)} placeholder="S, M, L, XL" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              value={form.description}
              onChangeText={v => set("description", v)}
              placeholder="Short description…"
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            <Text style={styles.fieldLabel}>Image URL (if not using Instagram post)</Text>
            <TextInput style={styles.input} value={form.imageUrl} onChangeText={v => set("imageUrl", v)} placeholder="https://…" placeholderTextColor={Colors.textMuted} autoCapitalize="none" />

            <TouchableOpacity
              style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>Add Product</Text>
              }
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: Colors.bg },
  center      : { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar      : { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  searchWrap  : { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput : { flex: 1, color: Colors.textPrimary, paddingVertical: 10, fontSize: 14 },
  addBtn      : { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  addBtnText  : { color: "#fff", fontWeight: "800", fontSize: 14 },
  countLabel  : { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  list        : { padding: 16, gap: 12, paddingBottom: 32 },
  empty       : { alignItems: "center", paddingTop: 60 },
  emptyText   : { color: Colors.textMuted, fontSize: 15 },

  // Card
  card        : { backgroundColor: Colors.bgCard, borderRadius: 14, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  productImage: { width: 90, height: 90 },
  productImagePlaceholder: { width: 90, height: 90, backgroundColor: Colors.bgInput, alignItems: "center", justifyContent: "center" },
  cardBody    : { flex: 1, padding: 12 },
  cardRow     : { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
  productName : { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", flex: 1, marginRight: 8 },
  productPrice: { color: Colors.primary, fontSize: 15, fontWeight: "800" },
  productCategory: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  postBadge   : { color: Colors.accent, fontSize: 11, marginBottom: 6 },
  cardActions : { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  stockBtn    : { flex: 1, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, alignItems: "center" },
  stockText   : { fontSize: 12, fontWeight: "700" },
  deleteBtn   : { padding: 6 },
  deleteBtnText: { fontSize: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet  : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "95%" },
  modalHandle : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle  : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  closeBtn    : { color: Colors.textSecondary, fontSize: 20, padding: 4 },

  fieldLabel  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input       : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  instaRow    : { flexDirection: "row", alignItems: "center" },
  errorText   : { color: Colors.red, fontSize: 12, marginTop: 4 },
  previewImage: { width: "100%", height: 180, borderRadius: 10, marginTop: 8 },

  submitBtn   : { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText  : { color: "#fff", fontWeight: "800", fontSize: 16 },
});
