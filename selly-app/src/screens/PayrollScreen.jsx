// ── Payroll Screen ─────────────────────────────────────────────────────────────
// 3 tabs: Staff (add/manage employees), Attendance (mark daily), Salary (monthly)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, FlatList,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import {
  fetchEmployees, addEmployee, deleteEmployee,
  fetchAttendance, markAttendance,
  fetchPayrollReport, processPayroll,
} from "../lib/api";

const TABS = ["Staff", "Attendance", "Salary"];

const ROLES = ["Manager", "Sales Staff", "Delivery", "Accountant", "Helper", "Other"];

// ── Add Employee Modal ────────────────────────────────────────────────────────
function AddEmployeeModal({ visible, onClose, onAdded }) {
  const [name,     setName]     = useState("");
  const [role,     setRole]     = useState("Sales Staff");
  const [salary,   setSalary]   = useState("");
  const [mobile,   setMobile]   = useState("");
  const [saving,   setSaving]   = useState(false);

  function reset() {
    setName(""); setRole("Sales Staff"); setSalary(""); setMobile("");
  }

  async function save() {
    if (!name.trim())   return Alert.alert("Enter employee name");
    if (!salary || isNaN(Number(salary))) return Alert.alert("Enter valid monthly salary");
    setSaving(true);
    try {
      await addEmployee({ name: name.trim(), role, salary: Number(salary), mobile: mobile.trim() });
      reset(); onClose(); onAdded();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Staff Member</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput style={styles.input} placeholder="e.g. Ramesh Kumar" placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} />

          <Text style={styles.fieldLabel}>Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map(r => (
              <TouchableOpacity key={r} style={[styles.roleChip, role === r && styles.roleChipActive]} onPress={() => setRole(r)}>
                <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Monthly Salary (₹)</Text>
          <TextInput style={styles.input} placeholder="e.g. 15000" placeholderTextColor={Colors.textMuted} value={salary} onChangeText={setSalary} keyboardType="numeric" />

          <Text style={styles.fieldLabel}>Mobile Number</Text>
          <TextInput style={styles.input} placeholder="+91 98765 43210" placeholderTextColor={Colors.textMuted} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Staff Member</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────
function StaffTab({ employees, loading, onAdd, onDelete, onRefresh }) {
  function confirmDelete(emp) {
    Alert.alert("Remove Staff", `Remove ${emp.name} from payroll?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => onDelete(emp.id) },
    ]);
  }

  if (loading) {
    return <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
        <Text style={styles.addBtnText}>+ Add Staff Member</Text>
      </TouchableOpacity>

      {employees.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyText}>No staff added yet</Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <View style={styles.empCard}>
              <View style={styles.empAvatar}>
                <Text style={styles.empAvatarText}>{(item.name || "?").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{item.name}</Text>
                <Text style={styles.empRole}>{item.role}</Text>
                {item.mobile ? <Text style={styles.empMobile}>{item.mobile}</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={styles.empSalary}>₹{Number(item.salary).toLocaleString("en-IN")}/mo</Text>
                <View style={[styles.statusBadge, item.status === "active" ? styles.statusActive : styles.statusInactive]}>
                  <Text style={styles.statusText}>{item.status || "active"}</Text>
                </View>
                <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── Attendance Tab ─────────────────────────────────────────────────────────────
function AttendanceTab({ employees }) {
  const today = new Date().toISOString().split("T")[0];
  const [date,       setDate]       = useState(today);
  const [attendance, setAttendance] = useState({});  // { employeeId: "present" | "absent" | "half" }
  const [saving,     setSaving]     = useState(null); // employeeId being saved
  const [loaded,     setLoaded]     = useState(false);
  const [loading,    setLoading]    = useState(false);

  React.useEffect(() => {
    loadAttendance();
  }, [date]);

  async function loadAttendance() {
    setLoading(true);
    setLoaded(false);
    try {
      const data = await fetchAttendance(date).catch(() => ({ records: [] }));
      const map = {};
      (data?.records || []).forEach(r => { map[r.employee_id] = r.status; });
      setAttendance(map);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function toggle(empId, status) {
    setSaving(empId);
    try {
      await markAttendance(empId, date, status);
      setAttendance(prev => ({ ...prev, [empId]: status }));
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(null);
    }
  }

  const STATUS_OPTS = [
    { key: "present", label: "P", color: "#22c55e" },
    { key: "absent",  label: "A", color: "#ef4444" },
    { key: "half",    label: "½", color: "#f59e0b" },
  ];

  const presentCount = Object.values(attendance).filter(s => s === "present").length;
  const halfCount    = Object.values(attendance).filter(s => s === "half").length;

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 60 }}>
      {/* Date picker row */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => {
            const d = new Date(date); d.setDate(d.getDate() - 1);
            setDate(d.toISOString().split("T")[0]);
          }}
        ><Text style={styles.dateArrowText}>‹</Text></TouchableOpacity>
        <Text style={styles.dateLabel}>{new Date(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => {
            const d = new Date(date); d.setDate(d.getDate() + 1);
            if (d <= new Date()) setDate(d.toISOString().split("T")[0]);
          }}
        ><Text style={styles.dateArrowText}>›</Text></TouchableOpacity>
      </View>

      {/* Summary chips */}
      <View style={styles.attSummaryRow}>
        <View style={[styles.attSummaryChip, { borderColor: "rgba(34,197,94,0.4)" }]}>
          <Text style={[styles.attSummaryVal, { color: "#22c55e" }]}>{presentCount}</Text>
          <Text style={styles.attSummaryLabel}>Present</Text>
        </View>
        <View style={[styles.attSummaryChip, { borderColor: "rgba(239,68,68,0.4)" }]}>
          <Text style={[styles.attSummaryVal, { color: "#ef4444" }]}>{employees.length - presentCount - halfCount}</Text>
          <Text style={styles.attSummaryLabel}>Absent</Text>
        </View>
        <View style={[styles.attSummaryChip, { borderColor: "rgba(245,158,11,0.4)" }]}>
          <Text style={[styles.attSummaryVal, { color: "#f59e0b" }]}>{halfCount}</Text>
          <Text style={styles.attSummaryLabel}>Half-day</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} /></View>
      ) : employees.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>Add staff in the Staff tab first</Text>
        </View>
      ) : (
        employees.map(emp => (
          <View key={emp.id} style={styles.attRow}>
            <View style={styles.empAvatarSm}>
              <Text style={styles.empAvatarTextSm}>{(emp.name || "?").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attEmpName}>{emp.name}</Text>
              <Text style={styles.attEmpRole}>{emp.role}</Text>
            </View>
            {saving === emp.id ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <View style={styles.attBtns}>
                {STATUS_OPTS.map(s => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.attBtn, attendance[emp.id] === s.key && { backgroundColor: s.color + "33", borderColor: s.color }]}
                    onPress={() => toggle(emp.id, s.key)}
                  >
                    <Text style={[styles.attBtnText, attendance[emp.id] === s.key && { color: s.color }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Salary Tab ─────────────────────────────────────────────────────────────────
function SalaryTab({ employees }) {
  const now    = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [month,     setMonth]     = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [report,    setReport]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [processing,setProcessing]= useState(false);

  React.useEffect(() => { loadReport(); }, [month]);

  async function loadReport() {
    setLoading(true);
    try {
      const data = await fetchPayrollReport(month).catch(() => ({ records: [] }));
      setReport(data?.records || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleProcess() {
    Alert.alert("Process Salary", `Calculate salary for all staff for ${months[Number(month.split("-")[1]) - 1]} ${month.split("-")[0]}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Process",
        onPress: async () => {
          setProcessing(true);
          try {
            await processPayroll(month);
            await loadReport();
            Alert.alert("Done", "Salary calculated and records saved!");
          } catch (e) {
            Alert.alert("Error", e.message);
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  }

  const [yr, mo] = month.split("-").map(Number);
  const prevMonth = () => { const d = new Date(yr, mo - 2); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nextMonth = () => {
    const d = new Date(yr, mo);
    if (d <= now) setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const totalSalary = report.reduce((s, r) => s + Number(r.net_salary || 0), 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 60 }}>
      {/* Month picker */}
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateArrow} onPress={prevMonth}>
          <Text style={styles.dateArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{months[mo - 1]} {yr}</Text>
        <TouchableOpacity style={styles.dateArrow} onPress={nextMonth}>
          <Text style={styles.dateArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Process button */}
      <TouchableOpacity
        style={[styles.processBtn, processing && { opacity: 0.6 }]}
        onPress={handleProcess}
        disabled={processing}
      >
        {processing
          ? <><ActivityIndicator color="#fff" /><Text style={[styles.processBtnText, { marginLeft: 8 }]}>Processing...</Text></>
          : <Text style={styles.processBtnText}>⚙️ Generate Salary</Text>
        }
      </TouchableOpacity>

      {/* Total payout */}
      {report.length > 0 && (
        <View style={styles.totalPayCard}>
          <Text style={styles.totalPayLabel}>Total Payout</Text>
          <Text style={styles.totalPayVal}>₹{totalSalary.toLocaleString("en-IN")}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} /></View>
      ) : report.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Tap "Generate Salary" to calculate</Text>
        </View>
      ) : (
        report.map(rec => (
          <View key={rec.id || rec.employee_id} style={styles.salaryCard}>
            <View style={styles.salaryTop}>
              <View>
                <Text style={styles.salaryName}>{rec.employee_name}</Text>
                <Text style={styles.salaryDays}>{rec.days_present}/{rec.total_days} days present</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.salaryNet}>₹{Number(rec.net_salary || 0).toLocaleString("en-IN")}</Text>
                <View style={[styles.paidBadge, rec.paid ? styles.paidYes : styles.paidNo]}>
                  <Text style={[styles.paidText, { color: rec.paid ? "#22c55e" : "#f59e0b" }]}>
                    {rec.paid ? "Paid" : "Unpaid"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.salaryDetails}>
              <Text style={styles.salaryDetailItem}>Base: ₹{Number(rec.base_salary || 0).toLocaleString("en-IN")}</Text>
              {rec.deductions > 0 && <Text style={[styles.salaryDetailItem, { color: "#ef4444" }]}>Deductions: -₹{Number(rec.deductions).toLocaleString("en-IN")}</Text>}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PayrollScreen() {
  const [activeTab,    setActiveTab]    = useState("Staff");
  const [employees,    setEmployees]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => { loadEmployees(); }, [])
  );

  async function loadEmployees() {
    setLoading(true);
    try {
      const data = await fetchEmployees().catch(() => ({ employees: [] }));
      setEmployees(data?.employees || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteEmployee(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "Staff"      && <StaffTab      employees={employees} loading={loading} onAdd={() => setAddModalOpen(true)} onDelete={handleDelete} onRefresh={loadEmployees} />}
      {activeTab === "Attendance" && <AttendanceTab employees={employees} />}
      {activeTab === "Salary"     && <SalaryTab     employees={employees} />}

      <AddEmployeeModal visible={addModalOpen} onClose={() => setAddModalOpen(false)} onAdded={loadEmployees} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },

  tabBar        : { flexDirection: "row", backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn        : { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabBtnActive  : { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabBtnText    : { color: Colors.textMuted, fontSize: 13, fontWeight: "700" },
  tabBtnTextActive: { color: Colors.primary },

  addBtn     : { backgroundColor: Colors.primary, margin: 12, borderRadius: 12, padding: 12, alignItems: "center" },
  addBtnText : { color: "#fff", fontWeight: "800", fontSize: 14 },

  // Employee card
  empCard      : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  empAvatar    : { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary + "33", alignItems: "center", justifyContent: "center" },
  empAvatarText: { color: Colors.primary, fontSize: 18, fontWeight: "900" },
  empName      : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800" },
  empRole      : { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  empMobile    : { color: Colors.textSecondary, fontSize: 11, marginTop: 1 },
  empSalary    : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800" },
  statusBadge  : { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  statusActive : { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.4)" },
  statusInactive: { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.4)" },
  statusText   : { fontSize: 9, fontWeight: "800", color: "#22c55e" },
  deleteBtn    : { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  deleteBtnText: { color: "#ef4444", fontSize: 10, fontWeight: "700" },

  // Attendance
  dateRow       : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.bgCard, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border },
  dateArrow     : { padding: 8 },
  dateArrowText : { color: Colors.primary, fontSize: 22, fontWeight: "700" },
  dateLabel     : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800" },

  attSummaryRow  : { flexDirection: "row", gap: 8 },
  attSummaryChip : { flex: 1, alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 10, padding: 10, borderWidth: 1 },
  attSummaryVal  : { fontSize: 20, fontWeight: "900" },
  attSummaryLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },

  attRow       : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  empAvatarSm  : { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + "22", alignItems: "center", justifyContent: "center" },
  empAvatarTextSm: { color: Colors.primary, fontSize: 14, fontWeight: "900" },
  attEmpName   : { color: Colors.textPrimary, fontSize: 13, fontWeight: "800" },
  attEmpRole   : { color: Colors.textMuted, fontSize: 11 },
  attBtns      : { flexDirection: "row", gap: 6 },
  attBtn       : { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  attBtnText   : { color: Colors.textMuted, fontSize: 12, fontWeight: "800" },

  // Salary
  processBtn    : { backgroundColor: Colors.primary, borderRadius: 12, padding: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  processBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  totalPayCard  : { backgroundColor: "rgba(108,71,255,0.1)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.primary + "44", alignItems: "center" },
  totalPayLabel : { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  totalPayVal   : { color: Colors.primary, fontSize: 28, fontWeight: "900", marginTop: 2 },

  salaryCard    : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  salaryTop     : { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  salaryName    : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800" },
  salaryDays    : { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  salaryNet     : { color: Colors.textPrimary, fontSize: 17, fontWeight: "900" },
  paidBadge     : { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  paidYes       : { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.4)" },
  paidNo        : { backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.4)" },
  paidText      : { fontSize: 9, fontWeight: "800" },
  salaryDetails : { flexDirection: "row", gap: 12 },
  salaryDetailItem: { color: Colors.textMuted, fontSize: 11 },

  // Shared
  loadingBox  : { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyBox    : { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 40 },
  emptyIcon   : { fontSize: 40 },
  emptyText   : { color: Colors.textMuted, fontSize: 14 },

  // Modal
  modal       : { flex: 1, backgroundColor: Colors.bg },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  modalClose  : { color: Colors.textMuted, fontSize: 22, padding: 4 },
  modalBody   : { flex: 1, padding: 20 },
  fieldLabel  : { color: Colors.textSecondary, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 8 },
  input       : { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontSize: 14, marginBottom: 4 },
  roleRow     : { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  roleChip    : { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  roleChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  roleChipText  : { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  roleChipTextActive: { color: Colors.primary },
  saveBtn     : { backgroundColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 16 },
  saveBtnText : { color: "#fff", fontSize: 15, fontWeight: "800" },
});
