// ── PackagesScreen.jsx — Tourism Package Catalog ─────────────────────────────
// Ground-up tourism catalog with destination filters, package cards,
// duration/group chips, inclusions, and add/edit modal.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  Modal, TextInput, Switch, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { Colors }        from "../constants/colors";
import { fetchCatalog, addProduct, updateProduct, deleteProduct } from "../lib/api";

// ── Destination categories ────────────────────────────────────────────────────
const DESTINATIONS = [
  "All", "Domestic", "International", "Hill Station", "Beach",
  "Heritage", "Adventure", "Wildlife", "Spiritual", "Honeymoon",
];

const DEST_COLORS = {
  "Domestic"     : { bg: "#dbeafe", text: "#1d4ed8" },
  "International": { bg: "#fce7f3", text: "#be185d" },
  "Hill Station" : { bg: "#d1fae5", text: "#065f46" },
  "Beach"        : { bg: "#fed7aa", text: "#c2410c" },
  "Heritage"     : { bg: "#ede9fe", text: "#6d28d9" },
  "Adventure"    : { bg: "#fef3c7", text: "#92400e" },
  "Wildlife"     : { bg: "#d1fae5", text: "#166534" },
  "Spiritual"    : { bg: "#fce7f3", text: "#9d174d" },
  "Honeymoon"    : { bg: "#fecdd3", text: "#be123c" },
};

// ── Sub-destinations per category ─────────────────────────────────────────────
const SUB_DESTINATIONS = {
  "Domestic"     : ["Rajasthan", "Kerala", "Goa", "Himachal", "Uttarakhand", "Tamil Nadu", "Karnataka"],
  "International": ["Dubai", "Thailand", "Bali", "Maldives", "Europe", "Singapore", "Sri Lanka"],
  "Hill Station" : ["Manali", "Shimla", "Darjeeling", "Munnar", "Ooty", "Nainital"],
  "Beach"        : ["Goa", "Andaman", "Lakshadweep", "Pondicherry", "Kovalam"],
  "Heritage"     : ["Rajasthan", "Agra", "Varanasi", "Hampi", "Mysore", "Khajuraho"],
  "Adventure"    : ["Ladakh", "Rishikesh", "Spiti", "Zanskar", "Auli", "Chopta"],
  "Wildlife"     : ["Jim Corbett", "Kaziranga", "Ranthambore", "Sunderbans", "Bandhavgarh"],
  "Spiritual"    : ["Varanasi", "Rishikesh", "Tirupati", "Haridwar", "Dwarka", "Shirdi"],
  "Honeymoon"    : ["Maldives", "Bali", "Kashmir", "Andaman", "Coorg", "Shimla"],
};

// ── Inclusions ────────────────────────────────────────────────────────────────
const INCLUSIONS_LIST = [
  { key: "hotel",     label: "Hotel",      icon: "🏨" },
  { key: "flight",    label: "Flights",    icon: "✈️" },
  { key: "meals",     label: "Meals",      icon: "🍽️" },
  { key: "transport", label: "Transport",  icon: "🚌" },
  { key: "guide",     label: "Guide",      icon: "🧭" },
  { key: "visa",      label: "Visa",       icon: "📋" },
  { key: "insurance", label: "Insurance",  icon: "🛡️" },
  { key: "activities",label: "Activities", icon: "🎯" },
];

// ── ChipRow ───────────────────────────────────────────────────────────────────
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
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow gallery access to pick a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      aspect: [16, 9],
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      onChange(result.assets[0].uri);
    }
  }

  return (
    <TouchableOpacity onPress={pick} style={photoStyles.wrap} activeOpacity={0.8}>
      {uri ? (
        <Image source={{ uri }} style={photoStyles.img} />
      ) : (
        <View style={photoStyles.placeholder}>
          <Text style={photoStyles.placeholderIcon}>🏖️</Text>
          <Text style={photoStyles.placeholderText}>Tap to add cover photo</Text>
          <Text style={photoStyles.placeholderHint}>16:9 recommended</Text>
        </View>
      )}
      <View style={photoStyles.editBadge}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>EDIT</Text></View>
    </TouchableOpacity>
  );
}

