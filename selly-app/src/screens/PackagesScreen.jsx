// ── Members — the customer package book ───────────────────────────────────────
// The second revenue line, and the one a kitchen has never had before: customers
// paying the kitchen a monthly fee, in exchange for being able to choose when
// their food arrives.
//
// NOT the Billing screen. Billing is what this kitchen pays Selly. This is what
// this kitchen's customers pay the kitchen. Same word, opposite direction —
// which is exactly why they are two screens and not one.
//
// What a kitchen needs from it, in order:
//   1. What is this worth a month? (the number at the top)
//   2. Who is about to lapse? (because a renewal saved is cheaper than a member won)
//   3. Everyone else.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { fetchCustomerPackages, saveCustomerPackage, cancelCustomerPackage } from "../lib/api";
import { loadStoreConfig } from "../lib/storeStatus";
import { friendlyError } from "../lib/errors";
import { inr } from "../lib/whatsapp";
import {
  isPackageActive, packageDaysLeft, packageEndsAt, renewPackage, scheduleConfig,
} from "../lib/scheduling";

const LAPSING_SOON_DAYS = 5;

function StatusPill({ pkg }) {
  const live = isPackageActive(pkg);
  const left = packageDaysLeft(pkg);

  // A row can read 'active' long after it lapsed if no expiry pass has run, so
  // the pill trusts the date rather than the column.
  if (!live) {
    const label = pkg.status === "cancelled" ? "Cancelled" : "Lapsed";
    return (
      <View style={[styles.pill, styles.pillDead]}>
        <Text style={styles.pillDeadText}>{label}</Text>
      </View>
    );
  }
  if (pkg.status === "trial") {
    return (
      <View style={[styles.pill, styles.pillTrial]}>
        <Text style={styles.pillTrialText}>Trial · {left}d</Text>
      </View>
    );
  }
  const soon = left != null && left <= LAPSING_SOON_DAYS;
  return (
    <View style={[styles.pill, soon ? styles.pillWarn : styles.pillLive]}>
      <Text style={soon ? styles.pillWarnText : styles.pillLiveText}>
        {soon ? `Renews in ${left}d` : "Active"}
      </Text>
    </View>
  );
}

