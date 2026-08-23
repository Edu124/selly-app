// ── Delivery — packet numbers and the riders who carry them ───────────────────
//
// THE THING THIS SCREEN IS BUILT AROUND
//   The packet gets a number and nothing else. No name, no address, no phone
//   printed on anything. A packet left on a counter tells a stranger nothing,
//   and the rider only sees where it goes after typing the number in.
//
//   That is also the security model, not just a privacy nicety: the number IS
//   the permission. A partner link on its own lists nothing and browses nothing.
//
// OTP
//   Issued to everyone except monthly members. Someone taking the same tiffin
//   every morning does not want to recite four digits at 7am, and they are the
//   customers there is least doubt about. That rule lives in SQL so it cannot
//   drift between here and the rider's screen.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, Alert, Share, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Colors } from "../constants/colors";
import {
  fetchOrders, fetchDeliveryPartners, addDeliveryPartner,
  setPartnerActive, assignDeliveryToken,
} from "../lib/api";
import { subscribeDevOrders } from "../lib/devStore";
import { friendlyError } from "../lib/errors";
import { inr } from "../lib/whatsapp";
import { ratingBase } from "../lib/messaging";
import { sequenceDrops, headline, mapsLink } from "../lib/dispatch";

// Orders cooked and waiting to go out, or already with a rider.
const HANDOVER = ["ready", "preparing", "confirmed"];
const ON_ROAD  = ["out_for_delivery"];

