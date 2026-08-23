// ── Scheduled — the kitchen's forward view ────────────────────────────────────
// The Prep Queue answers "what do I cook now". This answers "what is coming",
// which is a different job and a different screen.
//
// Why it earns its place: a scheduled order is only worth taking early if the
// kitchen can act on knowing early. At 8pm this screen already says tomorrow's
// 7am breakfast is 5 idli and 3 poha across three addresses — so the batter gets
// made tonight and nobody is improvising at 6:30am.
//
// So it groups the way a kitchen plans: day → slot → batch. Individual orders
// are underneath, because nobody cooks one order at a time for a morning rush.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { fetchOrders, fetchCustomerPackages } from "../lib/api";
import { subscribeDevOrders } from "../lib/devStore";
import { loadStoreConfig } from "../lib/storeStatus";
import { friendlyError } from "../lib/errors";
import { inr } from "../lib/whatsapp";
import {
  groupByDay, scheduledAt, minutesUntilStart, isDueNow,
  timeLabel, scheduleConfig, isPackageActive,
} from "../lib/scheduling";

// Orders that no longer need planning for — already cooked or gone.
// Named FINISHED, not SETTLED: "settled" now means paid, and these are two
// different questions since payment stopped being inferred from delivery.
const FINISHED = ["delivered", "paid", "cancelled", "rejected"];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** How close this order is to needing the kitchen's attention. */
function Countdown({ order, prepMins }) {
  const mins = minutesUntilStart(order, prepMins);
  const due  = isDueNow(order, prepMins);

  if (due) {
    return (
      <View style={[styles.chip, styles.chipDue]}>
        <Ionicons name="flame" size={11} color="#f87171" />
        <Text style={styles.chipDueText}>Start now</Text>
      </View>
    );
  }
  const hrs   = Math.floor(mins / 60);
  const label = hrs >= 1 ? `starts in ${hrs}h ${mins % 60}m` : `starts in ${mins}m`;
  const soon  = mins <= 90;

  return (
    <View style={[styles.chip, soon && styles.chipSoon]}>
      <Ionicons name="time-outline" size={11} color={soon ? Colors.yellow : Colors.textMuted} />
      <Text style={[styles.chipText, soon && styles.chipSoonText]}>{label}</Text>
    </View>
  );
}

