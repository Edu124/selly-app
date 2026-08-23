// ── Billing — what this kitchen pays Selly ────────────────────────────────────
//
//   ₹1,000  once, to onboard
//   ₹20     per order that actually completes
//
// That is the entire price list, and the screen is built to make that obvious
// rather than to bury it. No plan comparison, no upgrade path, no tiers.
//
// NOT the Members screen. Members is what this kitchen's customers pay the
// kitchen. This is what the kitchen pays us. Opposite direction of money.
//
// The bill is computed from the kitchen's own orders every time it loads, and
// the orders that made it up are listed underneath. A kitchen that thinks the
// number is wrong can count them.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { fetchOrders, fetchBusinessBilling, fetchBillingPayments } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { inr } from "../lib/whatsapp";
import {
  billForPeriod, billingHistory, aggregatorComparison, normalizeBilling,
  PER_ORDER_FEE, ONBOARDING_FEE,
} from "../lib/billing";
import { sellyInvoiceLink, sellyPayable, billRef } from "../lib/payments";

const SUPPORT_WA = "https://wa.me/919370499351?text=" +
  encodeURIComponent("Hi Selly, I'd like to settle my bill.");

export default function BillingScreen() {
  const [orders,   setOrders]   = useState([]);
  const [billing,  setBilling]  = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,    setError]    = useState(null);
  const [showOrders, setShowOrders] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [o, b, p] = await Promise.all([
        fetchOrders({ page: 1, limit: 500 }),
        fetchBusinessBilling().catch(() => null),   // migration 004 may not be run
        fetchBillingPayments().catch(() => []),
      ]);
      setOrders(o.orders || []);
      setBilling(b);
      setPayments(Array.isArray(p) ? p : []);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading && !orders.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.centerText}>Working out this month…</Text>
      </View>
    );
  }

  const terms = normalizeBilling(billing);
  const bill  = billForPeriod(orders, { onboardingPaid: terms.onboardingPaid });
  const vs    = aggregatorComparison(bill.billableOrders);
  const past  = billingHistory(orders, 6).slice(1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <Text style={styles.pageTitle}>Billing</Text>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ── the price list, stated plainly ── */}
      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>WHAT SELLY COSTS YOU</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceAmt}>{inr(terms.onboardingFee)}</Text>
          <Text style={styles.priceWhat}>once, to get set up</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceAmt}>{inr(terms.perOrderFee)}</Text>
          <Text style={styles.priceWhat}>per order that completes</Text>
        </View>
        <Text style={styles.priceNote}>
          That's everything. No monthly fee, and never a percentage of the bill —
          a ₹2,000 order costs you the same {inr(terms.perOrderFee)} as a ₹200 one.
        </Text>
      </View>

      {/* ── this month ── */}
      <View style={styles.dueCard}>
        <Text style={styles.dueLabel}>{bill.period.toUpperCase()}</Text>
        <Text style={styles.dueValue}>{inr(bill.totalDue)}</Text>

        <View style={styles.lineItems}>
          <View style={styles.line}>
            <Text style={styles.lineText}>
              {bill.ordersBilled} completed order{bill.ordersBilled === 1 ? "" : "s"} × {inr(terms.perOrderFee)}
            </Text>
            <Text style={styles.lineAmt}>{inr(bill.orderCharges)}</Text>
          </View>

          {bill.ordersFree > 0 && (
            <View style={styles.line}>
              <Text style={styles.lineFree}>
                {bill.ordersFree} still open or cancelled — not charged
              </Text>
              <Text style={styles.lineFreeAmt}>₹0</Text>
            </View>
          )}

          {bill.onboarding > 0 && (
            <View style={styles.line}>
              <Text style={styles.lineText}>One-time onboarding</Text>
              <Text style={styles.lineAmt}>{inr(bill.onboarding)}</Text>
            </View>
          )}
        </View>

        {bill.ordersBilled > 0 && (
          <TouchableOpacity style={styles.showLink} onPress={() => setShowOrders(v => !v)}>
            <Text style={styles.showLinkText}>
              {showOrders ? "Hide the orders" : "See exactly which orders"}
            </Text>
            <Ionicons name={showOrders ? "chevron-up" : "chevron-down"} size={13} color={Colors.primaryLight} />
          </TouchableOpacity>
        )}

        {showOrders && (
          <View style={styles.orderList}>
            {bill.billableOrders.slice(0, 40).map(o => (
              <View key={o.id} style={styles.orderLine}>
                <Text style={styles.orderId}>#{String(o.id).slice(-5)}</Text>
                <Text style={styles.orderName} numberOfLines={1}>{o.name || "Guest"}</Text>
                <Text style={styles.orderFee}>{inr(terms.perOrderFee)}</Text>
              </View>
            ))}
            {bill.billableOrders.length > 40 && (
              <Text style={styles.orderMore}>
                …and {bill.billableOrders.length - 40} more
              </Text>
            )}
          </View>
        )}
      </View>

      {/* ── the comparison that makes ₹20 look like what it is ── */}
      {vs.gross > 0 && (
        <View style={styles.vsCard}>
          <Text style={styles.vsLabel}>ON THE SAME ORDERS</Text>
          <View style={styles.vsRow}>
            <View style={styles.vsCol}>
              <Text style={styles.vsAmtBad}>{inr(vs.theirCut)}</Text>
              <Text style={styles.vsWho}>an aggregator's 25%</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
            <View style={styles.vsCol}>
              <Text style={styles.vsAmtGood}>{inr(vs.ourFee)}</Text>
              <Text style={styles.vsWho}>Selly</Text>
            </View>
          </View>
          <Text style={styles.vsSaved}>
            You kept {inr(vs.saved)} this month that a marketplace would have taken.
          </Text>
        </View>
      )}

      {/* ── settle ── */}
      {bill.totalDue > 0 && (() => {
        const link = sellyInvoiceLink({
          amount    : bill.totalDue,
          period    : bill.period,
          businessId: terms.businessId,
        });

        // A UPI link when one can be built, a conversation when it cannot.
        // Never a dead button: a kitchen that wants to pay us and finds nothing
        // happens is the worst possible moment to look unfinished.
        return link ? (
          <>
            <TouchableOpacity style={styles.payBtn} onPress={() => Linking.openURL(link)}>
              <Ionicons name="card" size={16} color="#fff" />
              <Text style={styles.payBtnText}>Pay {inr(bill.totalDue)} by UPI</Text>
            </TouchableOpacity>
            <Text style={styles.payRef}>
              Reference {billRef(terms.businessId, bill.period)} — it appears on your
              statement, so you can match it later.
            </Text>
          </>
        ) : (
          <TouchableOpacity style={styles.payBtn} onPress={() => Linking.openURL(SUPPORT_WA)}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
            <Text style={styles.payBtnText}>Settle {inr(bill.totalDue)}</Text>
          </TouchableOpacity>
        );
      })()}

      {/* ── history ── */}
      {past.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>EARLIER MONTHS</Text>
          {past.map(m => (
            <View key={m.period} style={styles.histRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.histPeriod}>{m.period}</Text>
                <Text style={styles.histMeta}>
                  {m.ordersBilled} order{m.ordersBilled === 1 ? "" : "s"}
                </Text>
              </View>
              <Text style={styles.histAmt}>{inr(m.orderCharges)}</Text>
            </View>
          ))}
        </>
      )}

      {payments.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>PAYMENTS RECEIVED</Text>
          {payments.map(p => (
            <View key={p.id} style={styles.histRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.histPeriod}>
                  {p.kind === "onboarding" ? "Onboarding" : p.period || "Orders"}
                </Text>
                <Text style={styles.histMeta}>
                  {new Date(p.paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {p.method ? ` · ${p.method}` : ""}
                </Text>
              </View>
              <Text style={styles.histPaid}>{inr(p.amount)}</Text>
            </View>
          ))}
        </>
      )}

      <Text style={styles.footNote}>
        Charged only on orders that reached the customer. Cancelled, rejected and
        unpaid orders are never billed.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, paddingBottom: 40 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  centerText: { color: Colors.textMuted, fontSize: 13, marginTop: 12 },
  pageTitle : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", marginBottom: 18 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
    borderRadius: 11, padding: 12, marginBottom: 14,
  },
  errorText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },

  priceCard : {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  priceLabel: { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.9, marginBottom: 12 },
  priceRow  : { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 8 },
  priceAmt  : { color: Colors.textPrimary, fontSize: 24, fontWeight: "800", letterSpacing: -0.5, minWidth: 86 },
  priceWhat : { color: Colors.textSecondary, fontSize: 13 },
  priceNote : { color: Colors.textMuted, fontSize: 11.5, lineHeight: 18, marginTop: 6 },

  dueCard  : {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: "rgba(124,92,255,0.32)",
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  dueLabel : { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.9 },
  dueValue : { color: Colors.textPrimary, fontSize: 34, fontWeight: "800", letterSpacing: -0.9, marginTop: 6 },
  lineItems: { marginTop: 14, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  line     : { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  lineText : { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  lineAmt  : { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "700" },
  lineFree : { color: Colors.green, fontSize: 12.5, flex: 1 },
  lineFreeAmt: { color: Colors.green, fontSize: 13, fontWeight: "700" },

  showLink    : { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 },
  showLinkText: { color: Colors.primaryLight, fontSize: 12.5, fontWeight: "600" },
  orderList   : { marginTop: 10, backgroundColor: Colors.bg, borderRadius: 10, padding: 10 },
  orderLine   : { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  orderId     : { color: Colors.textMuted, fontSize: 11.5, fontFamily: "monospace", minWidth: 52 },
  orderName   : { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  orderFee    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "700" },
  orderMore   : { color: Colors.textMuted, fontSize: 11.5, marginTop: 6, textAlign: "center" },

  vsCard : {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  vsLabel: { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.9, marginBottom: 12 },
  vsRow  : { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  vsCol  : { alignItems: "center" },
  vsAmtBad : { color: "#f87171", fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  vsAmtGood: { color: Colors.green, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  vsWho    : { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  vsSaved  : { color: Colors.textSecondary, fontSize: 12.5, textAlign: "center", marginTop: 14, lineHeight: 18 },

  payBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12, padding: 15, marginBottom: 6,
  },
  payBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  payRef    : { color: Colors.textMuted, fontSize: 11, textAlign: "center",
                marginTop: 8, lineHeight: 16, paddingHorizontal: 10 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 9.5, fontWeight: "800",
    letterSpacing: 0.9, marginTop: 20, marginBottom: 9,
  },
  histRow   : {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 13, marginBottom: 8,
  },
  histPeriod: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "700" },
  histMeta  : { color: Colors.textMuted, fontSize: 11.5, marginTop: 3 },
  histAmt   : { color: Colors.textSecondary, fontSize: 14, fontWeight: "800" },
  histPaid  : { color: Colors.green, fontSize: 14, fontWeight: "800" },

  footNote: {
    color: Colors.textMuted, fontSize: 11.5, lineHeight: 18,
    textAlign: "center", marginTop: 22, paddingHorizontal: 16,
  },
});
