// ── CoursesScreen ─────────────────────────────────────────────────────────────
// Education industry — dedicated course catalog screen
// Subject filter chips · mode badges · batch timing · availability toggle
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, Image, Alert, Switch,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "../constants/colors";
import {
  fetchCatalog, addProduct, updateProduct,
  toggleStock, deleteProduct, uploadProductImage,
} from "../lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────
const SUBJECTS = [
  "All","Programming","Design","Languages","Arts & Crafts",
  "Science","Mathematics","Music","Fitness","Business","Other",
];
const SUB_SUBJECTS = {
  "Programming" : ["Web Development","Mobile Apps","Data Science","AI/ML","Cybersecurity","Cloud Computing"],
  "Design"      : ["UI/UX","Graphic Design","Animation","3D Modelling","Video Editing"],
  "Languages"   : ["English","Hindi","French","Spanish","Japanese","Arabic","German"],
  "Music"       : ["Guitar","Piano","Vocals","Tabla","Violin","Flute","DJ"],
  "Fitness"     : ["Yoga","Zumba","Cricket","Football","Martial Arts","Swimming","Cycling"],
  "Business"    : ["Digital Marketing","Finance","HR","Entrepreneurship","Sales","Accounting"],
  "Arts & Crafts": ["Painting","Pottery","Jewellery Making","Photography","Embroidery"],
  "Science"     : ["Physics","Chemistry","Biology","Astronomy"],
  "Mathematics" : ["Algebra","Calculus","Statistics","Mental Maths"],
};
const SUBJECT_COLORS = {
  "Programming" : "#6C47FF", "Design"      : "#0EA5E9", "Languages"   : "#10B981",
  "Arts & Crafts": "#F59E0B", "Science"    : "#EF4444", "Mathematics" : "#8B5CF6",
  "Music"       : "#EC4899", "Fitness"     : "#14B8A6", "Business"    : "#F97316",
  "Other"       : "#6B7280",
};
const MODE_CONFIG = {
  "Online" : { bg: "rgba(14,165,233,0.15)",  text: "#0ea5e9", icon: "💻" },
  "Offline": { bg: "rgba(245,158,11,0.15)",  text: "#f59e0b", icon: "🏫" },
  "Hybrid" : { bg: "rgba(168,85,247,0.15)",  text: "#a855f7", icon: "🔄" },
};