export default function PackagesScreen() {
  const [packages, setPackages] = useState([]);
  const [config,   setConfig]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,    setError]    = useState(null);
  const [busyId,   setBusyId]   = useState(null);
  const [notice,   setNotice]   = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [rows, store] = await Promise.all([
        fetchCustomerPackages(),
        loadStoreConfig().catch(() => null),
      ]);
      setPackages(Array.isArray(rows) ? rows : []);
      setConfig(scheduleConfig({ schedule_config: (store && store.config && store.config.schedule) }));
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

  async function renew(pkg) {
    if (busyId) return;
    setBusyId(pkg.id);
    try {
      await saveCustomerPackage(renewPackage(pkg));
      setNotice({ ok: true, text: `${pkg.name || pkg.mobile} renewed for a month` });
      load(true);
    } catch (e) {
      setNotice({ ok: false, text: friendlyError(e) });
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(pkg) {
    if (busyId) return;
    setBusyId(pkg.id);
    try {
      await cancelCustomerPackage(pkg.mobile);
      setNotice({ ok: true, text: `${pkg.name || pkg.mobile} cancelled` });
      load(true);
    } catch (e) {
      setNotice({ ok: false, text: friendlyError(e) });
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !packages.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.centerText}>Loading members…</Text>
      </View>
    );
  }

  const live    = packages.filter(p => isPackageActive(p));
  const paying  = live.filter(p => p.status === "active");
  const trials  = live.filter(p => p.status === "trial");
  const lapsed  = packages.filter(p => !isPackageActive(p));
  const monthly = paying.reduce((s, p) => s + Number(p.price_month || 0), 0);

  // Trials that are nearly up are the highest-value thing on this screen: a
  // conversation now converts them, silence loses them.
  const closing = trials
    .filter(p => (packageDaysLeft(p) ?? 99) <= LAPSING_SOON_DAYS)
    .concat(paying.filter(p => (packageDaysLeft(p) ?? 99) <= LAPSING_SOON_DAYS))
    .sort((a, b) => (packageDaysLeft(a) ?? 99) - (packageDaysLeft(b) ?? 99));

  const priced = config && config.packagePrice != null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <View style={styles.head}>
        <Text style={styles.hTitle}>Members</Text>
        <Text style={styles.hSub}>Customers paying you monthly to choose their delivery time</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {notice && (
        <View style={[styles.noticeBox, !notice.ok && styles.noticeBad]}>
          <Ionicons
            name={notice.ok ? "checkmark-circle" : "alert-circle"}
            size={15}
            color={notice.ok ? Colors.green : Colors.yellow}
          />
          <Text style={styles.noticeText}>{notice.text}</Text>
          <TouchableOpacity onPress={() => setNotice(null)}>
            <Ionicons name="close" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── the number ── */}
      <View style={styles.mrrCard}>
        <Text style={styles.mrrLabel}>RECURRING, EVERY MONTH</Text>
        <Text style={styles.mrrValue}>{inr(monthly)}</Text>
        <Text style={styles.mrrSub}>
          {paying.length} paying · {trials.length} on trial
          {trials.length > 0 && config && config.packagePrice
            ? ` · ${inr(trials.length * config.packagePrice)} more if they all convert`
            : ""}
        </Text>
      </View>

      {!priced && (
        <View style={styles.setupBox}>
          <Ionicons name="pricetag-outline" size={15} color={Colors.yellow} />
          <Text style={styles.setupText}>
            No price set for new members yet — anyone signing up from here on joins
            for free. Existing members keep whatever they already pay.
            Set it in Settings → Scheduling.
          </Text>
        </View>
      )}

      {/* ── needs attention ── */}
      {closing.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>NEEDS A NUDGE</Text>
          {closing.map(p => (
            <View key={p.id} style={[styles.row, styles.rowWarn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{p.name || "Guest"}</Text>
                <Text style={styles.rowMeta}>
                  +91 {p.mobile} · {p.orders_used || 0} orders scheduled
                </Text>
                <Text style={styles.rowWarnText}>
                  {p.status === "trial"
                    ? `Trial ends in ${packageDaysLeft(p)} days — worth a message`
                    : `Renews in ${packageDaysLeft(p)} days`}
                </Text>
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() => Linking.openURL(
                    `https://wa.me/91${p.mobile}?text=${encodeURIComponent(
                      `Hi ${p.name || "there"}! Your scheduling plan is about to end. Want me to keep it running?`
                    )}`
                  )}
                >
                  <Ionicons name="logo-whatsapp" size={13} color={Colors.green} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.renewBtn}
                  disabled={busyId === p.id}
                  onPress={() => renew(p)}
                >
                  <Text style={styles.renewText}>{busyId === p.id ? "…" : "Renew"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── everyone live ── */}
      <Text style={styles.sectionLabel}>ACTIVE MEMBERS · {live.length}</Text>
      {live.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={34} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No members yet</Text>
          <Text style={styles.emptyBody}>
            A customer becomes a member the first time they choose a delivery time
            instead of ordering for now. Turn scheduling on in Settings to offer it.
          </Text>
        </View>
      )}
      {live.map(p => (
        <View key={p.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <View style={styles.rowNameLine}>
              <Text style={styles.rowName}>{p.name || "Guest"}</Text>
              <StatusPill pkg={p} />
            </View>
            <Text style={styles.rowMeta}>
              +91 {p.mobile} · {p.orders_used || 0} scheduled orders
              {packageEndsAt(p) ? ` · until ${packageEndsAt(p).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
            </Text>
          </View>
          <View style={styles.rowActions}>
            <Text style={styles.rowPrice}>{p.price_month ? inr(p.price_month) : "—"}</Text>
            <TouchableOpacity
              style={styles.cancelBtn}
              disabled={busyId === p.id}
              onPress={() => cancel(p)}
            >
              <Ionicons name="close" size={13} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* ── the ones who left ── */}
      {lapsed.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>LAPSED · {lapsed.length}</Text>
          {lapsed.map(p => (
            <View key={p.id} style={[styles.row, styles.rowDim]}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowNameLine}>
                  <Text style={[styles.rowName, styles.dimText]}>{p.name || "Guest"}</Text>
                  <StatusPill pkg={p} />
                </View>
                <Text style={styles.rowMeta}>
                  +91 {p.mobile} · {p.orders_used || 0} orders while they had it
                </Text>
              </View>
              <TouchableOpacity
                style={styles.renewBtn}
                disabled={busyId === p.id}
                onPress={() => renew(p)}
              >
                <Text style={styles.renewText}>{busyId === p.id ? "…" : "Restore"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <Text style={styles.footNote}>
        This is what your customers pay you. What you pay Selly is on the Billing screen.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 14, paddingBottom: 40 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  centerText: { color: Colors.textMuted, fontSize: 13, marginTop: 12 },

  head  : { marginBottom: 14 },
  hTitle: { color: Colors.textPrimary, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  hSub  : { color: Colors.textMuted, fontSize: 12, marginTop: 3 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
    borderRadius: 11, padding: 12, marginBottom: 12,
  },
  errorText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },

  noticeBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(34,197,94,0.10)", borderWidth: 1, borderColor: "rgba(34,197,94,0.28)",
    borderRadius: 11, padding: 12, marginBottom: 12,
  },
  noticeBad : { backgroundColor: "rgba(245,165,36,0.10)", borderColor: "rgba(245,165,36,0.28)" },
  noticeText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },

  mrrCard : {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: "rgba(124,92,255,0.32)",
    borderRadius: 15, padding: 16, marginBottom: 12,
  },
  mrrLabel: { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.9 },
  mrrValue: { color: Colors.textPrimary, fontSize: 32, fontWeight: "800", letterSpacing: -0.8, marginTop: 6 },
  mrrSub  : { color: Colors.textSecondary, fontSize: 12, marginTop: 5 },

  setupBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    backgroundColor: "rgba(245,165,36,0.09)", borderWidth: 1, borderColor: "rgba(245,165,36,0.26)",
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  setupText: { color: Colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 18 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 9.5, fontWeight: "800",
    letterSpacing: 0.9, marginTop: 16, marginBottom: 9,
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 13, padding: 13, marginBottom: 9,
  },
  rowWarn    : { borderColor: "rgba(245,165,36,0.30)" },
  rowDim     : { opacity: 0.62 },
  dimText    : { color: Colors.textSecondary },
  rowNameLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  rowName    : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  rowMeta    : { color: Colors.textMuted, fontSize: 11.5, marginTop: 4 },
  rowWarnText: { color: Colors.yellow, fontSize: 11.5, fontWeight: "600", marginTop: 4 },
  rowActions : { flexDirection: "row", alignItems: "center", gap: 8 },
  rowPrice   : { color: Colors.textSecondary, fontSize: 13, fontWeight: "700" },

  waBtn: {
    width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.13)", borderWidth: 1, borderColor: "rgba(34,197,94,0.28)",
  },
  renewBtn: {
    backgroundColor: Colors.primary, borderRadius: 9,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  renewText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  cancelBtn: {
    width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
  },

  pill        : { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2.5 },
  pillLive    : { backgroundColor: "rgba(34,197,94,0.14)" },
  pillLiveText: { color: Colors.green, fontSize: 9.5, fontWeight: "800" },
  pillTrial   : { backgroundColor: "rgba(59,130,246,0.15)" },
  pillTrialText: { color: "#7cb0ff", fontSize: 9.5, fontWeight: "800" },
  pillWarn    : { backgroundColor: "rgba(245,165,36,0.15)" },
  pillWarnText: { color: Colors.yellow, fontSize: 9.5, fontWeight: "800" },
  pillDead    : { backgroundColor: Colors.bgElevated },
  pillDeadText: { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800" },

  empty     : { alignItems: "center", paddingVertical: 40, paddingHorizontal: 26 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", marginTop: 12 },
  emptyBody : { color: Colors.textMuted, fontSize: 12.5, textAlign: "center", marginTop: 8, lineHeight: 19 },

  footNote: {
    color: Colors.textMuted, fontSize: 11.5, lineHeight: 18,
    textAlign: "center", marginTop: 22, paddingHorizontal: 18,
  },
});
