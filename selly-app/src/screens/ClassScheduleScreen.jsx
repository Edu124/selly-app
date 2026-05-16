// ── Class Schedule Screen ──────────────────────────────────────────────────────
// Education industry: schedule classes → bot auto-sends 60-min + 15-min reminders
// Owner chooses: notify ALL enrolled students OR only students of a specific course
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator,
  RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchSchedules, createSchedule, deleteSchedule, fetchBatches } from "../lib/api";
import { fetchCatalog } from "../lib/supabase_data";

function pad(n) { return String(n).padStart(2, "0"); }

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isUpcoming(iso) {
  return new Date(iso) > new Date();
}

export default function ClassScheduleScreen() {
  const [schedules, setSchedules]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal]     = useState(false);
  const [saving, setSaving]         = useState(false);

  // Form state
  const [title, setTitle]           = useState("");
  const [dateStr, setDateStr]       = useState("");   // YYYY-MM-DD
  const [timeStr, setTimeStr]       = useState("");   // HH:MM

  // Notify mode: 'all' = all enrolled students, 'course' = only a specific course's students
  const [notifyMode, setNotifyMode] = useState("all");
  const [courses, setCourses]       = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null); // { id, name }
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);

  // Batch mode
  const [batches,           setBatches]           = useState([]);
  const [batchesLoading,    setBatchesLoading]     = useState(false);
  const [selectedBatch,     setSelectedBatch]      = useState(""); // selected batch name
  const [batchPickerOpen,   setBatchPickerOpen]    = useState(false);

  const load = async () => {
    try {
      const r = await fetchSchedules();
      setSchedules(r.schedules || []);
    } catch (e) {
      console.warn("Schedules load error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

  const openAdd = async () => {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    setDateStr(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    setTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setTitle("");
    setNotifyMode("all");
    setSelectedCourse(null);
    setSelectedBatch("");
    setAddModal(true);

    // Load courses and batches in parallel
    setCoursesLoading(true);
    setBatchesLoading(true);
    Promise.all([
      fetchCatalog().catch(() => []),
      fetchBatches().catch(() => ({ batches: [] })),
    ]).then(([items, batchData]) => {
      setCourses((items || []).filter(p => p.in_stock !== false));
      setBatches(batchData.batches || []);
    }).finally(() => {
      setCoursesLoading(false);
      setBatchesLoading(false);
    });
  };

  const save = async () => {
    if (!title.trim()) { Alert.alert("Title required", "Enter a class title."); return; }
    if (!dateStr || !timeStr) { Alert.alert("Date & time required", "Enter the date and time."); return; }
    const scheduledAt = new Date(`${dateStr}T${timeStr}:00`);
    if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      Alert.alert("Invalid time", "Schedule must be in the future.");
      return;
    }
    if (notifyMode === "course" && !selectedCourse) {
      Alert.alert("Select a course", "Choose which course's students to notify, or switch to 'All students'.");
      return;
    }
    if (notifyMode === "batch" && !selectedBatch) {
      Alert.alert("Select a batch", "Choose which class/batch to notify, or switch to 'All students'.");
      return;
    }
    setSaving(true);
    try {
      await createSchedule({
        title        : title.trim(),
        course_name  : selectedCourse?.name || "",
        course_id    : notifyMode === "course" ? (selectedCourse?.id || null) : null,
        notify_mode  : notifyMode,
        batch_name   : notifyMode === "batch" ? selectedBatch : "",
        scheduled_at : scheduledAt.toISOString(),
      });
      setAddModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item) => {
    Alert.alert(
      "Delete Schedule?",
      `Remove "${item.title}" — students won't get reminders.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await deleteSchedule(item.id);
              setSchedules(prev => prev.filter(s => s.id !== item.id));
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };

  const upcoming = schedules.filter(s => isUpcoming(s.scheduled_at));
  const past     = schedules.filter(s => !isUpcoming(s.scheduled_at));

  return (
    <View style={styles.container}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatChip label="Upcoming" value={upcoming.length} color={Colors.primary} />
        <StatChip label="Past"     value={past.length}     color={Colors.textMuted} />
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Schedule</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={schedules}
          keyExtractor={s => s.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const up = isUpcoming(item.scheduled_at);
            const notifyLabel = item.notify_mode === "batch" && item.batch_name
              ? `🎓 ${item.batch_name} students only`
              : item.notify_mode === "course" && item.course_name
              ? `📚 ${item.course_name} students only`
              : "👥 All enrolled students";
            return (
              <View style={[styles.card, !up && styles.cardPast]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardNotify}>{notifyLabel}</Text>
                  </View>
                  {up && (
                    <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.cardTime}>🗓 {formatDate(item.scheduled_at)}</Text>
                <View style={styles.reminderRow}>
                  <ReminderChip sent={item.reminder_60_sent} label="60-min" />
                  <ReminderChip sent={item.reminder_15_sent} label="15-min" />
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>No classes scheduled</Text>
              <Text style={styles.emptyDesc}>
                Tap "+ Schedule" to add a class. Students get auto-reminders 60 min and 15 min before.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>Schedule First Class</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ── Add Schedule Modal ── */}
      <Modal visible={addModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Schedule a Class</Text>
                <TouchableOpacity onPress={() => setAddModal(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Class Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Algebra — Chapter 5"
                placeholderTextColor={Colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                placeholder="2025-06-15"
                placeholderTextColor={Colors.textMuted}
                value={dateStr}
                onChangeText={setDateStr}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Time (HH:MM, 24-hour) *</Text>
              <TextInput
                style={styles.input}
                placeholder="18:30"
                placeholderTextColor={Colors.textMuted}
                value={timeStr}
                onChangeText={setTimeStr}
                keyboardType="numbers-and-punctuation"
              />

              {/* ── Notify who ── */}
              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Notify Students</Text>
              <View style={styles.notifyToggleRow}>
                <TouchableOpacity
                  style={[styles.notifyToggleBtn, notifyMode === "all" && styles.notifyToggleBtnActive]}
                  onPress={() => { setNotifyMode("all"); setSelectedCourse(null); setSelectedBatch(""); }}
                >
                  <Text style={[styles.notifyToggleTxt, notifyMode === "all" && styles.notifyToggleTxtActive]}>
                    👥 All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.notifyToggleBtn, notifyMode === "batch" && styles.notifyToggleBtnActive]}
                  onPress={() => { setNotifyMode("batch"); setSelectedCourse(null); }}
                >
                  <Text style={[styles.notifyToggleTxt, notifyMode === "batch" && styles.notifyToggleTxtActive]}>
                    🎓 By Batch
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.notifyToggleBtn, notifyMode === "course" && styles.notifyToggleBtnActive]}
                  onPress={() => { setNotifyMode("course"); setSelectedBatch(""); }}
                >
                  <Text style={[styles.notifyToggleTxt, notifyMode === "course" && styles.notifyToggleTxtActive]}>
                    📚 By Course
                  </Text>
                </TouchableOpacity>
              </View>

              {notifyMode === "batch" && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.fieldLabel}>Select Class / Batch</Text>
                  {batchesLoading ? (
                    <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
                  ) : batches.length === 0 ? (
                    <Text style={styles.noCourseText}>
                      No batches assigned yet. Go to Students → assign a batch to your students first.
                    </Text>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.coursePickerBtn, selectedBatch && { borderColor: "#34d399" }]}
                        onPress={() => setBatchPickerOpen(true)}
                      >
                        <Text style={[styles.coursePickerTxt, selectedBatch && { color: Colors.textPrimary }]}>
                          {selectedBatch ? `🎓 ${selectedBatch}` : "Tap to select a batch…"}
                        </Text>
                        <Text style={styles.coursePickerChevron}>›</Text>
                      </TouchableOpacity>
                      {selectedBatch && (
                        <Text style={styles.courseHint}>
                          Only students assigned to "{selectedBatch}" will receive the reminder.
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}

              {notifyMode === "course" && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.fieldLabel]}>Select Course</Text>
                  {coursesLoading ? (
                    <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
                  ) : courses.length === 0 ? (
                    <Text style={styles.noCourseText}>No courses in your catalog yet. Add courses first.</Text>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.coursePickerBtn, selectedCourse && { borderColor: Colors.primary }]}
                        onPress={() => setCoursePickerOpen(true)}
                      >
                        <Text style={[styles.coursePickerTxt, selectedCourse && { color: Colors.textPrimary }]}>
                          {selectedCourse ? `📚 ${selectedCourse.name}` : "Tap to select a course…"}
                        </Text>
                        <Text style={styles.coursePickerChevron}>›</Text>
                      </TouchableOpacity>
                      {selectedCourse && (
                        <Text style={styles.courseHint}>
                          Only students who enrolled in this course will receive the reminder.
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}

              {notifyMode === "all" && (
                <Text style={styles.notifyAllHint}>
                  All students with confirmed enrollments will receive the class reminder.
                </Text>
              )}

              {/* Reminder note */}
              <View style={styles.reminderNote}>
                <Text style={styles.reminderNoteText}>
                  🤖 Bot will auto-send reminders:{"\n"}
                  • 60 minutes before class{"\n"}
                  • 15 minutes before class
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={save}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Schedule Class 📅</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Batch picker sub-modal ── */}
      <Modal visible={batchPickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "70%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Batch / Class</Text>
              <TouchableOpacity onPress={() => setBatchPickerOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={batches}
              keyExtractor={b => b}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const active = selectedBatch === item;
                return (
                  <TouchableOpacity
                    style={[styles.courseItem, active && { backgroundColor: "#0f2218" }]}
                    onPress={() => {
                      setSelectedBatch(item);
                      setBatchPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.courseItemName, active && { color: "#34d399" }]}>🎓 {item}</Text>
                    {active && <Text style={{ color: "#34d399", fontSize: 18, fontWeight: "700" }}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Course picker sub-modal ── */}
      <Modal visible={coursePickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "70%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Course</Text>
              <TouchableOpacity onPress={() => setCoursePickerOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={courses}
              keyExtractor={c => c.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const active = selectedCourse?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.courseItem, active && styles.courseItemActive]}
                    onPress={() => {
                      setSelectedCourse({ id: item.id, name: item.name });
                      setCoursePickerOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.courseItemName, active && { color: Colors.primary }]}>{item.name}</Text>
                      {item.price > 0 && (
                        <Text style={styles.courseItemPrice}>₹{item.price.toLocaleString("en-IN")}</Text>
                      )}
                    </View>
                    {active && <Text style={{ color: Colors.primary, fontSize: 18, fontWeight: "700" }}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ReminderChip({ sent, label }) {
  return (
    <View style={[styles.reminderChip, sent ? styles.reminderSent : styles.reminderPending]}>
      <Text style={[styles.reminderChipText, { color: sent ? Colors.green : Colors.textMuted }]}>
        {sent ? "✓" : "○"} {label}
      </Text>
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

  statsRow   : { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 8, alignItems: "center" },
  statChip   : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1 },
  statValue  : { fontSize: 20, fontWeight: "900" },
  statLabel  : { color: Colors.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  addBtn     : { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText : { color: "#fff", fontWeight: "800", fontSize: 13 },

  list       : { padding: 16, gap: 12, paddingBottom: 32 },

  card        : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardPast    : { opacity: 0.55 },
  cardHeader  : { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  cardTitle   : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  cardNotify  : { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  cardTime    : { color: Colors.primary, fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 4 },
  deleteBtn   : { padding: 4 },
  deleteBtnText: { color: Colors.red, fontSize: 18, fontWeight: "700" },

  reminderRow   : { flexDirection: "row", gap: 8 },
  reminderChip  : { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  reminderSent  : { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)" },
  reminderPending: { backgroundColor: Colors.bgInput, borderColor: Colors.border },
  reminderChipText: { fontSize: 11, fontWeight: "600" },

  empty      : { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon  : { fontSize: 48, marginBottom: 12 },
  emptyText  : { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  emptyDesc  : { color: Colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 20 },
  emptyBtn   : { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalSheet  : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "92%" },
  modalHandle : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  closeBtn    : { color: Colors.textSecondary, fontSize: 18, padding: 4 },

  fieldLabel  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input       : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border },

  // Notify toggle
  notifyToggleRow      : { flexDirection: "row", gap: 8 },
  notifyToggleBtn      : { flex: 1, backgroundColor: Colors.bgInput, borderRadius: 10, padding: 11, alignItems: "center", borderWidth: 1.5, borderColor: Colors.border },
  notifyToggleBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "18" },
  notifyToggleTxt      : { color: Colors.textMuted, fontSize: 12, fontWeight: "700", textAlign: "center" },
  notifyToggleTxtActive: { color: Colors.primary },

  // Course picker
  coursePickerBtn  : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: Colors.border },
  coursePickerTxt  : { flex: 1, color: Colors.textMuted, fontSize: 14 },
  coursePickerChevron: { color: Colors.textMuted, fontSize: 20, fontWeight: "300" },
  courseHint       : { color: Colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  noCourseText     : { color: Colors.textMuted, fontSize: 13, marginTop: 6, fontStyle: "italic" },
  notifyAllHint    : { color: Colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },

  // Course list items
  courseItem      : { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  courseItemActive: { backgroundColor: Colors.primary + "12" },
  courseItemName  : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  courseItemPrice : { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  reminderNote    : { backgroundColor: Colors.primary + "12", borderRadius: 12, padding: 14, marginVertical: 14, borderWidth: 1, borderColor: Colors.primary + "30" },
  reminderNoteText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },

  saveBtn     : { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: "center" },
  saveBtnText : { color: "#fff", fontWeight: "800", fontSize: 15 },
});
