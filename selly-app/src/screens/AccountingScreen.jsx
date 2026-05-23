// ── Accounting Screen ─────────────────────────────────────────────────────────
// 3 tabs: Overview (P&L summary), Expenses (add/delete), Reports (GST + P&L)
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
  fetchExpenses, addExpense, deleteExpense, fetchAccountingSummary,
} from "../lib/api";

const TABS = ["Overview", "Expenses", "Reports"];

const EXPENSE_CATEGORIES = [
  "Inventory", "Rent", "Salaries", "Utilities", "Marketing",
  "Transport", "Equipment", "Repairs", "Taxes", "Other",
];

// ── Add Expense Modal ─────────────────────────────────────────────────────────
function AddExpenseModal({ visible, onClose, onAdded }) {
  const [amount,      setAmount]      = useState("");
  const [category,    setCategory]    = useState("Inventory");
  const [description, setDescription] = useState("");
  const [vendor,      setVendor]      = useState("");
  const [saving,      setSaving]      = useState(false);

  function reset() {
    setAmount(""); setCategory("Inventory"); setDescription(""); setVendor("");
  }

  async function save() {
    if (!amount || isNaN(Number(amount))) return Alert.alert("Enter a valid amount");
    setSaving(true);
    try {
      await addExpense({ amount: Number(amount), category, description, vendor });
      reset();
      onClose();
      onAdded();
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
          <Text style={styles.modalTitle}>Add Expense</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Amount (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.catRow}>
            {EXPENSE_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, category === cat && styles.catChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Office supplies"
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.fieldLabel}>Vendor / Supplier</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sharma Traders"
            placeholderTextColor={Colors.textMuted}
            value={vendor}
            onChangeText={setVendor}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Expense</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ summary, loading }) {
  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading summary...</Text>
      </View>
    );
  }

  const revenue  = summary?.revenue  || 0;
  const expenses = summary?.expenses || 0;
  const profit   = revenue - expenses;
  const gstCol   = summary?.gst_collected || 0;
  const gstPaid  = summary?.gst_paid      || 0;
  const netGst   = gstCol - gstPaid;

  function fmt(n) { return "₹" + Math.abs(n).toLocaleString("en-IN"); }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      {/* Period selector hint */}
      <Text style={styles.periodHint}>📅 Last 30 days</Text>

      {/* Primary P&L cards */}
      <View style={styles.cardRow}>
        <View style={[styles.summaryCard, styles.cardGreen]}>
          <Text style={styles.cardIcon}>💰</Text>
          <Text style={styles.cardVal}>{fmt(revenue)}</Text>
          <Text style={styles.cardLabel}>Revenue</Text>
        </View>
        <View style={[styles.summaryCard, styles.cardRed]}>
          <Text style={styles.cardIcon}>📤</Text>
          <Text style={styles.cardVal}>{fmt(expenses)}</Text>
          <Text style={styles.cardLabel}>Expenses</Text>
        </View>
      </View>

      <View style={[styles.profitCard, profit >= 0 ? styles.profitPos : styles.profitNeg]}>
        <View>
          <Text style={styles.profitLabel}>Net Profit / Loss</Text>
          <Text style={styles.profitVal}>{profit < 0 ? "−" : "+"}{fmt(profit)}</Text>
        </View>
        <Text style={{ fontSize: 36 }}>{profit >= 0 ? "📈" : "📉"}</Text>
      </View>

      {/* GST summary */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCardTitle}>🧾 GST Summary (30 days)</Text>
        <View style={styles.gstRow}>
          <View style={styles.gstItem}>
            <Text style={styles.gstVal}>{fmt(gstCol)}</Text>
            <Text style={styles.gstLabel}>Collected</Text>
          </View>
          <View style={styles.gstDivider} />
          <View style={styles.gstItem}>
            <Text style={styles.gstVal}>{fmt(gstPaid)}</Text>
            <Text style={styles.gstLabel}>Input Credit</Text>
          </View>
          <View style={styles.gstDivider} />
          <View style={styles.gstItem}>
            <Text style={[styles.gstVal, { color: netGst >= 0 ? "#22c55e" : "#ef4444" }]}>{fmt(netGst)}</Text>
            <Text style={styles.gstLabel}>Net Payable</Text>
          </View>
        </View>
      </View>

      {/* Expense breakdown */}
      {summary?.by_category?.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>📊 Expense by Category</Text>
          {summary.by_category.map(item => (
            <View key={item.category} style={styles.catBreakRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Text style={styles.catBreakName}>{item.category}</Text>
                <View style={styles.catBarWrap}>
                  <View style={[styles.catBar, { width: `${Math.min(100, (item.total / expenses) * 100)}%` }]} />
                </View>
              </View>
              <Text style={styles.catBreakAmt}>{fmt(item.total)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── Expenses Tab ──────────────────────────────────────────────────────────────
function ExpensesTab({ expenses, loading, onAdd, onDelete, onRefresh }) {
  const [filter, setFilter] = useState("All");
  const cats = ["All", ...EXPENSE_CATEGORIES];

  const filtered = filter === "All"
    ? expenses
    : expenses.filter(e => e.category === filter);

  function confirmDelete(id) {
    Alert.alert("Delete Expense", "Remove this expense record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(id) },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ gap: 8, padding: 12 }}
      >
        {cats.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.filterChip, filter === c && styles.filterChipActive]}
            onPress={() => setFilter(c)}
          >
            <Text style={[styles.filterChipText, filter === c && styles.filterChipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Add button */}
      <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
        <Text style={styles.addBtnText}>+ Add Expense</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No expenses yet</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <View style={styles.expenseRow}>
              <View style={styles.expenseLeft}>
                <View style={styles.expenseCatBadge}>
                  <Text style={styles.expenseCatText}>{item.category}</Text>
                </View>
                <Text style={styles.expenseDesc} numberOfLines={1}>{item.description || item.vendor || "—"}</Text>
                <Text style={styles.expenseDate}>{new Date(item.date).toLocaleDateString("en-IN")}</Text>
              </View>
              <View style={styles.expenseRight}>
                <Text style={styles.expenseAmt}>₹{Number(item.amount).toLocaleString("en-IN")}</Text>
                <TouchableOpacity onPress={() => confirmDelete(item.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab({ summary }) {
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  const now = new Date();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}>

      {/* P&L Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCardTitle}>📄 Profit & Loss Statement</Text>
        <View style={styles.reportRow}>
          <Text style={styles.reportKey}>Revenue (Sales)</Text>
          <Text style={[styles.reportVal, { color: "#22c55e" }]}>₹{(summary?.revenue || 0).toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.reportRow}>
          <Text style={styles.reportKey}>Cost of Goods</Text>
          <Text style={[styles.reportVal, { color: "#ef4444" }]}>₹{(summary?.cogs || 0).toLocaleString("en-IN")}</Text>
        </View>
        <View style={[styles.reportRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 }]}>
          <Text style={[styles.reportKey, { fontWeight: "800" }]}>Gross Profit</Text>
          <Text style={[styles.reportVal, { fontWeight: "800", color: Colors.primary }]}>
            ₹{((summary?.revenue || 0) - (summary?.cogs || 0)).toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={styles.reportRow}>
          <Text style={styles.reportKey}>Operating Expenses</Text>
          <Text style={[styles.reportVal, { color: "#ef4444" }]}>₹{(summary?.expenses || 0).toLocaleString("en-IN")}</Text>
        </View>
        <View style={[styles.reportRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 }]}>
          <Text style={[styles.reportKey, { fontWeight: "900", fontSize: 15 }]}>Net Profit</Text>
          <Text style={[styles.reportVal, { fontWeight: "900", fontSize: 15,
            color: ((summary?.revenue || 0) - (summary?.cogs || 0) - (summary?.expenses || 0)) >= 0 ? "#22c55e" : "#ef4444"
          }]}>
            ₹{Math.abs((summary?.revenue || 0) - (summary?.cogs || 0) - (summary?.expenses || 0)).toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

      {/* GST report */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCardTitle}>🧾 GST Report — {months[now.getMonth()]} {now.getFullYear()}</Text>
        <View style={styles.reportRow}>
          <Text style={styles.reportKey}>Total Sales (taxable)</Text>
          <Text style={styles.reportVal}>₹{(summary?.revenue || 0).toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.reportRow}>
          <Text style={styles.reportKey}>GST Collected (output)</Text>
          <Text style={[styles.reportVal, { color: "#22c55e" }]}>₹{(summary?.gst_collected || 0).toLocaleString("en-IN")}</Text>
        </View>
        <View style={styles.reportRow}>
          <Text style={styles.reportKey}>GST Paid (input credit)</Text>
          <Text style={[styles.reportVal, { color: "#ef4444" }]}>₹{(summary?.gst_paid || 0).toLocaleString("en-IN")}</Text>
        </View>
        <View style={[styles.reportRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 }]}>
          <Text style={[styles.reportKey, { fontWeight: "800" }]}>Net GST Payable</Text>
          <Text style={[styles.reportVal, { fontWeight: "800", color: Colors.primary }]}>
            ₹{((summary?.gst_collected || 0) - (summary?.gst_paid || 0)).toLocaleString("en-IN")}
          </Text>
        </View>
        <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 8 }}>
          File GSTR-1 by 11th of next month. GSTR-3B by 20th.
        </Text>
      </View>

      {/* Quick action */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>💡 Tax Tip</Text>
        <Text style={styles.tipText}>
          Keep all purchase bills/invoices for input tax credit. GST number on invoice is mandatory for claiming ITC.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AccountingScreen() {
  const [activeTab,    setActiveTab]    = useState("Overview");
  const [summary,      setSummary]      = useState(null);
  const [expenses,     setExpenses]     = useState([]);
  const [loadingSum,   setLoadingSum]   = useState(false);
  const [loadingExp,   setLoadingExp]   = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoadingSum(true);
    setLoadingExp(true);
    try {
      const [sumData, expData] = await Promise.all([
        fetchAccountingSummary().catch(() => ({})),
        fetchExpenses().catch(() => ({ expenses: [] })),
      ]);
      setSummary(sumData?.summary || sumData || {});
      setExpenses(expData?.expenses || []);
    } finally {
      setLoadingSum(false);
      setLoadingExp(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === "Overview"  && <OverviewTab  summary={summary}   loading={loadingSum} />}
      {activeTab === "Expenses"  && (
        <ExpensesTab
          expenses={expenses}
          loading={loadingExp}
          onAdd={() => setAddModalOpen(true)}
          onDelete={handleDelete}
          onRefresh={load}
        />
      )}
      {activeTab === "Reports"   && <ReportsTab   summary={summary} />}

      {/* Add Expense Modal */}
      <AddExpenseModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={load}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },

  // Tabs
  tabBar       : { flexDirection: "row", backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn       : { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabBtnActive : { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabBtnText   : { color: Colors.textMuted, fontSize: 13, fontWeight: "700" },
  tabBtnTextActive: { color: Colors.primary },

  // Summary
  cardRow      : { flexDirection: "row", gap: 10 },
  summaryCard  : { flex: 1, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, gap: 4 },
  cardGreen    : { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.25)" },
  cardRed      : { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" },
  cardIcon     : { fontSize: 24 },
  cardVal      : { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  cardLabel    : { color: Colors.textMuted, fontSize: 11, fontWeight: "700" },

  profitCard   : { borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1 },
  profitPos    : { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.25)" },
  profitNeg    : { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" },
  profitLabel  : { color: Colors.textSecondary, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  profitVal    : { color: Colors.textPrimary, fontSize: 26, fontWeight: "900" },

  sectionCard      : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  sectionCardTitle : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 12 },

  gstRow    : { flexDirection: "row", alignItems: "center" },
  gstItem   : { flex: 1, alignItems: "center" },
  gstVal    : { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  gstLabel  : { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  gstDivider: { width: 1, height: 40, backgroundColor: Colors.border },

  catBreakRow  : { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 },
  catBreakName : { color: Colors.textSecondary, fontSize: 12, width: 90 },
  catBarWrap   : { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" },
  catBar       : { height: "100%", backgroundColor: Colors.primary, borderRadius: 3 },
  catBreakAmt  : { color: Colors.textPrimary, fontSize: 12, fontWeight: "700", width: 70, textAlign: "right" },

  periodHint: { color: Colors.textMuted, fontSize: 11, fontWeight: "600", textAlign: "right" },

  // Expenses tab
  filterBar    : { borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterChip   : { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  filterChipText  : { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: Colors.primary },

  addBtn     : { backgroundColor: Colors.primary, margin: 12, borderRadius: 12, padding: 12, alignItems: "center" },
  addBtnText : { color: "#fff", fontWeight: "800", fontSize: 14 },

  expenseRow   : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  expenseLeft  : { flex: 1, gap: 3 },
  expenseCatBadge : { backgroundColor: Colors.primary + "22", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: "flex-start" },
  expenseCatText  : { color: Colors.primary, fontSize: 10, fontWeight: "700" },
  expenseDesc  : { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  expenseDate  : { color: Colors.textMuted, fontSize: 11 },
  expenseRight : { alignItems: "flex-end", gap: 6 },
  expenseAmt   : { color: Colors.textPrimary, fontSize: 16, fontWeight: "900" },
  deleteBtn    : { padding: 4 },
  deleteBtnText: { fontSize: 16 },

  // Reports tab
  reportRow  : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7 },
  reportKey  : { color: Colors.textSecondary, fontSize: 13 },
  reportVal  : { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },

  tipCard  : { backgroundColor: "rgba(108,71,255,0.08)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.primary + "33" },
  tipTitle : { color: Colors.primary, fontSize: 13, fontWeight: "800", marginBottom: 6 },
  tipText  : { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },

  // Add modal
  modal       : { flex: 1, backgroundColor: Colors.bg },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  modalClose  : { color: Colors.textMuted, fontSize: 22, padding: 4 },
  modalBody   : { flex: 1, padding: 20 },
  fieldLabel  : { color: Colors.textSecondary, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 8 },
  input       : { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontSize: 14, marginBottom: 4 },

  catRow     : { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  catChip    : { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  catChipText  : { color: Colors.textMuted, fontSize: 12, fontWeight: "700" },
  catChipTextActive: { color: Colors.primary },

  saveBtn    : { backgroundColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Shared
  loadingBox  : { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  loadingText : { color: Colors.textSecondary, fontSize: 14 },
  emptyBox    : { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyIcon   : { fontSize: 40 },
  emptyText   : { color: Colors.textMuted, fontSize: 14 },
});