export default function DeliveryScreen() {
  const [orders,   setOrders]   = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,    setError]    = useState(null);
  const [busyId,   setBusyId]   = useState(null);
  const [adding,   setAdding]   = useState(false);
  const [pName,    setPName]    = useState("");
  const [pPhone,   setPPhone]   = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [o, p] = await Promise.all([
        fetchOrders({ page: 1, limit: 100 }),
        fetchDeliveryPartners().catch(() => []),
      ]);
      setOrders(o.orders || []);
      setPartners(Array.isArray(p) ? p : []);
      setError(null);
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

  const driverLink = (p) => `${ratingBase()}/driver.html?c=${p.access_code}`;

  async function shareLink(p) {
    const url = driverLink(p);
    try {
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(url);
        Alert.alert("Link copied", `Send this to ${p.name}. Their riders all use the same link.`);
      } else {
        await Share.share({ message: `Selly deliveries — ${p.name}\n${url}` });
      }
    } catch (e) {
      Alert.alert("Couldn't share", friendlyError(e));
    }
  }

  async function handOver(order) {
    if (busyId) return;
    setBusyId(order.id);
    try {
      const res = await assignDeliveryToken(order.id);
      await load(true);
      Alert.alert(
        `Packet ${res.token}`,
        res.otp
          ? `Write ${res.token} on the sticker.\n\nThe customer's code is ${res.otp} — the rider will ask for it at the door.`
          : `Write ${res.token} on the sticker.\n\nNo code needed — this customer is on a monthly plan.`
      );
    } catch (e) {
      Alert.alert("Couldn't assign a number", friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function addPartner() {
    if (!pName.trim()) return Alert.alert("Name", "Give the partner a name.");
    try {
      await addDeliveryPartner({ name: pName.trim(), phone: pPhone.replace(/\D/g, "") });
      setPName(""); setPPhone(""); setAdding(false);
      load(true);
    } catch (e) {
      Alert.alert("Couldn't add", friendlyError(e));
    }
  }

  if (loading && !orders.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const waiting = orders.filter(o => HANDOVER.includes(o.status) && !o.token);
  const packed  = orders.filter(o => o.token && !o.delivered_at && !ON_ROAD.includes(o.status));
  const onRoad  = orders.filter(o => ON_ROAD.includes(o.status));

  // The two-orders-from-one-kitchen question, answered.
  //
  // Only orders that actually carry a token: without one there is no sticker,
  // so a rider has no way to look it up and numbering it in a run would be
  // telling them to deliver something they cannot identify. Legacy orders that
  // went out before tokens existed fall in here, which is exactly right.
  const run = sequenceDrops([...packed, ...onRoad].filter(o => !!o.token));
  const untracked = onRoad.filter(o => !o.token);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={Colors.primary} />}
    >
      <Text style={styles.pageTitle}>Delivery</Text>
      <Text style={styles.pageSub}>
        Put only the number on the packet. Names and addresses stay in the app.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ── the run advice ── */}
      {run.length > 1 && (
        <View style={styles.adviceCard}>
          <Text style={styles.adviceIcon}>🧭</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.adviceText}>{headline(run)}</Text>
            <Text style={styles.adviceWhy}>
              Ordered by how close each one is to being late, then by whether two
              addresses share an area.
            </Text>
          </View>
        </View>
      )}

      {/* ── ready to pack ── */}
      <Text style={styles.sectionLabel}>READY TO HAND OVER · {waiting.length}</Text>
      {waiting.length === 0 && (
        <Text style={styles.emptyLine}>Nothing waiting. Orders appear here once they're cooking.</Text>
      )}
      {waiting.map(o => (
        <View key={o.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{o.name || "Guest"}</Text>
            <Text style={styles.addr} numberOfLines={2}>📍 {o.address}</Text>
            <Text style={styles.items} numberOfLines={1}>
              {(o.cart || []).map(l => `${l.qty}× ${l.name}`).join(", ")}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.packBtn, busyId === o.id && styles.btnOff]}
            disabled={busyId === o.id}
            onPress={() => handOver(o)}
          >
            <Text style={styles.packText}>{busyId === o.id ? "…" : "Give a number"}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* ── numbered, in sequence ── */}
      {run.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>OUT OR WAITING FOR A RIDER · {run.length}</Text>
          {run.map(d => {
            const o = d.order;
            return (
              <View key={o.id} style={[styles.card, styles.tokenCard, d.late && styles.lateCard]}>
                <View style={styles.tokenBadge}>
                  <Text style={styles.tokenNum}>{o.token}</Text>
                  <Text style={styles.tokenSeq}>#{d.seq}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{o.name || "Guest"}</Text>
                  <Text style={[styles.why, d.late && styles.whyLate]}>{d.reason}</Text>
                  <Text style={styles.addr} numberOfLines={2}>📍 {o.address}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>{inr((o.bill && o.bill.total) || 0)}</Text>
                    <Text style={styles.meta}>
                      {o.delivery_otp ? `code ${o.delivery_otp}` : "no code · member"}
                    </Text>
                    {o.status === "out_for_delivery" && (
                      <Text style={[styles.meta, { color: Colors.green }]}>with rider</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Went out before tokens existed, so no rider can look them up. Shown
          rather than hidden — an order in limbo is worse than an ugly row. */}
      {untracked.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>OUT WITHOUT A NUMBER · {untracked.length}</Text>
          {untracked.map(o => (
            <View key={o.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{o.name || "Guest"}</Text>
                <Text style={styles.addr} numberOfLines={1}>📍 {o.address}</Text>
                <Text style={styles.meta}>No packet number — track this one yourself.</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* ── partners ── */}
      <Text style={styles.sectionLabel}>DELIVERY PARTNERS · {partners.length}</Text>
      {partners.map(p => (
        <View key={p.id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.meta}>
              {p.phone ? `+91 ${p.phone} · ` : ""}
              {p.last_used_at ? "used recently" : "not used yet"}
              {p.active ? "" : " · paused"}
            </Text>
          </View>
          <TouchableOpacity style={styles.linkBtn} onPress={() => shareLink(p)}>
            <Ionicons name="link" size={13} color={Colors.primaryLight} />
            <Text style={styles.linkText}>Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pauseBtn}
            onPress={() => setPartnerActive(p.id, !p.active).then(() => load(true))}
          >
            <Ionicons name={p.active ? "pause" : "play"} size={13} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      ))}

      {adding ? (
        <View style={styles.addCard}>
          <TextInput
            style={styles.input} value={pName} onChangeText={setPName}
            placeholder="Partner name, e.g. Baner Riders" placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={[styles.input, { marginTop: 9 }]} value={pPhone} onChangeText={setPPhone}
            placeholder="Contact number (optional)" placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad" maxLength={10}
          />
          <View style={styles.addBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAdding(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={addPartner}>
              <Text style={styles.saveText}>Add partner</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
          <Ionicons name="add-circle-outline" size={17} color={Colors.primaryLight} />
          <Text style={styles.addText}>Add a delivery partner</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.footNote}>
        One link per partner, shared by all their riders. A rider still needs the
        number off the packet before they can see anything — the link alone shows
        nothing.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, paddingBottom: 40 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  pageTitle : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900" },
  pageSub   : { color: Colors.textMuted, fontSize: 12.5, marginTop: 4, lineHeight: 18 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
    borderRadius: 11, padding: 12, marginTop: 14,
  },
  errorText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },

  adviceCard: {
    flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 16,
    backgroundColor: "rgba(124,92,255,0.10)", borderWidth: 1, borderColor: "rgba(124,92,255,0.30)",
    borderRadius: 14, padding: 14,
  },
  adviceIcon: { fontSize: 18 },
  adviceText: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "700", lineHeight: 19 },
  adviceWhy : { color: Colors.textMuted, fontSize: 11.5, marginTop: 5, lineHeight: 17 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 9.5, fontWeight: "800",
    letterSpacing: 0.9, marginTop: 22, marginBottom: 9,
  },
  emptyLine: { color: Colors.textMuted, fontSize: 12.5, paddingVertical: 6 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 11,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 13, marginBottom: 9,
  },
  tokenCard : { alignItems: "flex-start" },
  lateCard  : { borderColor: "rgba(239,68,68,0.36)" },
  tokenBadge: {
    width: 52, alignItems: "center", backgroundColor: Colors.bg,
    borderRadius: 11, paddingVertical: 9,
  },
  tokenNum  : { color: Colors.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  tokenSeq  : { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800", marginTop: 2 },

  name  : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  addr  : { color: Colors.textSecondary, fontSize: 12, marginTop: 5, lineHeight: 17 },
  items : { color: Colors.textMuted, fontSize: 11.5, marginTop: 4 },
  why   : { color: Colors.textMuted, fontSize: 11.5, marginTop: 4 },
  whyLate: { color: "#f87171", fontWeight: "700" },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 7, flexWrap: "wrap" },
  meta  : { color: Colors.textMuted, fontSize: 11.5, fontWeight: "600" },

  packBtn : { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  packText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
  btnOff  : { backgroundColor: Colors.border },

  linkBtn : {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8,
  },
  linkText: { color: Colors.primaryLight, fontSize: 12, fontWeight: "700" },
  pauseBtn: {
    width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
  },

  addRow : { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 13 },
  addText: { color: Colors.primaryLight, fontSize: 13, fontWeight: "700" },
  addCard: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 13,
  },
  input  : {
    backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12,
    color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  addBtns  : { flexDirection: "row", gap: 9, marginTop: 12 },
  cancelBtn: { flex: 1, backgroundColor: Colors.bgElevated, borderRadius: 10, padding: 12, alignItems: "center" },
  cancelText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "700" },
  saveBtn  : { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  saveText : { color: "#fff", fontSize: 13, fontWeight: "800" },

  footNote: {
    color: Colors.textMuted, fontSize: 11.5, lineHeight: 18,
    textAlign: "center", marginTop: 22, paddingHorizontal: 12,
  },
});