// ── Chip Row ──────────────────────────────────────────────────────────────────
function ChipRow({ items, selected, onSelect, color, multi }) {
  const c = color || Colors.primary;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
        {items.map(item => {
          const active = multi
            ? Array.isArray(selected) && selected.includes(item)
            : selected === item;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, active && { backgroundColor: c + "33", borderColor: c }]}
              onPress={() => onSelect(item)}
            >
              <Text style={[styles.chipText, active && { color: c, fontWeight: "700" }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Photo Picker ──────────────────────────────────────────────────────────────
function PhotoPicker({ imageUrl, onPicked, uploading }) {
  const pick = async (src) => {
    const perm = src === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed"); return; }
    const res = src === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [16, 9] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [16, 9], mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!res.canceled && res.assets?.[0]?.uri) onPicked(res.assets[0].uri);
  };
  return (
    <View style={styles.photoWrap}>
      {imageUrl ? (
        <View>
          <Image source={{ uri: imageUrl }} style={styles.photoPreview} />
          <TouchableOpacity style={styles.photoChangeBtn} onPress={() => pick("gallery")}>
            <Text style={styles.photoChangeBtnText}>✏️ Change Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoEmpty}>
          {uploading ? <ActivityIndicator color={Colors.primary} /> : (
            <>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pick("camera")}>
                <Text style={styles.photoBtnIcon}>📷</Text>
                <Text style={styles.photoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pick("gallery")}>
                <Text style={styles.photoBtnIcon}>🖼️</Text>
                <Text style={styles.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ── Course Card ───────────────────────────────────────────────────────────────
function CourseCard({ course, onToggle, onEdit, onDelete }) {
  const ef       = course.extraFields || {};
  const subjColor = SUBJECT_COLORS[course.category] || Colors.primary;
  const modeConf  = MODE_CONFIG[ef.mode] || MODE_CONFIG["Online"];
  const available = course.inStock !== false;

  return (
    <View style={[styles.card, !available && styles.cardUnavailable]}>
      {/* Thumbnail */}
      {course.imageUrl ? (
        <Image source={{ uri: course.imageUrl }} style={styles.cardThumb} />
      ) : (
        <View style={[styles.cardThumbEmpty, { backgroundColor: subjColor + "22" }]}>
          <Text style={{ fontSize: 28 }}>📚</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        {/* Subject + Mode badges */}
        <View style={styles.badgeRow}>
          {course.category ? (
            <View style={[styles.subjectBadge, { backgroundColor: subjColor + "22" }]}>
              <Text style={[styles.subjectBadgeText, { color: subjColor }]}>{course.category}</Text>
            </View>
          ) : null}
          {ef.mode ? (
            <View style={[styles.modeBadge, { backgroundColor: modeConf.bg }]}>
              <Text style={[styles.modeBadgeText, { color: modeConf.text }]}>{modeConf.icon} {ef.mode}</Text>
            </View>
          ) : null}
        </View>

        {/* Course name */}
        <Text style={styles.courseName} numberOfLines={2}>{course.name}</Text>

        {/* Duration + Batch + Class Link */}
        <View style={styles.metaRow}>
          {ef.duration    && <Text style={styles.metaChip}>⏱ {ef.duration}</Text>}
          {ef.batchTiming && <Text style={styles.metaChip}>📅 {ef.batchTiming}</Text>}
          {ef.classLink   && <Text style={styles.metaChip}>🔗 Class Link Set</Text>}
        </View>

        {/* Price + actions */}
        <View style={styles.cardFooter}>
          <Text style={styles.price}>₹{(course.price || 0).toLocaleString("en-IN")}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.availBtn, { backgroundColor: available ? Colors.green + "22" : Colors.red + "22" }]}
              onPress={onToggle}
            >
              <Text style={[styles.availText, { color: available ? Colors.green : Colors.red }]}>
                {available ? "✓ Available" : "✗ Unavailable"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onEdit}>
              <Text style={styles.iconBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onDelete}>
              <Text style={styles.iconBtnText}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
const BLANK = {
  name: "", price: "", category: "", subCategory: "", description: "",
  imageUrl: "", duration: "", batchTiming: "", mode: "Online", whatIncluded: "",
  classLink: "",
};

function toForm(c) {
  const ef = c.extraFields || {};
  return {
    name        : c.name         || "",
    price       : String(c.price || ""),
    category    : c.category     || "",
    subCategory : c.subCategory  || "",
    description : c.description  || "",
    imageUrl    : c.imageUrl     || "",
    duration    : ef.duration    || "",
    batchTiming : ef.batchTiming || "",
    mode        : ef.mode        || "Online",
    whatIncluded: ef.whatIncluded|| "",
    classLink   : ef.classLink   || "",
  };
}

function CourseModal({ visible, course, onClose, onDone }) {
  const isEdit = !!course;
  const [form,      setForm]      = useState(course ? toForm(course) : { ...BLANK });
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    setForm(course ? toForm(course) : { ...BLANK });
  }, [course?.id, visible]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhoto = async (uri) => {
    setUploading(true);
    try {
      const url = await uploadProductImage(uri, course?.id || Date.now().toString());
      set("imageUrl", url);
    } catch (e) { Alert.alert("Upload failed", e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.name.trim()) { Alert.alert("Required", "Course name is required."); return; }
    if (!form.price || isNaN(Number(form.price))) { Alert.alert("Required", "Please enter valid fees."); return; }
    setSaving(true);
    try {
      const payload = {
        name       : form.name.trim(),
        price      : Number(form.price),
        category   : form.category  || "Other",
        subCategory: form.subCategory || null,
        description: form.description.trim(),
        imageUrl   : form.imageUrl.trim(),
        sizes: [], colors: [], material: "", isPremium: false,
        extraFields: {
          ...(form.duration     && { duration     : form.duration     }),
          ...(form.batchTiming  && { batchTiming  : form.batchTiming  }),
          ...(form.mode         && { mode         : form.mode         }),
          ...(form.whatIncluded && { whatIncluded : form.whatIncluded }),
          ...(form.classLink    && { classLink    : form.classLink    }),
        },
      };
      if (isEdit) {
        const d = await updateProduct(course.id, payload);
        onDone(d.product || { ...course, ...payload });
      } else {
        const d = await addProduct({ ...payload, inStock: true });
        onDone(d.product || payload);
      }
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const subCats = SUB_SUBJECTS[form.category] || [];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? "Edit Course" : "Add Course"}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Course Photo / Banner</Text>
            <PhotoPicker imageUrl={form.imageUrl} onPicked={handlePhoto} uploading={uploading} />

            <Text style={styles.fieldLabel}>Subject *</Text>
            <ChipRow items={Object.keys(SUBJECT_COLORS)} selected={form.category}
              onSelect={v => { set("category", v); set("subCategory", ""); }}
              color={SUBJECT_COLORS[form.category] || Colors.primary} />

            {subCats.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Topic</Text>
                <ChipRow items={subCats} selected={form.subCategory} onSelect={v => set("subCategory", v)}
                  color={SUBJECT_COLORS[form.category] || Colors.primary} />
              </>
            )}

            <Text style={styles.fieldLabel}>Course Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={v => set("name", v)}
              placeholder="e.g. Full Stack Web Development" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Course Fees (₹) *</Text>
            <TextInput style={styles.input} value={form.price} onChangeText={v => set("price", v)}
              keyboardType="numeric" placeholder="e.g. 4999" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Duration</Text>
            <TextInput style={styles.input} value={form.duration} onChangeText={v => set("duration", v)}
              placeholder="e.g. 3 months / 12 sessions" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Batch Timing</Text>
            <TextInput style={styles.input} value={form.batchTiming} onChangeText={v => set("batchTiming", v)}
              placeholder="e.g. Mon-Fri 6–7 PM" placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Mode</Text>
            <ChipRow items={["Online","Offline","Hybrid"]} selected={form.mode}
              onSelect={v => set("mode", v)} color={MODE_CONFIG[form.mode]?.text || Colors.primary} />

            {/* Online class link — only relevant for Online / Hybrid */}
            {(form.mode === "Online" || form.mode === "Hybrid") && (
              <>
                <Text style={styles.fieldLabel}>Online Class Link (Zoom / Meet / etc.)</Text>
                <TextInput style={styles.input} value={form.classLink} onChangeText={v => set("classLink", v)}
                  placeholder="https://meet.google.com/..." placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none" keyboardType="url" />
              </>
            )}

            <Text style={styles.fieldLabel}>What's Included</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              value={form.whatIncluded} onChangeText={v => set("whatIncluded", v)} multiline
              placeholder="Live sessions, recordings, certificate, doubt clearing…"
              placeholderTextColor={Colors.textMuted} />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={form.description} onChangeText={v => set("description", v)} multiline
              placeholder="Brief overview of the course…" placeholderTextColor={Colors.textMuted} />

            <TouchableOpacity
              style={[styles.submitBtn, (saving || uploading) && { opacity: 0.6 }]}
              onPress={submit} disabled={saving || uploading}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{isEdit ? "Save Changes" : "Add Course"}</Text>
              }
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CoursesScreen() {
  const [courses,     setCourses]    = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [loadError,   setLoadError]  = useState(null);
  const [showAdd,     setShowAdd]    = useState(false);
  const [editCourse,  setEditCourse] = useState(null);
  const [search,      setSearch]     = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await fetchCatalog();
      setCourses(d.products || []);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const toggle = async (id, current) => {
    try {
      await toggleStock(id, !current);
      setCourses(prev => prev.map(c => c.id === id ? { ...c, inStock: !current } : c));
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const del = (id, name) => {
    Alert.alert("Delete Course", `Delete "${name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteProduct(id);
          setCourses(prev => prev.filter(c => c.id !== id));
        } catch (e) { Alert.alert("Error", e.message); }
      }},
    ]);
  };

  const filtered = courses.filter(c => {
    const matchSearch = !search.trim() ||
      (c.name     || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.category || "").toLowerCase().includes(search.toLowerCase());
    const matchSubject = subjectFilter === "All" || c.category === subjectFilter;
    return matchSearch && matchSubject;
  });

  return (
    <View style={styles.container}>
      {/* Search + Add */}
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Text>🔍 </Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Subject filter */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filterScroll} contentContainerStyle={styles.filterContent}
      >
        {SUBJECTS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterChip, subjectFilter === s && styles.filterChipActive,
              subjectFilter === s && s !== "All" && { borderColor: SUBJECT_COLORS[s] }]}
            onPress={() => setSubjectFilter(s)}
          >
            <Text style={[styles.filterText, subjectFilter === s && styles.filterTextActive,
              subjectFilter === s && s !== "All" && { color: SUBJECT_COLORS[s] }]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.countLabel}>
        {filtered.length} course{filtered.length !== 1 ? "s" : ""}
        {subjectFilter !== "All" ? ` · ${subjectFilter}` : ""}
      </Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠️ {loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          renderItem={({ item }) => (
            <CourseCard
              course={item}
              onToggle={() => toggle(item.id, item.inStock !== false)}
              onEdit={() => setEditCourse(item)}
              onDelete={() => del(item.id, item.name)}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyText}>No courses yet</Text>
              <Text style={styles.emptyHint}>Tap "+ Add" to add your first course</Text>
            </View>
          }
        />
      )}

      <CourseModal
        visible={showAdd}
        course={null}
        onClose={() => setShowAdd(false)}
        onDone={c => { setCourses(prev => [c, ...prev]); setShowAdd(false); }}
      />
      {editCourse && (
        <CourseModal
          visible={!!editCourse}
          course={editCourse}
          onClose={() => setEditCourse(null)}
          onDone={updated => {
            setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
            setEditCourse(null);
          }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: Colors.bg },
  center     : { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  topBar     : { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  searchWrap : { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, color: Colors.textPrimary, paddingVertical: 10, fontSize: 14 },
  addBtn     : { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  addBtnText : { color: "#fff", fontWeight: "800", fontSize: 14 },

  filterScroll  : { maxHeight: 46 },
  filterContent : { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  filterChip    : { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  filterText    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: Colors.primary },

  countLabel : { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list       : { padding: 16, gap: 12, paddingBottom: 40 },
  empty      : { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyIcon  : { fontSize: 44 },
  emptyText  : { color: Colors.textMuted, fontSize: 16, fontWeight: "700" },
  emptyHint  : { color: Colors.textMuted, fontSize: 13 },
  errorText  : { color: Colors.textSecondary, fontSize: 14, marginBottom: 16 },
  retryBtn   : { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText  : { color: "#fff", fontWeight: "700" },

  // Course card
  card            : { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  cardUnavailable : { opacity: 0.55 },
  cardThumb       : { width: "100%", height: 120 },
  cardThumbEmpty  : { width: "100%", height: 90, alignItems: "center", justifyContent: "center" },
  cardBody        : { padding: 12 },
  badgeRow        : { flexDirection: "row", gap: 6, marginBottom: 6 },
  subjectBadge    : { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  subjectBadgeText: { fontSize: 11, fontWeight: "700" },
  modeBadge       : { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modeBadgeText   : { fontSize: 11, fontWeight: "700" },
  courseName      : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 6, lineHeight: 20 },
  metaRow         : { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  metaChip        : { color: Colors.textSecondary, fontSize: 12, backgroundColor: Colors.bgInput, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardFooter      : { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price           : { color: Colors.primary, fontSize: 16, fontWeight: "900" },
  actions         : { flexDirection: "row", alignItems: "center", gap: 6 },
  availBtn        : { borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  availText       : { fontSize: 11, fontWeight: "700" },
  iconBtn         : { padding: 6, backgroundColor: Colors.bgInput, borderRadius: 8 },
  iconBtnText     : { fontSize: 15 },

  // Chip
  chip     : { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  chipText : { color: Colors.textSecondary, fontSize: 12 },

  // Photo picker
  photoWrap       : { marginBottom: 8 },
  photoEmpty      : { flexDirection: "row", gap: 10 },
  photoBtn        : { flex: 1, backgroundColor: Colors.bgInput, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  photoBtnIcon    : { fontSize: 24, marginBottom: 4 },
  photoBtnText    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  photoPreview    : { width: "100%", height: 160, borderRadius: 12 },
  photoChangeBtn  : { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  photoChangeBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // Modal
  modalOverlay : { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet   : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "96%" },
  modalHandle  : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader  : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle   : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  closeBtn     : { color: Colors.textSecondary, fontSize: 20, padding: 4 },
  fieldLabel   : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input        : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  submitBtn    : { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  submitText   : { color: "#fff", fontWeight: "800", fontSize: 16 },
});
