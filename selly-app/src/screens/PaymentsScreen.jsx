// ── Payments Screen ───────────────────────────────────────────────────────────
// Collect payment for an open bill. Staff sees each unpaid order (table or
// customer), taps "Request payment", reviews the itemised bill, and the bill +
// UPI details are sent straight to that customer's WhatsApp.
//
// Uses existing endpoints only:
//   fetchOrders()            → open bills
//   fetchCustomers()         → resolve the customer id from the order's mobile
//   sendMessageToCustomer()  → POST /api/customers/:id/message
//   fetchBusinessSettings()  → UPI id / business name for the bill text
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import {
  fetchOrders, fetchCustomers, sendMessageToCustomer, fetchBusinessSettings,
} from "../lib/api";
import { friendlyError } from "../lib/errors";

const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN");

// Statuses that still owe money
const UNPAID = ["pending_payment", "confirmed", "packed", "shipped", "out_for_delivery"];

export default function PaymentsScreen() {
  const { industry, profile } = useAuth();
  const isEdu = industry === "education";
  const unitWord = isEdu ? "Batch" : "Table";

  const [orders,     setOrders]     = useState([]);
  const [customers,  setCustomers]  = useState([]);
  const [settings,   setSettings]   = useState({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const [sheet,   setSheet]   = useState(null);   // order being billed
  const [sending, setSending]  = useState(false);
  const [sentIds, setSentIds]  = useState({});    // orderId -> true

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [o, c, s] = await Promise.all([
        fetchOrders({ page: 1, limit: 100 }),
        fetchCustomers().catch(() => ({ customers: [] })),
        fetchBusinessSettings().catch(() => ({ settings: {} })),
      ]);
      setOrders(o.orders || []);
      setCustomers(c.customers || []);
      setSettings(s.settings || {});
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  /* ── helpers ──────────────────────────────────────────────────────────── */
  const unitOf = o => o.table || o.table_no || o.batch || null;
  const itemsOf = o => Array.isArray(o.cart) ? o.cart : [];
  const totalOf = o => Number(o.bill || 0) ||
    itemsOf(o).reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);

  // Match the order's mobile to a customer record so we have an id to message
  const customerFor = (o) => {
    const digits = String(o.mobile || "").replace(/\D/g, "").slice(-10);
    if (!digits) return null;
    return customers.find(c => String(c.phone || c.mobile || "").replace(/\D/g, "").endsWith(digits)) || null;
  };

  const buildBillText = (o) => {
    const items = itemsOf(o);
    const lines = items.length
      ? items.map(i => `• ${i.name}${i.size ? ` (${i.size})` : ""} ×${i.qty || 1} — ${inr(Number(i.price || 0) * Number(i.qty || 1))}`).join("\n")
      : "• Order total";
    const total = totalOf(o);
    const unit  = unitOf(o);
    const upi   = settings.upi_id;
    const biz   = settings.business_name || profile?.business_name || "our store";

    return (
      `🧾 *Your bill from ${biz}*\n\n` +
      (unit ? `${unitWord} ${unit}\n` : "") +
      `${lines}\n` +
      `──────────────\n` +
      `*Total: ${inr(total)}*\n\n` +
      (upi ? `💳 Pay by UPI: *${upi}*\n` : "") +
      `Or pay at the counter — just show this message.\n\n` +
      `Thank you! 🙏`
    );
  };

  const sendBill = async () => {
    const o = sheet;
    if (!o) return;
    const cust = customerFor(o);
    if (!cust) {
      Alert.alert(
        "Can't send yet",
        "This order isn't linked to a saved customer, so there's no WhatsApp number to send to. Add the customer first, or collect at the counter."
      );
      return;
    }
    setSending(true);
    try {
      await sendMessageToCustomer(cust.id, buildBillText(o));
      setSentIds(p => ({ ...p, [o.id]: true }));
      setSheet(null);
      Alert.alert("Bill sent", `Payment details sent to ${cust.name || o.name || "the customer"} on WhatsApp.`);
    } catch (e) {
      Alert.alert("Couldn't send", friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  /* ── derived ──────────────────────────────────────────────────────────── */
  const open      = orders.filter(o => UNPAID.includes(o.status));
  const settled   = orders.filter(o => o.status === "delivered");
  const pendingRs = open.reduce((s, o) => s + totalOf(o), 0);
  const gotRs     = settled.reduce((s, o) => s + totalOf(o), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.centerText}>Loading bills…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={Colors.primary}
                          onRefresh={() => { setRefreshing(true); load(true); }} />
        }
      >
        <Text style={styles.title}>Collect Payment</Text>
        <Text style={styles.sub}>
          Send the bill and UPI details straight to the customer's WhatsApp.
        </Text>

        {!!error && (
          <View style={styles.errBanner}>
            <Ionicons name="alert-circle-outline" size={15} color={Colors.yellow} />
            <Text style={styles.errText}>{error}</Text>
            <TouchableOpacity onPress={() => load()}><Text style={styles.errRetry}>Retry</Text></TouchableOpacity>
          </View>
        )}

        {/* Summary */}
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: Colors.yellow }]}>{inr(pendingRs)}</Text>
            <Text style={styles.statLbl}>To collect</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: Colors.green }]}>{inr(gotRs)}</Text>
            <Text style={styles.statLbl}>Collected</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{open.length}</Text>
            <Text style={styles.statLbl}>Open bills</Text>
          </View>
        </View>

        {/* Open bills */}
        <Text style={styles.section}>OPEN BILLS</Text>
        {open.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={38} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No open bills</Text>
            <Text style={styles.emptyHint}>Unpaid orders will appear here ready to bill.</Text>
          </View>
        ) : open.map(o => {
          const unit = unitOf(o);
          const sent = sentIds[o.id];
          const cust = customerFor(o);
          return (
            <View key={o.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.unitBox}>
                  <Text style={styles.unitLbl}>{unitWord.toUpperCase()}</Text>
                  <Text style={styles.unitNo}>{unit || "—"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.custName}>{o.name || cust?.name || "Guest"}</Text>
                  <Text style={styles.itemsLine} numberOfLines={2}>
                    {itemsOf(o).length
                      ? itemsOf(o).map(i => `${i.name} ×${i.qty || 1}`).join(", ")
                      : `Order #${String(o.id).slice(-5)}`}
                  </Text>
                  {!cust && (
                    <Text style={styles.warnLine}>No linked WhatsApp number</Text>
                  )}
                </View>
                <Text style={styles.amount}>{inr(totalOf(o))}</Text>
              </View>

              <TouchableOpacity
                style={[styles.payBtn, sent && styles.payBtnSent]}
                onPress={() => setSheet(o)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={sent ? "checkmark-circle" : "logo-whatsapp"}
                  size={15}
                  color={sent ? Colors.green : "#fff"}
                />
                <Text style={[styles.payBtnText, sent && { color: Colors.green }]}>
                  {sent ? "Bill sent · send again" : "Request payment on WhatsApp"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Bill preview sheet */}
      <Modal visible={!!sheet} animationType="slide" transparent onRequestClose={() => setSheet(null)}>
        <View style={styles.mdBackdrop}>
          <View style={styles.mdSheet}>
            <View style={styles.mdHead}>
              <Text style={styles.mdTitle}>
                Bill preview{unitOf(sheet || {}) ? ` · ${unitWord} ${unitOf(sheet)}` : ""}
              </Text>
              <TouchableOpacity onPress={() => setSheet(null)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              <View style={styles.billBox}>
                <Text style={styles.billText}>{sheet ? buildBillText(sheet) : ""}</Text>
              </View>
              {!settings.upi_id && (
                <Text style={styles.upiWarn}>
                  No UPI ID saved — add one in Settings so customers can pay from the message.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.sendBtn, sending && { opacity: 0.6 }]}
              onPress={sendBill}
              disabled={sending}
              activeOpacity={0.85}
            >
              {sending
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                    <Text style={styles.sendBtnText}>Send to WhatsApp</Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 14, paddingBottom: 36 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  centerText: { color: Colors.textMuted, fontSize: 13, marginTop: 12 },

  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  sub  : { color: Colors.textMuted, fontSize: 12, marginTop: 3, marginBottom: 14, lineHeight: 17 },

  errBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.yellow, borderRadius: 10, padding: 10, marginBottom: 12 },
  errText  : { flex: 1, color: Colors.textSecondary, fontSize: 12 },
  errRetry : { color: Colors.primaryLight, fontSize: 12, fontWeight: "700" },

  statRow: { flexDirection: "row", gap: 9, marginBottom: 18 },
  stat   : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, alignItems: "center" },
  statVal: { color: Colors.textPrimary, fontSize: 16.5, fontWeight: "800", letterSpacing: -0.3 },
  statLbl: { color: Colors.textMuted, fontSize: 10, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: "600" },

  section: { color: Colors.textMuted, fontSize: 10.5, fontWeight: "800", letterSpacing: 1, marginBottom: 9 },

  card    : { backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 10 },
  cardTop : { flexDirection: "row", alignItems: "center", gap: 11 },
  unitBox : { width: 52, backgroundColor: Colors.bgElevated, borderRadius: 10, paddingVertical: 7, alignItems: "center" },
  unitLbl : { color: Colors.textMuted, fontSize: 8, letterSpacing: 0.8, fontWeight: "700" },
  unitNo  : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", lineHeight: 21 },
  custName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  itemsLine: { color: Colors.textSecondary, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  warnLine: { color: Colors.yellow, fontSize: 10.5, marginTop: 3 },
  amount  : { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },

  payBtn    : { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#25D366", borderRadius: 10, paddingVertical: 10, marginTop: 11 },
  payBtnSent: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  payBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },

  empty    : { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600", marginTop: 10 },
  emptyHint: { color: Colors.textMuted, fontSize: 11.5, marginTop: 4 },

  mdBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  mdSheet   : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 26 },
  mdHead    : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  mdTitle   : { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "700" },
  billBox   : { backgroundColor: Colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  billText  : { color: Colors.textSecondary, fontSize: 12.5, lineHeight: 19 },
  upiWarn   : { color: Colors.yellow, fontSize: 11, marginTop: 10, lineHeight: 16 },
  sendBtn   : { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#25D366", borderRadius: 12, paddingVertical: 13, marginTop: 16 },
  sendBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
