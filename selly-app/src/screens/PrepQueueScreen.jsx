// ── Prep Queue — the kitchen screen ───────────────────────────────────────────
// The screen a cloud kitchen actually lives on during service. Not a management
// view: a working one, meant to be glanced at with flour on your hands.
//
// Three things it does that the Orders list does not:
//   1. An elapsed timer per order, against the promised prep time. Amber at the
//      promise, red past it. A late order is the only thing in a kitchen that
//      matters more than the next one.
//   2. A batch roll-up across every open order — "6 × Butter Naan" — because a
//      kitchen cooks by item, not by order. Reading four order cards to work out
//      how much rice to start is how orders get missed.
//   3. One-tap advance, with the delivery address right there for the rider.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import { typeConfig, STATUS_LABELS, ADVANCE_LABELS, nextStatus } from "../lib/businessTypes";
import { fetchOrders, updateOrderStatus, fetchCatalog,
         fetchCustomerContacts, logMessage } from "../lib/api";
import { subscribeDevOrders } from "../lib/devStore";
import { loadStoreConfig } from "../lib/storeStatus";
import { friendlyError } from "../lib/errors";
import { orderTotal, inr } from "../lib/whatsapp";
import { notifyStatus, channelFor, isReachable, tenDigit } from "../lib/messaging";
import { isDueNow, isScheduled, formatWhen } from "../lib/scheduling";
import SoldOutSheet from "../components/SoldOutSheet";

// Orders the kitchen still has work to do on.
const ACTIVE = ["pending_payment", "confirmed", "preparing", "baking", "ready"];

function minutesSince(ts) {
  return Math.max(0, Math.floor((Date.now() - Number(ts || Date.now())) / 60000));
}

/** Elapsed-time chip. Colour is the whole point — it's the overdue signal. */
function Elapsed({ createdAt, promiseMins }) {
  const mins = minutesSince(createdAt);
  const tone = mins >= promiseMins        ? "late"
             : mins >= promiseMins * 0.7  ? "soon"
             :                              "ok";
  const map = {
    ok  : ["rgba(34,197,94,0.14)",  "#4ade80"],
    soon: ["rgba(245,165,36,0.16)", "#fbbf5c"],
    late: ["rgba(239,68,68,0.16)",  "#f87171"],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.elapsed, { backgroundColor: bg }]}>
      <Ionicons name={tone === "late" ? "alarm" : "time-outline"} size={12} color={fg} />
      <Text style={[styles.elapsedText, { color: fg }]}>
        {mins}m{tone === "late" ? " late" : ""}
      </Text>
    </View>
  );
}