export default function ScheduledScreen({ navigation }) {
  const [days,     setDays]     = useState([]);
  const [packages, setPackages] = useState([]);
  const [config,   setConfig]   = useState(null);
  const [prepMins, setPrepMins] = useState(25);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,    setError]    = useState(null);
  const [openDay,  setOpenDay]  = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ordersRes, pkgs, store] = await Promise.all([
        fetchOrders({ limit: 200 }),
        fetchCustomerPackages().catch(() => []),   // migration may not be run yet
        loadStoreConfig().catch(() => null),
      ]);

      // loadStoreConfig returns { config, settings } — the scheduling rules and
      // the prep time both live one level down, on .config.
      const sc  = (store && store.config) || {};
      const cfg = scheduleConfig({ schedule_config: sc.schedule });
      setConfig(cfg);
      setPrepMins(Number(sc.defaultPrepMinutes) || 30);
      setPackages(Array.isArray(pkgs) ? pkgs : []);

      const open = (ordersRes.orders || []).filter(o => !FINISHED.includes(o.status));
      setDays(groupByDay(open, cfg));
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // The guest ordering page writes straight into the dev store, so a scheduled
  // order placed there should appear here without a manual refresh.
  useEffect(() => subscribeDevOrders(() => load(true)), [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const packageFor = (mobile) => {
    const key = String(mobile || "").replace(/\D/g, "").slice(-10);
    return packages.find(p => String(p.mobile || "").replace(/\D/g, "").slice(-10) === key) || null;
  };

  if (loading && !days.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.centerText}>Loading what's coming…</Text>
      </View>
    );
  }

  const totalOrders = days.reduce((s, d) => s + d.count, 0);
  const totalValue  = days.reduce((s, d) => s + d.total, 0);
  const dueSoon     = days
    .flatMap(d => d.slots.flatMap(s => s.orders))
    .filter(o => isDueNow(o, prepMins)).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* ── header ── */}
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Scheduled</Text>
          <Text style={styles.hSub}>
            {totalOrders === 0
              ? "Nothing booked ahead yet"
              : `${plural(totalOrders, "order")} booked ahead · ${inr(totalValue)} already committed`}
          </Text>
        </View>
        {dueSoon > 0 && (
          <View style={styles.dueBadge}>
            <Ionicons name="flame" size={13} color="#f87171" />
            <Text style={styles.dueBadgeText}>{dueSoon} to start</Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!days.length && !error && (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={38} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No orders booked ahead</Text>
          <Text style={styles.emptyBody}>
            When a customer picks a delivery time instead of ordering for now, it lands
            here — grouped by meal, so you can shop and prep for it in one go.
          </Text>
        </View>
      )}

      {/* ── day by day ── */}
      {days.map((day, di) => {
        const isOpen = openDay === di;
        return (
          <View key={day.label} style={styles.dayBlock}>
            <TouchableOpacity
              style={styles.dayHead}
              activeOpacity={0.7}
              onPress={() => setOpenDay(isOpen ? -1 : di)}
            >
              <Text style={styles.dayLabel}>{day.label}</Text>
              <View style={styles.dayMeta}>
                <Text style={styles.dayCount}>{plural(day.count, "order")}</Text>
                <Text style={styles.dayTotal}>{inr(day.total)}</Text>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={Colors.textMuted}
                />
              </View>
            </TouchableOpacity>

            {isOpen && day.slots.map((slot) => (
              <View key={slot.key} style={styles.slotCard}>
                {/* slot header */}
                <View style={styles.slotHead}>
                  <Text style={styles.slotEmoji}>{slot.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotLabel}>{slot.label}</Text>
                    {!!slot.from && (
                      <Text style={styles.slotWindow}>{slot.from} – {slot.to}</Text>
                    )}
                  </View>
                  <Text style={styles.slotCount}>{plural(slot.count, "order")}</Text>
                </View>

                {/* the batch — the reason this screen exists */}
                <View style={styles.batch}>
                  <Text style={styles.batchLabel}>COOK IN ONE GO</Text>
                  <View style={styles.batchRow}>
                    {slot.items.map((it) => (
                      <View key={it.name} style={styles.batchChip}>
                        <Text style={styles.batchQty}>{it.qty}×</Text>
                        <Text style={styles.batchName}>{it.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* the orders inside it */}
                {slot.orders.map((o) => {
                  const pkg    = packageFor(o.mobile);
                  const member = isPackageActive(pkg);
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={styles.orderRow}
                      activeOpacity={0.7}
                      onPress={() => navigation?.navigate?.("Orders", { focusOrder: o.id })}
                    >
                      <View style={styles.orderTime}>
                        <Text style={styles.orderTimeText}>{timeLabel(scheduledAt(o))}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.orderNameRow}>
                          <Text style={styles.orderName} numberOfLines={1}>{o.name}</Text>
                          {member && (
                            <View style={styles.memberTag}>
                              <Ionicons name="star" size={8} color={Colors.yellow} />
                              <Text style={styles.memberTagText}>Member</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.orderItems} numberOfLines={1}>
                          {(o.cart || []).map(l => `${l.qty}× ${l.name}`).join(", ")}
                        </Text>
                        {!!o.address && (
                          <Text style={styles.orderAddr} numberOfLines={1}>📍 {o.address}</Text>
                        )}
                        {!!(o.extra && o.extra.note) && (
                          <Text style={styles.orderNote} numberOfLines={1}>“{o.extra.note}”</Text>
                        )}
                      </View>
                      <View style={styles.orderRight}>
                        <Text style={styles.orderAmt}>{inr((o.bill && o.bill.total) || 0)}</Text>
                        <Countdown order={o} prepMins={prepMins} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        );
      })}

      {!!days.length && (
        <Text style={styles.footNote}>
          Orders move into the Prep Queue on their own, {prepMins + 10} minutes before
          they're due. Nothing here needs watching until then.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 14, paddingBottom: 40 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  centerText: { color: Colors.textMuted, fontSize: 13, marginTop: 12 },

  head  : { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  hTitle: { color: Colors.textPrimary, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  hSub  : { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  dueBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(239,68,68,0.14)", borderWidth: 1, borderColor: "rgba(239,68,68,0.32)",
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5,
  },
  dueBadgeText: { color: "#f87171", fontSize: 12, fontWeight: "800" },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
    borderRadius: 11, padding: 12, marginBottom: 12,
  },
  errorText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },

  empty     : { alignItems: "center", paddingVertical: 56, paddingHorizontal: 26 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "700", marginTop: 14 },
  emptyBody : { color: Colors.textMuted, fontSize: 12.5, textAlign: "center", marginTop: 8, lineHeight: 19 },

  dayBlock: { marginBottom: 16 },
  dayHead : {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 9, paddingHorizontal: 2, marginBottom: 8,
  },
  dayLabel: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "800", flex: 1 },
  dayMeta : { flexDirection: "row", alignItems: "center", gap: 10 },
  dayCount: { color: Colors.textMuted, fontSize: 12 },
  dayTotal: { color: Colors.textSecondary, fontSize: 12.5, fontWeight: "700" },

  slotCard: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 15, padding: 13, marginBottom: 11,
  },
  slotHead  : { flexDirection: "row", alignItems: "center", gap: 10 },
  slotEmoji : { fontSize: 20 },
  slotLabel : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  slotWindow: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  slotCount : { color: Colors.textSecondary, fontSize: 12, fontWeight: "700" },

  batch     : { backgroundColor: Colors.bg, borderRadius: 11, padding: 11, marginTop: 11 },
  batchLabel: { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.9, marginBottom: 8 },
  batchRow  : { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  batchChip : {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primarySoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
  },
  batchQty : { color: Colors.primaryLight, fontSize: 12.5, fontWeight: "800" },
  batchName: { color: Colors.textPrimary, fontSize: 12.5 },

  orderRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 11, marginTop: 11,
  },
  orderTime    : {
    backgroundColor: Colors.bgElevated, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5, minWidth: 66, alignItems: "center",
  },
  orderTimeText: { color: Colors.textSecondary, fontSize: 11.5, fontWeight: "800" },
  orderNameRow : { flexDirection: "row", alignItems: "center", gap: 6 },
  orderName    : { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "700", flexShrink: 1 },
  memberTag    : {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(245,165,36,0.14)", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
  },
  memberTagText: { color: Colors.yellow, fontSize: 8.5, fontWeight: "800", letterSpacing: 0.3 },
  orderItems   : { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  orderAddr    : { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  orderNote    : { color: Colors.textMuted, fontSize: 11, fontStyle: "italic", marginTop: 3 },
  orderRight   : { alignItems: "flex-end", gap: 6 },
  orderAmt     : { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "800" },

  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.bgElevated, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  chipText    : { color: Colors.textMuted, fontSize: 10 },
  chipSoon    : { backgroundColor: "rgba(245,165,36,0.13)" },
  chipSoonText: { color: Colors.yellow, fontWeight: "700" },
  chipDue     : { backgroundColor: "rgba(239,68,68,0.14)" },
  chipDueText : { color: "#f87171", fontSize: 10, fontWeight: "800" },

  footNote: {
    color: Colors.textMuted, fontSize: 11.5, lineHeight: 18,
    textAlign: "center", marginTop: 6, paddingHorizontal: 18,
  },
});
