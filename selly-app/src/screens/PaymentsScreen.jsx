// ── Payments Screen ───────────────────────────────────────────────────────────
// Collect payment for an open bill. Staff sees each unpaid order (table or
// customer), taps "Request payment", reviews the itemised bill, and the bill +
// UPI details are sent straight to that customer's WhatsApp.
//
// Uses existing endpoints only:
//   fetchOrders()            → open bills
//   fetchCustomers()         → resolve the customer id from the order's mobile
//   deliver()                → opens the bill in WhatsApp or SMS on this phone
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
  fetchOrders, fetchCustomers, fetchBusinessSettings,
} from "../lib/api";
import { friendlyError } from "../lib/errors";
import { typeConfig } from "../lib/businessTypes";
import { inr, orderTotal, resolveCustomer, tplBill } from "../lib/whatsapp";
import { deliver, isReachable, tenDigit, DEFAULT_CHANNEL } from "../lib/messaging";
import { upiLink, orderRef, payabilityOf } from "../lib/payments";

export default function PaymentsScreen() {
  const { industry, profile } = useAuth();
  const type     = typeConfig(industry);
  const unitWord = type.unitWord;          // Table / Slot / Order
  // Which statuses still owe money is a property of the business type's flow.
  const UNPAID   = type.unpaid;
  const SETTLED  = type.settled;

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
  // What identifies a bill differs by business: a café calls it by table, a
  // bakery by pickup slot, a cloud kitchen by order number — it has no table, so
  // reading table_no there only ever produced a dash.
  const unitOf = (o) => {
    if (!o) return null;
    if (type.id === "cafe")   return o.table_no ?? null;
    if (type.id === "bakery") return o.extra?.due || null;
    return o.id ? `#${String(o.id).slice(-5)}` : null;
  };
  const itemsOf = o => Array.isArray(o.cart) ? o.cart : [];
  // `bill` is a jsonb object ({subtotal, discount, delivery, total}). Reading it
  // as a number always yielded NaN, so this silently fell through to summing the
  // cart and ignored any discount or delivery fee on the order.
  const totalOf = orderTotal;

  const customerFor = (o) => resolveCustomer(o, customers);

  // Whether this kitchen can take an online payment at all. A missing UPI id is
  // the commonest reason a bill goes out with nothing to tap, and it is a field
  // in Settings nobody thinks to fill in until it matters.
  const payable = payabilityOf(settings);

  const buildBillText = (o) => tplBill({
    order       : o,
    typeId      : type.id,
    tableNo     : o.table_no,
    businessName: settings.business_name || profile?.business_name,
    upiId       : settings.upi_id,
    payLink     : payable.ok ? upiLink({
      vpa   : payable.vpa,
      name  : settings.business_name || profile?.business_name,
      amount: totalOf(o),
      note  : `Order ${String(o.id).slice(-5)}`,
      ref   : orderRef(o.id),
    }) : null,
  });

  const sendBill = async () => {
    const o = sheet;
    if (!o) return;
    const cust = customerFor(o);
    // The order carries the mobile number, which is all that is needed. The old
    // check demanded a bot_customers row that a manually-entered order never
    // has, so every typed-in bill was unsendable.
    if (!isReachable(o)) {
      Alert.alert(
        "No mobile number",
        "This order has no mobile number on it, so there's nobody to send the bill to."
      );
      return;
    }
    setSending(true);
    try {
      const out = await deliver({
        mobile : o.mobile,
        channel: (cust && cust.preferred_channel) || DEFAULT_CHANNEL,
        text   : buildBillText(o),
      });
      if (!out.ok) throw new Error(out.error);
      setSentIds(p => ({ ...p, [o.id]: true }));
      setSheet(null);
      // "Ready to send", not "sent" -- their phone opened the chat with the text
      // in it. Whether they pressed send is not something we can know.
      Alert.alert(
        "Bill ready to send",
        `The message to ${(cust && cust.name) || o.name || "the customer"} is open with the payment details filled in.`
      );
    } catch (e) {
      Alert.alert("Couldn't open the message", friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  /* ── derived ──────────────────────────────────────────────────────────── */
  const open      = orders.filter(o => UNPAID.includes(o.status));
  const settled   = orders.filter(o => SETTLED.includes(o.status));
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
          Send the bill straight to the customer, with a link that opens their
          UPI app with the amount already filled in.
        </Text>

        {!payable.ok && (
          <View style={styles.errBanner}>
            <Ionicons name="card-outline" size={15} color={Colors.yellow} />
            <Text style={styles.errText}>{payable.reason}</Text>
          </View>
        )}

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
                  <Text
                    style={[styles.unitNo, String(unit || "").length > 4 && styles.unitNoSm]}
                    numberOfLines={2}
                  >
                    {unit || "—"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.custName}>{o.name || cust?.name || "Guest"}</Text>
                  <Text style={styles.itemsLine} numberOfLines={2}>
                    {itemsOf(o).length
                      ? itemsOf(o).map(i => `${i.name} ×${i.qty || 1}`).join(", ")
                      : `Order #${String(o.id).slice(-5)}`}
                  </Text>
                  {!cust && (
                    <Text style={styles.warnLine}>No mobile number on this order</Text>
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
                  {sent ? "Bill sent · send again" : "Send payment request"}
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
                Bill preview{unitOf(sheet) ? ` · ${unitWord} ${unitOf(sheet)}` : ""}
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
                    <Text style={styles.sendBtnText}>Send the bill</Text>
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
  unitNo  : { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", lineHeight: 21, textAlign: "center" },
  // Slot names and order numbers don't fit at table-number size.
  unitNoSm: { fontSize: 11, lineHeight: 14, paddingHorizontal: 3 },
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