export default function PrepQueueScreen({ navigation }) {
  const { industry } = useAuth();
  const type = typeConfig(industry);
  const { width } = useWindowDimensions();
  const twoCol = width >= 900;

  const [allOrders,  setAllOrders]  = useState([]);
  const [contacts,   setContacts]   = useState([]);
  const [catalog,    setCatalog]    = useState([]);
  const [prepMins,   setPrepMins]   = useState(30);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [notice,     setNotice]     = useState(null);
  const [busyId,     setBusyId]     = useState(null);
  const [soldOutOpen, setSoldOutOpen] = useState(false);
  // Re-render once a minute so the elapsed timers keep counting without a fetch.
  const [, setTick]  = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [o, s, c, k] = await Promise.all([
        fetchOrders({ page: 1, limit: 100 }),
        loadStoreConfig().catch(() => null),
        fetchCustomerContacts().catch(() => []),
        fetchCatalog().catch(() => ({ products: [] })),
      ]);
      setAllOrders((o.orders || []).filter(x => ACTIVE.includes(x.status)));
      setContacts(Array.isArray(c) ? c : []);
      setCatalog(k.products || []);
      if (s?.config?.defaultPrepMinutes) setPrepMins(Number(s.config.defaultPrepMinutes));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return subscribeDevOrders(() => load(true));
  }, [load]));

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  async function advance(order) {
    const next = nextStatus(industry, order.status);
    if (!next || busyId) return;
    setBusyId(order.id);
    // Optimistic: the kitchen taps and moves on, it shouldn't wait on a round trip.
    setAllOrders(prev =>
      ACTIVE.includes(next)
        ? prev.map(o => (o.id === order.id ? { ...o, status: next } : o))
        : prev.filter(o => o.id !== order.id)
    );
    try {
      await updateOrderStatus(order.id, next);
      // Notify after the status lands, never before, and never blocking: the
      // kitchen has to be able to move an order even when the message can't go.
      const res = await notifyStatus(next, {
        order,
        customerName: order.name,
        tableNo     : order.table_no,
        address     : order.address,
        prepMinutes : prepMins,
      }, contacts);
      // "opened", not "sent": their phone opened the chat with the text ready.
      // Whether they pressed send is not something we can know, and saying
      // otherwise would put a false number in front of the kitchen.
      // Record it either way — a message that failed to open is the one the
      // kitchen most needs to find later.
      if (!res.skipped) {
        logMessage({
          orderId: order.id, mobile: res.mobile, channel: res.channel,
          statusKey: next, body: res.text, outcome: res.outcome,
        }).catch(() => {});
      }

      if (res.sent)              setNotice({ ok: true,  text: `${STATUS_LABELS[next]} · ${res.channel === "sms" ? "SMS" : "WhatsApp"} opened for ${res.to}` });
      else if (res.error)        setNotice({ ok: false, text: `${STATUS_LABELS[next]} — but the customer wasn't notified: ${res.error}` });
      else                       setNotice(null);
    } catch (e) {
      setError(friendlyError(e));
      load(true);   // put the truth back
    } finally {
      setBusyId(null);
    }
  }

  // ── What the kitchen is actually holding right now ──────────────────────────
  // A scheduled order is not this screen's problem until it is nearly due.
  // Tomorrow's 7am breakfast sitting in tonight's queue buries the orders that
  // need cooking now — the Scheduled screen holds them until they come due.
  //
  // Derived rather than filtered on load, so the 60-second tick that drives the
  // elapsed timers also brings an order in the moment it falls due. Filtering at
  // load time would leave it invisible until someone pulled to refresh.
  const orders = allOrders.filter(o => isDueNow(o, prepMins));

  // ── Batch roll-up ───────────────────────────────────────────────────────────
  // Every line across every open order, summed by item. This is what the kitchen
  // reads first: how much of each thing to start right now.
  const batch = (() => {
    const byName = new Map();
    orders.forEach(o => {
      (o.cart || []).forEach(i => {
        const key = i.name || "Item";
        byName.set(key, (byName.get(key) || 0) + Number(i.qty || 1));
      });
    });
    return [...byName.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  })();

  const lateCount    = orders.filter(o => minutesSince(o.createdAt) >= prepMins).length;
  const soldOutCount = catalog.filter(p => p.inStock === false).length;

  if (loading && !orders.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.centerText}>Loading the queue…</Text>
      </View>
    );
  }

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
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Kitchen</Text>
          <Text style={styles.hSub}>
            {orders.length} order{orders.length === 1 ? "" : "s"} on the go
            {lateCount > 0 ? ` · ${lateCount} past ${prepMins} min` : ""}
          </Text>
        </View>
        {lateCount > 0 && (
          <View style={styles.lateBadge}>
            <Ionicons name="alarm" size={13} color="#f87171" />
            <Text style={styles.lateBadgeText}>{lateCount} late</Text>
          </View>
        )}
        {/* The 86 list. Reachable in one tap from the screen the kitchen is
            already on — running out is routine, not an exception. */}
        <TouchableOpacity
          style={[styles.soldOutBtn, soldOutCount > 0 && styles.soldOutBtnOn]}
          onPress={() => setSoldOutOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={soldOutCount > 0 ? "eye-off" : "eye-off-outline"}
            size={13}
            color={soldOutCount > 0 ? Colors.red : Colors.textSecondary}
          />
          <Text style={[styles.soldOutBtnText, soldOutCount > 0 && { color: Colors.red }]}>
            {soldOutCount > 0 ? `${soldOutCount} sold out` : "Sold out"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Result of the last status change — did the customer actually get told? */}
      {!!notice && (
        <View style={[styles.notice, notice.ok ? styles.noticeOk : styles.noticeWarn]}>
          <Ionicons
            name={notice.ok ? "checkmark-circle" : "alert-circle-outline"}
            size={15}
            color={notice.ok ? Colors.green : Colors.yellow}
          />
          <Text style={[styles.noticeText, { color: notice.ok ? Colors.green : Colors.yellow }]}>
            {notice.text}
          </Text>
          <TouchableOpacity onPress={() => setNotice(null)}>
            <Ionicons name="close" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {!!error && (
        <View style={styles.errBanner}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.yellow} />
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={styles.errRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="restaurant-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Nothing in the queue</Text>
          <Text style={styles.emptyHint}>
            New orders land here the moment a customer confirms.
          </Text>
        </View>
      ) : (
        <View style={twoCol ? styles.cols : null}>
          {/* Batch roll-up */}
          <View style={[styles.panel, twoCol && styles.colSide]}>
            <Text style={styles.panelTitle}>Start these now</Text>
            <Text style={styles.panelSub}>
              Everything across all {orders.length} open order{orders.length === 1 ? "" : "s"}, by item.
            </Text>
            {batch.map(b => (
              <View key={b.name} style={styles.batchRow}>
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyText}>{b.qty}</Text>
                </View>
                <Text style={styles.batchName} numberOfLines={2}>{b.name}</Text>
              </View>
            ))}
          </View>

          {/* Order cards */}
          <View style={twoCol ? styles.colMain : null}>
            {orders.map(o => {
              const next  = nextStatus(industry, o.status);
              const busy  = busyId === o.id;
              const note  = o.extra?.note;
              return (
                <View key={o.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.orderNo}>#{String(o.id).slice(-5)}</Text>
                    <Elapsed createdAt={o.createdAt} promiseMins={prepMins} />
                    <View style={{ flex: 1 }} />
                    <Text style={styles.amount}>{inr(orderTotal(o))}</Text>
                  </View>

                  <Text style={styles.who}>
                    {o.name || "Guest"}
                    {o.table_no ? ` · Table ${o.table_no}` : ""}
                    {o.channel === "web" ? " · web" : o.channel === "instagram" ? " · Instagram" : ""}
                  </Text>

                  {/* Who an update reaches, shown before you tap rather than
                      discovered afterwards. Advancing the wrong order used to
                      send a message to a customer you weren't looking at. */}
                  {(() => {
                    const ok  = isReachable(o);
                    const ch  = channelFor(o, contacts);
                    return (
                      <View style={styles.reachRow}>
                        <Ionicons
                          name={ok ? (ch ? ch.icon : "chatbox") : "alert-circle-outline"}
                          size={11}
                          color={ok ? Colors.green : Colors.yellow}
                        />
                        <Text style={[styles.reachText, { color: ok ? Colors.green : Colors.yellow }]}>
                          {ok
                            ? `updates → ${o.name || tenDigit(o.mobile)} on ${ch ? ch.label : "WhatsApp"}`
                            : "No mobile number — this customer can't be updated"}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Items — the thing the cook reads */}
                  <View style={styles.itemBox}>
                    {(o.cart || []).map((i, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemQty}>{i.qty || 1}×</Text>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {i.name}{i.size ? ` (${i.size})` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {!!note && (
                    <View style={styles.noteBox}>
                      <Ionicons name="chatbubble-ellipses-outline" size={13} color={Colors.yellow} />
                      <Text style={styles.noteText}>{note}</Text>
                    </View>
                  )}

                  {!!o.address && (
                    <View style={styles.addrBox}>
                      <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                      <Text style={styles.addrText}>{o.address}</Text>
                    </View>
                  )}

                  <View style={styles.cardFoot}>
                    <View style={[styles.statusChip, { backgroundColor: (Colors.status[o.status] || {}).bg || Colors.bgElevated }]}>
                      <Text style={[styles.statusChipText, { color: (Colors.status[o.status] || {}).text || Colors.textSecondary }]}>
                        {STATUS_LABELS[o.status] || o.status}
                      </Text>
                    </View>
                    {next && (
                      <TouchableOpacity
                        style={[styles.advBtn, busy && { opacity: 0.6 }]}
                        onPress={() => advance(o)}
                        disabled={busy}
                        activeOpacity={0.85}
                      >
                        {busy
                          ? <ActivityIndicator color="#fff" size="small" />
                          : (
                            <Text style={styles.advBtnText}>
                              {ADVANCE_LABELS[next] || STATUS_LABELS[next] || next} →
                            </Text>
                          )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate("Orders")}>
        <Text style={styles.linkText}>See every order, including finished →</Text>
      </TouchableOpacity>

      <SoldOutSheet
        visible={soldOutOpen}
        onClose={() => setSoldOutOpen(false)}
        products={catalog}
        onChanged={() => load(true)}
      />
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
  lateBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(239,68,68,0.14)", borderWidth: 1, borderColor: "rgba(239,68,68,0.32)",
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5,
  },
  lateBadgeText: { color: "#f87171", fontSize: 12, fontWeight: "800" },

  soldOutBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 8,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5,
  },
  soldOutBtnOn  : { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.32)" },
  soldOutBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700" },

  notice    : { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 12 },
  noticeOk  : { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.28)" },
  noticeWarn: { backgroundColor: "rgba(245,165,36,0.08)", borderColor: "rgba(245,165,36,0.3)" },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17 },

  errBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.yellow, borderRadius: 10, padding: 10, marginBottom: 12 },
  errText  : { flex: 1, color: Colors.textSecondary, fontSize: 12 },
  errRetry : { color: Colors.primaryLight, fontSize: 12, fontWeight: "700" },

  cols   : { flexDirection: "row", gap: 13, alignItems: "flex-start" },
  colSide: { width: 260 },
  colMain: { flex: 1 },

  panel     : { backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 13 },
  panelTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800" },
  panelSub  : { color: Colors.textMuted, fontSize: 11.5, marginTop: 3, marginBottom: 11, lineHeight: 16 },

  batchRow : { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 7, borderTopWidth: 1, borderTopColor: Colors.border },
  qtyBox   : { minWidth: 34, backgroundColor: Colors.primary + "22", borderRadius: 8, paddingVertical: 4, alignItems: "center" },
  qtyText  : { color: Colors.primaryLight, fontSize: 15, fontWeight: "800" },
  batchName: { flex: 1, color: Colors.textPrimary, fontSize: 13.5, fontWeight: "600" },

  card    : { backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 13, marginBottom: 11 },
  cardTop : { flexDirection: "row", alignItems: "center", gap: 9 },
  orderNo : { color: Colors.textPrimary, fontSize: 14.5, fontWeight: "800" },
  amount  : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800" },
  who     : { color: Colors.textSecondary, fontSize: 12, marginTop: 5 },
  reachRow : { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  reachText: { fontSize: 11, fontWeight: "600" },

  elapsed    : { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 3 },
  elapsedText: { fontSize: 11.5, fontWeight: "800" },

  itemBox : { marginTop: 10, backgroundColor: Colors.bg, borderRadius: 10, padding: 10, gap: 6 },
  itemRow : { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  itemQty : { color: Colors.primaryLight, fontSize: 14, fontWeight: "800", minWidth: 26 },
  itemName: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: "600", lineHeight: 19 },

  noteBox : { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 9, backgroundColor: "rgba(245,165,36,0.09)", borderRadius: 9, padding: 9 },
  noteText: { flex: 1, color: Colors.yellow, fontSize: 12, lineHeight: 17 },

  addrBox : { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 9 },
  addrText: { flex: 1, color: Colors.textSecondary, fontSize: 11.5, lineHeight: 16 },

  cardFoot  : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10 },
  statusChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontSize: 11.5, fontWeight: "800" },
  advBtn    : { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 9, minWidth: 132, alignItems: "center" },
  advBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },

  empty    : { alignItems: "center", paddingVertical: 54 },
  emptyText: { color: Colors.textSecondary, fontSize: 14.5, fontWeight: "600", marginTop: 12 },
  emptyHint: { color: Colors.textMuted, fontSize: 12, marginTop: 5, textAlign: "center", maxWidth: 260, lineHeight: 17 },

  linkRow : { alignItems: "center", paddingVertical: 14 },
  linkText: { color: Colors.primaryLight, fontSize: 12.5, fontWeight: "600" },
});