// ── InclusionToggle ───────────────────────────────────────────────────────────
function InclusionToggle({ inclusions, onChange }) {
  function toggle(key) {
    const set = new Set(inclusions);
    set.has(key) ? set.delete(key) : set.add(key);
    onChange([...set]);
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {INCLUSIONS_LIST.map(inc => {
        const active = inclusions.includes(inc.key);
        return (
          <TouchableOpacity
            key={inc.key}
            onPress={() => toggle(inc.key)}
            style={[
              incStyles.chip,
              active && incStyles.chipActive,
            ]}
          >
            <Text style={{ fontSize: 14 }}>{inc.icon}</Text>
            <Text style={[incStyles.label, active && incStyles.labelActive]}>{inc.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── PackageCard ───────────────────────────────────────────────────────────────
function PackageCard({ item, onEdit, onDelete, onToggle }) {
  const dest    = item.extraFields?.destination || "Domestic";
  const palette = DEST_COLORS[dest] || { bg: "#e2e8f0", text: "#475569" };
  const incl    = item.extraFields?.inclusions || [];
  const nights  = item.extraFields?.nights    || "";
  const days    = item.extraFields?.days      || "";
  const groupSz = item.extraFields?.groupSize || "";
  const pickup  = item.extraFields?.pickup    || "";

  const inclChips = INCLUSIONS_LIST.filter(i => incl.includes(i.key));

  return (
    <View style={cardStyles.card}>
      {/* Cover image */}
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={cardStyles.cover} />
      ) : (
        <View style={[cardStyles.coverPlaceholder, { backgroundColor: palette.bg }]}>
          <Text style={{ fontSize: 36 }}>🌍</Text>
        </View>
      )}

      {/* Destination badge */}
      <View style={[cardStyles.destBadge, { backgroundColor: palette.bg }]}>
        <Text style={[cardStyles.destBadgeText, { color: palette.text }]}>{dest}</Text>
      </View>

      {/* Availability toggle */}
      <View style={cardStyles.toggleWrap}>
        <Switch
          value={item.inStock !== false}
          onValueChange={(v) => onToggle(item, v)}
          trackColor={{ false: Colors.border, true: Colors.primary + "66" }}
          thumbColor={item.inStock !== false ? Colors.primary : Colors.textMuted}
          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
        />
      </View>

      <View style={cardStyles.body}>
        {/* Package name */}
        <Text style={cardStyles.name} numberOfLines={2}>{item.name}</Text>

        {/* Meta chips */}
        <View style={cardStyles.metaRow}>
          {nights ? (
            <View style={cardStyles.metaChip}>
              <Text style={cardStyles.metaChipText}>🌙 {nights}N/{days}D</Text>
            </View>
          ) : null}
          {groupSz ? (
            <View style={cardStyles.metaChip}>
              <Text style={cardStyles.metaChipText}>👥 Up to {groupSz}</Text>
            </View>
          ) : null}
          {pickup ? (
            <View style={cardStyles.metaChip}>
              <Text style={cardStyles.metaChipText}>📍 {pickup}</Text>
            </View>
          ) : null}
        </View>

        {/* Inclusions row */}
        {inclChips.length > 0 && (
          <View style={cardStyles.inclRow}>
            {inclChips.slice(0, 5).map(i => (
              <Text key={i.key} style={cardStyles.inclChip}>{i.icon} {i.label}</Text>
            ))}
            {inclChips.length > 5 && (
              <Text style={cardStyles.inclMore}>+{inclChips.length - 5}</Text>
            )}
          </View>
        )}

        {/* Price + actions */}
        <View style={cardStyles.footer}>
          <View>
            <Text style={cardStyles.price}>
              ₹{Number(item.price || 0).toLocaleString("en-IN")}
            </Text>
            <Text style={cardStyles.priceLabel}>per person</Text>
          </View>
          <View style={cardStyles.actions}>
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

// ── PackageModal — Add/Edit ───────────────────────────────────────────────────
function PackageModal({ visible, initial, onSave, onClose }) {
  const isEdit = !!initial;

  const [name,        setName]        = useState("");
  const [price,       setPrice]       = useState("");
  const [nights,      setNights]      = useState("");
  const [days,        setDays]        = useState("");
  const [groupSize,   setGroupSize]   = useState("");
  const [destination, setDestination] = useState("Domestic");
  const [subDest,     setSubDest]     = useState("");
  const [inclusions,  setInclusions]  = useState([]);
  const [pickup,      setPickup]      = useState("");
  const [highlights,  setHighlights]  = useState("");
  const [description, setDescription] = useState("");
  const [photoUri,    setPhotoUri]    = useState(null);
  const [saving,      setSaving]      = useState(false);

  // Populate on open
  React.useEffect(() => {
    if (visible) {
      if (initial) {
        setName(initial.name || "");
        setPrice(initial.price ? String(initial.price) : "");
        setNights(initial.extraFields?.nights      || "");
        setDays(initial.extraFields?.days          || "");
        setGroupSize(initial.extraFields?.groupSize|| "");
        setDestination(initial.extraFields?.destination || "Domestic");
        setSubDest(initial.extraFields?.subDest    || "");
        setInclusions(initial.extraFields?.inclusions || []);
        setPickup(initial.extraFields?.pickup      || "");
        setHighlights(initial.extraFields?.highlights || "");
        setDescription(initial.description || "");
        setPhotoUri(initial.image_url || null);
      } else {
        setName(""); setPrice(""); setNights(""); setDays("");
        setGroupSize(""); setDestination("Domestic"); setSubDest("");
        setInclusions([]); setPickup(""); setHighlights("");
        setDescription(""); setPhotoUri(null);
      }
    }
  }, [visible, initial]);

  async function handleSave() {
    if (!name.trim())  { Alert.alert("Missing", "Enter a package name.");    return; }
    if (!price.trim()) { Alert.alert("Missing", "Enter price per person."); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      price: parseFloat(price) || 0,
      description: description.trim(),
      image_url: photoUri,
      extraFields: {
        destination, subDest,
        nights, days, groupSize,
        inclusions, pickup, highlights,
      },
    };
    await onSave(payload, isEdit ? initial.id : null);
    setSaving(false);
  }

  const subDestList = SUB_DESTINATIONS[destination] || [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.root}>
        {/* Header */}
        <View style={modalStyles.header}>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
            <Text style={modalStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={modalStyles.title}>{isEdit ? "Edit Package" : "Add Package"}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]}
          >
            <Text style={modalStyles.saveTxt}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>

            {/* Cover Photo */}
            <Text style={modalStyles.sectionLabel}>COVER PHOTO</Text>
            <PhotoPicker uri={photoUri} onChange={setPhotoUri} />

            {/* Destination */}
            <Text style={modalStyles.sectionLabel}>DESTINATION TYPE</Text>
            <ChipRow
              items={DESTINATIONS.filter(d => d !== "All")}
              selected={destination}
              onSelect={(d) => { setDestination(d); setSubDest(""); }}
              colors={DEST_COLORS}
            />

            {/* Sub-destination */}
            {subDestList.length > 0 && (
              <>
                <Text style={modalStyles.sectionLabel}>LOCATION / REGION</Text>
                <ChipRow
                  items={subDestList}
                  selected={subDest}
                  onSelect={setSubDest}
                />
              </>
            )}

            {/* Name */}
            <Text style={modalStyles.sectionLabel}>PACKAGE NAME *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Bali Honeymoon Special 5N/6D"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            {/* Price */}
            <Text style={modalStyles.sectionLabel}>PRICE PER PERSON (₹) *</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 25000"
              placeholderTextColor={Colors.textMuted}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />

            {/* Duration */}
            <Text style={modalStyles.sectionLabel}>DURATION</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                style={[modalStyles.input, { flex: 1 }]}
                placeholder="Nights (e.g. 5)"
                placeholderTextColor={Colors.textMuted}
                value={nights}
                onChangeText={setNights}
                keyboardType="numeric"
              />
              <TextInput
                style={[modalStyles.input, { flex: 1 }]}
                placeholder="Days (e.g. 6)"
                placeholderTextColor={Colors.textMuted}
                value={days}
                onChangeText={setDays}
                keyboardType="numeric"
              />
            </View>

            {/* Group size */}
            <Text style={modalStyles.sectionLabel}>MAX GROUP SIZE</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. 20 people"
              placeholderTextColor={Colors.textMuted}
              value={groupSize}
              onChangeText={setGroupSize}
              keyboardType="numeric"
            />

            {/* Pickup location */}
            <Text style={modalStyles.sectionLabel}>PICKUP LOCATION</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="e.g. Delhi Airport / Mumbai Central"
              placeholderTextColor={Colors.textMuted}
              value={pickup}
              onChangeText={setPickup}
            />

            {/* Inclusions */}
            <Text style={modalStyles.sectionLabel}>INCLUSIONS</Text>
            <InclusionToggle inclusions={inclusions} onChange={setInclusions} />

            {/* Itinerary highlights */}
            <Text style={[modalStyles.sectionLabel, { marginTop: 16 }]}>ITINERARY HIGHLIGHTS</Text>
            <TextInput
              style={[modalStyles.input, modalStyles.inputMulti]}
              placeholder="Day 1: Arrive Bali, hotel check-in&#10;Day 2: Temple tour, Uluwatu sunset…"
              placeholderTextColor={Colors.textMuted}
              value={highlights}
              onChangeText={setHighlights}
              multiline
              textAlignVertical="top"
            />

            {/* Description */}
            <Text style={modalStyles.sectionLabel}>DESCRIPTION</Text>
            <TextInput
              style={[modalStyles.input, modalStyles.inputMulti]}
              placeholder="Add more details about this package…"
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

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PackagesScreen() {
  const [packages,    setPackages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("All");
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    try {
      const data = await fetchCatalog();
      setPackages(data || []);
    } catch (e) {
      Alert.alert("Error", "Could not load packages.");
    } finally {
      setLoading(false);
    }
  }

  // ── filtered list ──────────────────────────────────────────────────────────
  const filtered = filter === "All"
    ? packages
    : packages.filter(p => p.extraFields?.destination === filter);

  // ── handlers ───────────────────────────────────────────────────────────────
  async function handleSave(payload, editId) {
    try {
      if (editId) {
        await updateProduct(editId, payload);
      } else {
        await addProduct(payload);
      }
      setModalOpen(false);
      setEditTarget(null);
      await load();
    } catch (e) {
      Alert.alert("Error", "Could not save package.");
    }
  }

  function openEdit(item) {
    setEditTarget(item);
    setModalOpen(true);
  }

  function openAdd() {
    setEditTarget(null);
    setModalOpen(true);
  }

  async function handleDelete(item) {
    Alert.alert("Delete Package", `Delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteProduct(item.id);
            await load();
          } catch {
            Alert.alert("Error", "Could not delete.");
          }
        },
      },
    ]);
  }

  async function handleToggle(item, value) {
    try {
      await updateProduct(item.id, { inStock: value });
      setPackages(prev => prev.map(p => p.id === item.id ? { ...p, inStock: value } : p));
    } catch { /* silent */ }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Filter chips */}
      <ChipRow
        items={DESTINATIONS}
        selected={filter}
        onSelect={setFilter}
        colors={DEST_COLORS}
      />

      {/* Count bar */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {filtered.length} {filter === "All" ? "packages" : filter + " packages"}
        </Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add Package</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🌍</Text>
          <Text style={styles.emptyTitle}>No packages yet</Text>
          <Text style={styles.emptyDesc}>Tap "+ Add Package" to create your first travel package</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <PackageCard
              item={item}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          )}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add/Edit Modal */}
      <PackageModal
        visible={modalOpen}
        initial={editTarget}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root    : { flex: 1, backgroundColor: Colors.bg },
  countBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  countText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  addBtn  : { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  empty   : { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  emptyIcon : { fontSize: 52, marginBottom: 4 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyDesc : { color: Colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
});

const chipStyles = StyleSheet.create({
  chip         : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  chipActive   : { backgroundColor: Colors.primary + "22", borderColor: Colors.primary + "66" },
  chipText     : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: Colors.primary, fontWeight: "800" },
});

const photoStyles = StyleSheet.create({
  wrap       : { borderRadius: 12, overflow: "hidden", height: 160, marginBottom: 16, position: "relative" },
  img        : { width: "100%", height: "100%", resizeMode: "cover" },
  placeholder: { width: "100%", height: "100%", backgroundColor: Colors.bgCard, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12 },
  placeholderIcon: { fontSize: 32 },
  placeholderText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  placeholderHint: { color: Colors.textMuted, fontSize: 11 },
  editBadge  : { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
});

const incStyles = StyleSheet.create({
  chip     : { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary + "18", borderColor: Colors.primary + "55" },
  label    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  labelActive: { color: Colors.primary, fontWeight: "700" },
});

const cardStyles = StyleSheet.create({
  card    : { backgroundColor: Colors.bgCard, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  cover   : { width: "100%", height: 150, resizeMode: "cover" },
  coverPlaceholder: { width: "100%", height: 120, alignItems: "center", justifyContent: "center" },
  destBadge    : { position: "absolute", top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  destBadgeText: { fontSize: 11, fontWeight: "800" },
  toggleWrap   : { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 14, padding: 2 },
  body    : { padding: 14 },
  name    : { color: Colors.textPrimary, fontSize: 16, fontWeight: "800", marginBottom: 8 },
  metaRow : { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  metaChip: { backgroundColor: Colors.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  metaChipText: { color: Colors.textSecondary, fontSize: 11, fontWeight: "600" },
  inclRow : { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 10 },
  inclChip: { color: Colors.textSecondary, fontSize: 11, backgroundColor: Colors.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  inclMore: { color: Colors.primary, fontSize: 11, fontWeight: "700" },
  footer  : { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  price   : { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  priceLabel: { color: Colors.textMuted, fontSize: 11 },
  actions : { flexDirection: "row", gap: 8 },
  btnEdit : { backgroundColor: Colors.primary + "18", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary + "44" },
  btnEditText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  btnDel  : { backgroundColor: "rgba(239,68,68,0.1)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  btnDelText: { color: "#ef4444", fontSize: 12, fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
  root   : { flex: 1, backgroundColor: Colors.bg },
  header : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title  : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  closeBtn: { padding: 4, minWidth: 32 },
  closeTxt: { color: Colors.textSecondary, fontSize: 18 },
  saveBtn : { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveTxt : { color: "#fff", fontSize: 13, fontWeight: "800" },
  body    : { flex: 1, padding: 16 },
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
  input   : { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 15, marginBottom: 14 },
  inputMulti: { height: 100, lineHeight: 22 },
});
