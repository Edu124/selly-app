// ── Home / Dashboard Screen ───────────────────────────────────────────────────
// The landing screen behind the "Home" sidebar item. Restaurant layout:
// KPI row → open orders by table → running dishes → sales chart →
// most/least ordered dishes → payments by table.
//
// Data: real values come from fetchDashboard() (orders + customers via Railway).
// Sections the backend does not expose yet — table occupancy, live kitchen
// status, per-dish counts — render honest empty states rather than fake
// numbers, and are marked with `needsBackend` below.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import { fetchDashboard } from "../lib/api";
import { friendlyError } from "../lib/errors";

const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN");

/* ── Sector-specific labels ─────────────────────────────────────────────── */
const LABELS = {
  restaurant: {
    kpi1: "Daily Sales",  kpi2: "Open Orders", kpi3: "Total Orders",
    kpi4: "Payment Received",
    openTitle: "Open Orders by Table",  unitCol: "Table",
    runningTitle: "Running Dishes",     mostTitle: "Most Ordered Dishes",
    leastTitle: "Least Ordered Dishes", payTitle: "Payment Received by Table",
    itemWord: "dish", itemWordPlural: "dishes",
  },
  education: {
    kpi1: "Fees Collected", kpi2: "Open Enrollments", kpi3: "Total Enrollments",
    kpi4: "Payment Received",
    openTitle: "Open Enrollments by Batch", unitCol: "Batch",
    runningTitle: "Ongoing Classes",        mostTitle: "Most Enrolled Courses",
    leastTitle: "Least Enrolled Courses",   payTitle: "Fees Received by Batch",
    itemWord: "course", itemWordPlural: "courses",
  },
};

/* ── Small building blocks ──────────────────────────────────────────────── */
function KpiCard({ icon, tile, label, value, sub, subUp, wide }) {
  const [bg, fg] = Colors.tile[tile] || Colors.tile.violet;
  return (
    <View style={[styles.kpi, wide && { flexBasis: "100%" }]}>
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={16} color={fg} />
        </View>
        <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      {!!sub && (
        <Text style={styles.kpiSub}>
          {subUp != null && (
            <Text style={{ color: subUp ? Colors.green : Colors.red }}>
              {subUp ? "↑ " : "↓ "}
            </Text>
          )}
          {sub}
        </Text>
      )}
    </View>
  );
}

