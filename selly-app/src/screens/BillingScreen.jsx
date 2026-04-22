import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchBillingSummary, fetchSubscription, recordPayment } from "../lib/api";

const PROMO_COLOR = {
  flash_sale    : Colors.yellow,
  new_arrival   : Colors.blue,
  abandoned_cart: Colors.accent,
  referral      : Colors.green,
};

export default function BillingScreen() {
  const [summary, setSummary]       = useState(null);
  const [sub, setSub]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPay, setShowPay]       = useState(false);
  const [paying, setPaying]         = useState(false);
  const [payId, setPayId]           = useState("");
  const [payMethod, setPayMethod]   = useState("upi");
  const [payResult, setPayResult]   = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sum, s] = await Promise.all([fetchBillingSummary(), fetchSubscription()]);
      setSummary(sum);
      setSub(s);
    } catch (e) {
      console.warn(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(true); };

  const submitPayment = async () => {
    if (!payId.trim()) return;
    setPaying(true);
    try {
      const d = await recordPayment({ amount: 3000, paymentId: payId.trim(), method: payMethod });
      setPayResult({ ok: true, msg: "Payment recorded! Subscription renewed." });
      setSub(d.subscription || sub);
      load(true);
      setTimeout(() => { setShowPay(false); setPayResult(null); setPayId(""); }, 2000);
    } catch (e) {
      setPayResult({ ok: false, msg: e.message });
    } finally {
      setPaying(false);
    }
  };

  const statusColor = (s) => {
    if (s === "active") return Colors.green;
    if (s === "trial")  return Colors.yellow;
    if (s === "expired" || s === "suspended") return Colors.red;
    return Colors.textSecondary;
  };

  const billing = summary?.billing || {};
  const commissions = summary?.commissions || [];

  if (loading && !summary) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.pageTitle}>Billing</Text>

      {/* Subscription card */}
      <View style={styles.subCard}>
        <View style={styles.subCardHeader}>
          <View>
            <Text style={styles.subPlan}>Selly Pro</Text>
            <Text style={styles.subFee}>₹3,000 / month</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor(sub?.status) + "22" }]}>
            <Text style={[styles.statusText, { color: statusColor(sub?.status) }]}>
              {(sub?.status || "unknown").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.subDetails}>
          <SubDetail label="Days Remaining" value={`${sub?.daysRemaining ?? "—"} days`} />
          <SubDetail label="Renews On" value={sub?.renewalDate
            ? new Date(sub.renewalDate).toLocaleDateString("en-IN")
            : "—"} />
          <SubDetail label="Member Since" value={sub?.startDate
            ? new Date(sub.startDate).toLocaleDateString("en-IN")
            : "—"} />
        </View>

        {/* Progress bar */}
        {sub?.daysRemaining != null && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {
                width: `${Math.min(100, Math.max(0, (sub.daysRemaining / 30) * 100))}%`,
                backgroundColor: statusColor(sub?.status),
              }]} />
            </View>
            <Text style={styles.progressLabel}>{sub.daysRemaining} / 30 days left</Text>
          </View>
        )}

        <TouchableOpacity style={styles.renewBtn} onPress={() => setShowPay(true)}>
          <Text style={styles.renewBtnText}>💳 Record Payment / Renew</Text>
        </TouchableOpacity>
      </View>

      {/* Current month summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>This Month — {billing.period || ""}</Text>
        <View style={styles.summaryGrid}>
          <SummaryItem label="Subscription Fee" value={`₹${(billing.subscriptionFee || 3000).toLocaleString("en-IN")}`} />
          <SummaryItem label="Commissions"       value={`₹${(billing.totalCommission || 0).toLocaleString("en-IN")}`} color={Colors.accent} />
        </View>
        <View style={styles.totalDueRow}>
          <Text style={styles.totalDueLabel}>Total Due</Text>
          <Text style={styles.totalDueValue}>₹{(billing.totalDue || 3000).toLocaleString("en-IN")}</Text>
        </View>
      </View>

      {/* Pricing info */}
      <View style={styles.pricingCard}>
        <Text style={styles.sectionTitle}>How Billing Works</Text>
        <BulletItem text="₹3,000 / month flat subscription fee" />
        <BulletItem text="+ 5% commission on promo-driven orders where any item is priced above ₹1,000" />
        <BulletItem text="Promotions: Flash Sale, New Arrival, Abandoned Cart, Referral" />
        <BulletItem text="Organic orders (no promo DM) attract zero commission" />
        <BulletItem text="Commission is per item — mixed carts only charge on items above ₹1,000" />
      </View>

      {/* Commission breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Commission Breakdown ({commissions.length})</Text>

        {commissions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No commissions this month 🎉</Text>
          </View>
        ) : (
          commissions.map((c, i) => (
            <View key={i} style={styles.commRow}>
              <View style={styles.commLeft}>
                <Text style={styles.commOrderId}>Order #{c.orderId}</Text>
                <Text style={styles.commDate}>{c.date}</Text>
              </View>
              <View style={[styles.promoTag, { backgroundColor: (PROMO_COLOR[c.promoSource] || Colors.textSecondary) + "22" }]}>
                <Text style={[styles.promoTagText, { color: PROMO_COLOR[c.promoSource] || Colors.textSecondary }]}>
                  {(c.promoSource || "").replace(/_/g, " ")}
                </Text>
              </View>
              <Text style={styles.commAmount}>₹{(c.amount || 0).toLocaleString("en-IN")}</Text>
            </View>
          ))
        )}
      </View>

      {/* Payment modal */}
      <Modal visible={showPay} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Record Payment</Text>

            <Text style={styles.fieldLabel}>Payment ID / Reference</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. pay_UPI12345"
              placeholderTextColor={Colors.textMuted}
              value={payId}
              onChangeText={setPayId}
            />

            <Text style={styles.fieldLabel}>Payment Method</Text>
            <View style={styles.methodRow}>
              {["upi", "bank_transfer", "cash", "card"].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodChip, payMethod === m && styles.methodChipActive]}
                  onPress={() => setPayMethod(m)}
                >
                  <Text style={[styles.methodText, payMethod === m && styles.methodTextActive]}>
                    {m.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.payNote}>
              Amount: ₹3,000 (subscription renewal for next 30 days)
            </Text>

            {payResult && (
              <View style={[styles.payResultBox, { backgroundColor: payResult.ok ? Colors.green + "22" : Colors.red + "22" }]}>
                <Text style={{ color: payResult.ok ? Colors.green : Colors.red, fontWeight: "700" }}>
                  {payResult.msg}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, paying && styles.submitBtnDisabled]}
              onPress={submitPayment}
              disabled={paying}
            >
              {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Payment</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPay(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function SubDetail({ label, value }) {
  return (
    <View style={styles.subDetailItem}>
      <Text style={styles.subDetailLabel}>{label}</Text>
      <Text style={styles.subDetailValue}>{value}</Text>
    </View>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryItemLabel}>{label}</Text>
      <Text style={[styles.summaryItemValue, color && { color }]}>{value}</Text>
    </View>
  );
}

function BulletItem({ text }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: Colors.bg },
  content     : { padding: 16, paddingBottom: 40 },
  center      : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  pageTitle   : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", marginBottom: 20 },

  // Subscription card
  subCard       : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.primary + "33" },
  subCardHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  subPlan       : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  subFee        : { color: Colors.primary, fontSize: 14, fontWeight: "700", marginTop: 2 },
  statusPill    : { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  statusText    : { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  subDetails    : { gap: 4, marginBottom: 12 },
  subDetailItem : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  subDetailLabel: { color: Colors.textSecondary, fontSize: 13 },
  subDetailValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  progressWrap  : { marginBottom: 12 },
  progressBg    : { height: 6, backgroundColor: Colors.bgInput, borderRadius: 3, overflow: "hidden" },
  progressFill  : { height: "100%", borderRadius: 3 },
  progressLabel : { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  renewBtn      : { backgroundColor: Colors.primary + "22", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.primary + "44" },
  renewBtnText  : { color: Colors.primary, fontWeight: "700", fontSize: 14 },

  // Summary card
  summaryCard   : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  summaryGrid   : { gap: 6, marginBottom: 12 },
  summaryItem   : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryItemLabel: { color: Colors.textSecondary, fontSize: 14 },
  summaryItemValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  totalDueRow   : { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  totalDueLabel : { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  totalDueValue : { color: Colors.primary, fontSize: 20, fontWeight: "900" },

  sectionTitle  : { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 12 },
  section       : { marginBottom: 24 },
  emptyBox      : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText     : { color: Colors.textMuted, fontSize: 14 },

  // Pricing card
  pricingCard   : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  bullet        : { flexDirection: "row", marginBottom: 6 },
  bulletDot     : { color: Colors.primary, fontWeight: "800", marginRight: 8, fontSize: 15 },
  bulletText    : { color: Colors.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 },

  // Commission rows
  commRow       : { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: Colors.bgCard, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  commLeft      : { flex: 1 },
  commOrderId   : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  commDate      : { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  promoTag      : { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginHorizontal: 8 },
  promoTagText  : { fontSize: 11, fontWeight: "700" },
  commAmount    : { color: Colors.accent, fontSize: 15, fontWeight: "800", minWidth: 50, textAlign: "right" },

  // Modal
  modalOverlay  : { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet    : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  modalHandle   : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle    : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", marginBottom: 16 },
  fieldLabel    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input         : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  methodRow     : { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  methodChip    : { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  methodChipActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  methodText    : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  methodTextActive: { color: Colors.primary },
  payNote       : { color: Colors.textSecondary, fontSize: 13, marginTop: 12, marginBottom: 4, fontStyle: "italic" },
  payResultBox  : { borderRadius: 10, padding: 12, marginTop: 10 },
  submitBtn     : { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText    : { color: "#fff", fontWeight: "800", fontSize: 15 },
  cancelBtn     : { padding: 14, alignItems: "center" },
  cancelText    : { color: Colors.textSecondary, fontSize: 14 },
});