function Panel({ title, right, children, onMore, moreLabel }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {right}
      </View>
      {children}
      {!!onMore && (
        <TouchableOpacity style={styles.panelMore} onPress={onMore}>
          <Text style={styles.panelMoreText}>{moreLabel} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Pill({ text, tone }) {
  const map = {
    prep : ["rgba(245,165,36,0.15)", "#fbbf5c"],
    ready: ["rgba(34,197,94,0.15)",  "#4ade80"],
    paid : ["rgba(34,197,94,0.15)",  "#4ade80"],
    due  : ["rgba(239,68,68,0.15)",  "#f87171"],
  };
  const [bg, fg] = map[tone] || map.prep;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

function EmptyRow({ text, hint }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
      {!!hint && <Text style={styles.emptyHint}>{hint}</Text>}
    </View>
  );
}

/* ── Sales chart ────────────────────────────────────────────────────────────
   Built from plain Views (no native chart dependency) — a cumulative column
   trend. Reads the same as a line chart and keeps the iOS build dependency-free.
   ───────────────────────────────────────────────────────────────────────── */
function SalesChart({ points }) {
  const H   = 140;
  const max = Math.max(...points, 1);
  const allZero = points.every(v => v === 0);

  return (
    <View style={styles.chart}>
      {/* grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <View key={f} style={[styles.grid, { bottom: H * f }]} />
      ))}
      <View style={styles.chartCols}>
        {points.map((v, i) => {
          const h = allZero ? 2 : Math.max(2, (v / max) * (H - 12));
          const isLast = i === points.length - 1;
          return (
            <View key={i} style={styles.colWrap}>
              <View
                style={[
                  styles.col,
                  { height: h, backgroundColor: isLast ? Colors.primaryLight : Colors.primary },
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ── Screen ─────────────────────────────────────────────────────────────── */
export default function HomeScreen({ navigation }) {
  const { industry, profile } = useAuth();
  const L = LABELS[industry] || LABELS.restaurant;
  const { width } = useWindowDimensions();
  const twoCol = width >= 820;

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await fetchDashboard());
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.centerText}>Loading dashboard…</Text>
      </View>
    );
  }

  const s        = data?.stats || {};
  const recent   = data?.recent || [];
  const openOrd  = recent.filter(o => ["pending_payment", "confirmed", "packed"].includes(o.status));
  const paidOrd  = recent.filter(o => ["delivered", "shipped"].includes(o.status));
  const today    = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  // Revenue trend — derived from real orders if timestamps exist, else flat.
  const trend = (() => {
    const buckets = new Array(12).fill(0);
    recent.forEach(o => {
      const t = new Date(o.created_at || o.createdAt || Date.now());
      const h = Math.min(11, Math.floor(t.getHours() / 2));
      buckets[h] += Number(o.total || o.amount || 0);
    });
    let run = 0;
    return buckets.map(v => (run += v));
  })();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={Colors.primary}
                        onRefresh={() => { setRefreshing(true); load(true); }} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Dashboard</Text>
          <Text style={styles.hSub}>{profile?.business_name || "My Business"} · {today}</Text>
        </View>
      </View>

      {!!error && (
        <View style={styles.errBanner}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.yellow} />
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}><Text style={styles.errRetry}>Retry</Text></TouchableOpacity>
        </View>
      )}

      {/* KPI row */}
      <View style={styles.kpiRow}>
        <KpiCard icon="cash-outline"     tile="violet" label={L.kpi1}
                 value={inr(s.todayRevenue)} sub={`Total ${inr(s.totalRevenue)}`} />
        <KpiCard icon="receipt-outline"  tile="amber"  label={L.kpi2}
                 value={s.pending || 0}      sub={`${s.confirmed || 0} confirmed`} />
        <KpiCard icon="cube-outline"     tile="blue"   label={L.kpi3}
                 value={s.total || 0}        sub={`${s.delivered || 0} completed`} />
        <KpiCard icon="wallet-outline"   tile="green"  label={L.kpi4}
                 value={inr(s.totalRevenue)} sub={`${paidOrd.length} settled`} />
      </View>

      <View style={twoCol ? styles.gridTwo : styles.gridOne}>
        {/* Open orders by table/batch */}
        <Panel
          title={L.openTitle}
          onMore={() => navigation.navigate("Orders")}
          moreLabel={`View all open ${industry === "education" ? "enrollments" : "orders"}`}
        >
          <View style={styles.thead}>
            <Text style={[styles.th, { flex: 1 }]}>{L.unitCol}</Text>
            <Text style={[styles.th, { flex: 1 }]}>Items</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Time</Text>
            <Text style={[styles.th, { width: 76, textAlign: "right" }]}>Status</Text>
          </View>
          {openOrd.length === 0 ? (
            <EmptyRow text="No open orders right now"
                      hint="New orders from WhatsApp appear here." />
          ) : openOrd.map(o => (
            <View key={o.id} style={styles.tr}>
              <Text style={[styles.td, styles.tdStrong, { flex: 1 }]}>
                {o.table_no || o.batch || `#${String(o.id).slice(-4)}`}
              </Text>
              <Text style={[styles.td, { flex: 1 }]}>{(o.items?.length ?? 1)} item{(o.items?.length ?? 1) > 1 ? "s" : ""}</Text>
              <Text style={[styles.td, { flex: 1.2 }]}>
                {new Date(o.created_at || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <View style={{ width: 76, alignItems: "flex-end" }}>
                <Pill text={o.status === "packed" ? "Ready" : "Preparing"}
                      tone={o.status === "packed" ? "ready" : "prep"} />
              </View>
            </View>
          ))}
        </Panel>

        {/* Running dishes / ongoing classes — needsBackend: live kitchen status */}
        <Panel title={L.runningTitle}>
          <EmptyRow
            text={`No ${L.itemWordPlural} in progress`}
            hint="Live status arrives once orders are marked in progress."
          />
        </Panel>

        {/* Sales overview */}
        <Panel
          title="Sales Overview"
          right={<Text style={styles.panelPeriod}>Today</Text>}
        >
          <Text style={styles.chartValue}>{inr(s.todayRevenue)}</Text>
          <Text style={styles.chartSub}>Cumulative through the day</Text>
          <SalesChart points={trend} />
          <View style={styles.axis}>
            {["12 AM", "6 AM", "12 PM", "6 PM", "11 PM"].map((t, i) => (
              <Text key={i} style={styles.axisText}>{t}</Text>
            ))}
          </View>
        </Panel>

        {/* Most ordered — needsBackend: per-item aggregation */}
        <Panel title={L.mostTitle} right={<Text style={styles.panelPeriod}>Today</Text>}
               onMore={() => navigation.navigate(industry === "education" ? "Courses" : "Menu")}
               moreLabel="View full menu report">
          <EmptyRow text="Not enough order data yet"
                    hint={`Per-${L.itemWord} counts need item-level order aggregation.`} />
        </Panel>

        {/* Least ordered */}
        <Panel title={L.leastTitle} right={<Text style={styles.panelPeriod}>Today</Text>}>
          <EmptyRow text="Not enough order data yet"
                    hint={`Shows your slowest ${L.itemWordPlural} once orders build up.`} />
        </Panel>

        {/* Payments */}
        <Panel title={L.payTitle} right={<Text style={styles.panelPeriod}>Today</Text>}
               onMore={() => navigation.navigate("Payments")} moreLabel="View all payments">
          <View style={styles.thead}>
            <Text style={[styles.th, { flex: 1 }]}>{L.unitCol}</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Orders</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Amount</Text>
            <Text style={[styles.th, { width: 56, textAlign: "right" }]}>Status</Text>
          </View>
          {paidOrd.length === 0 ? (
            <EmptyRow text="No payments settled today" />
          ) : paidOrd.map(o => (
            <View key={o.id} style={styles.tr}>
              <Text style={[styles.td, styles.tdStrong, { flex: 1 }]}>
                {o.table_no || o.batch || `#${String(o.id).slice(-4)}`}
              </Text>
              <Text style={[styles.td, { flex: 0.8 }]}>{o.items?.length ?? 1}</Text>
              <Text style={[styles.td, { flex: 1.2 }]}>{inr(o.total || o.amount)}</Text>
              <View style={{ width: 56, alignItems: "flex-end" }}><Pill text="Paid" tone="paid" /></View>
            </View>
          ))}
        </Panel>
      </View>

      <Text style={styles.footer}>
        Last updated {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content  : { padding: 14, paddingBottom: 36 },
  center   : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  centerText: { color: Colors.textMuted, fontSize: 13, marginTop: 12 },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  hTitle: { color: Colors.textPrimary, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  hSub  : { color: Colors.textMuted, fontSize: 11.5, marginTop: 2 },

  errBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.yellow, borderRadius: 10, padding: 10, marginBottom: 12 },
  errText  : { flex: 1, color: Colors.textSecondary, fontSize: 12 },
  errRetry : { color: Colors.primaryLight, fontSize: 12, fontWeight: "700" },

  kpiRow  : { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 12 },
  kpi     : { flexGrow: 1, flexBasis: "46%", backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  kpiTop  : { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  kpiIcon : { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  kpiLabel: { flex: 1, color: Colors.textSecondary, fontSize: 11.5, fontWeight: "600" },
  kpiValue: { color: Colors.textPrimary, fontSize: 21, fontWeight: "800", letterSpacing: -0.5 },
  kpiSub  : { color: Colors.textMuted, fontSize: 10.5, marginTop: 3 },

  gridOne: { gap: 12 },
  gridTwo: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  panel     : { flexGrow: 1, flexBasis: 380, backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  panelHead : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  panelTitle: { color: Colors.textPrimary, fontSize: 14.5, fontWeight: "700" },
  panelPeriod: { color: Colors.textMuted, fontSize: 11, fontWeight: "600" },
  panelMore : { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  panelMoreText: { color: Colors.primaryLight, fontSize: 12, fontWeight: "700" },

  thead: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  th   : { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  tr   : { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  td   : { color: Colors.textSecondary, fontSize: 12.5 },
  tdStrong: { color: Colors.textPrimary, fontWeight: "700" },

  pill    : { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.3 },

  empty    : { paddingVertical: 22, alignItems: "center" },
  emptyText: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: "600" },
  emptyHint: { color: Colors.textMuted, fontSize: 10.5, marginTop: 4, textAlign: "center", paddingHorizontal: 12, lineHeight: 15 },

  chartValue: { color: Colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  chartSub  : { color: Colors.textMuted, fontSize: 10.5, marginTop: 2, marginBottom: 8 },
  chart    : { height: 140, justifyContent: "flex-end", position: "relative" },
  grid     : { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: Colors.border },
  chartCols: { flexDirection: "row", alignItems: "flex-end", height: 140, gap: 3 },
  colWrap  : { flex: 1, justifyContent: "flex-end" },
  col      : { borderTopLeftRadius: 3, borderTopRightRadius: 3, width: "100%" },
  axis      : { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  axisText  : { color: Colors.textMuted, fontSize: 9.5 },

  footer: { color: Colors.textMuted, fontSize: 10.5, textAlign: "center", marginTop: 16 },
});
