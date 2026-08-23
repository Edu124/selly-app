// ── New Order — the kitchen types in an order it just took ────────────────────
//
// Phase 1 has no customer-facing page, so this is how EVERY order gets in. A
// cloud kitchen today takes orders on a phone call, a WhatsApp message or an
// Instagram DM; this is where that becomes something the app can act on.
//
// It is the most-used screen in the product and it is used under pressure —
// often with the customer still on the line. So it is built for speed over
// completeness: the menu is one tap per item, the phone number is the only
// required field beyond the food, and everything else has a working default.
//
// The phone number is required because it is the only thing that makes the rest
// of the product work — status messages, repeat-customer history and the
// scheduling package are all keyed on it. An order without one is a dead end.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { fetchCatalog, createOrder, fetchCustomerPackage, upsertCustomerContact } from "../lib/api";
import { loadStoreConfig } from "../lib/storeStatus";
import { friendlyError } from "../lib/errors";
import { inr } from "../lib/whatsapp";
import {
  availableDays, scheduleConfig, canSchedule, timeLabel,
} from "../lib/scheduling";

export default function NewOrderScreen({ navigation }) {
  const [menu,     setMenu]     = useState([]);
  const [cart,     setCart]     = useState({});     // id -> qty
  const [name,     setName]     = useState("");
  const [mobile,   setMobile]   = useState("");
  const [address,  setAddress]  = useState("");
  const [note,     setNote]     = useState("");
  const [payMode,  setPayMode]  = useState("cod");

  const [when,     setWhen]     = useState(null);   // null = ASAP
  const [days,     setDays]     = useState([]);
  const [dayIdx,   setDayIdx]   = useState(0);
  const [sched,    setSched]    = useState(null);
  const [gate,     setGate]     = useState(null);   // package check for this mobile

  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, store] = await Promise.all([
        fetchCatalog(),
        loadStoreConfig().catch(() => null),
      ]);
      setMenu((c.products || []).filter(p => p.inStock !== false));
      setSettings((store && store.settings) || {});
      const cfg = scheduleConfig({ schedule_config: (store && store.config && store.config.schedule) });
      setSched(cfg);
      setDays(availableDays(cfg));
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Look up the customer's scheduling package once there is a full number to
  // look up. Checked here rather than at save time so the kitchen finds out
  // before it promises the customer a delivery time it cannot honour.
  const checkPackage = useCallback(async (digits) => {
    if (digits.length !== 10 || !sched) { setGate(null); return; }
    try {
      const pkg = await fetchCustomerPackage(digits);
      setGate(canSchedule(pkg, sched));
    } catch {
      setGate(null);
    }
  }, [sched]);

  // A dish with priced portions is several orderable things, not one. The cart
  // is keyed on dish+portion so a half and a full plate of the same dish are
  // separate lines with separate prices -- which is the whole point.
  const variantsOf = (it) => {
    const pp = (it.extraFields && it.extraFields.portionPrices) || {};
    const named = (it.sizes || []).filter(sz => pp[sz] > 0);
    if (!named.length) {
      return [{ key: String(it.id), label: null, price: Number(it.price) || 0 }];
    }
    return named.map(sz => ({
      key  : `${it.id}::${sz}`,
      label: sz,
      price: Number(pp[sz]),
    }));
  };

  const lines = useMemo(() => Object.keys(cart).map(key => {
    const [id, label] = key.split("::");
    const it = menu.find(m => String(m.id) === String(id));
    if (!it) return null;
    const v = variantsOf(it).find(x => x.key === key);
    if (!v) return null;
    return {
      id: key,
      // The portion rides in the name so it survives onto the kitchen ticket,
      // the customer's message and the rider's screen without any of them
      // needing to know portions exist.
      name : label ? `${it.name} (${label})` : it.name,
      price: v.price,
      qty  : cart[key],
      productNumber: it.productNumber || "",
    };
  }).filter(Boolean), [cart, menu]);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const delivery = Number((settings && settings.delivery_charge) || 0);
  const freeAbove = Number((settings && settings.free_above) || 0);
  // No delivery charge on an empty cart, and none once the free-above threshold
  // is met. Showing ₹49 before a single dish is chosen just looks broken.
  const deliveryDue = subtotal === 0 ? 0
                    : (freeAbove && subtotal >= freeAbove) ? 0
                    : delivery;
  const total = subtotal + deliveryDue;

  const setQty = (id, q) => {
    setCart(c => {
      const next = { ...c };
      if (q <= 0) delete next[id]; else next[id] = q;
      return next;
    });
  };

  async function save() {
    const digits = mobile.replace(/\D/g, "");
    if (!lines.length)      return Alert.alert("Nothing ordered", "Add at least one dish.");
    if (digits.length !== 10) return Alert.alert("Mobile number", "A 10-digit number is needed so the customer can be kept updated.");
    if (!address.trim())    return Alert.alert("Address", "A delivery address is needed.");

    setSaving(true);
    try {
      const order = await createOrder({
        name: name.trim() || "Guest",
        mobile: digits,
        address: address.trim(),
        cart: lines.map(l => ({
          name: l.name, price: l.price, qty: l.qty,
          productNumber: l.productNumber, size: null,
        })),
        deliveryCharge: deliveryDue,
        paymentMode: payMode,
        note: note.trim(),
        scheduledFor: when ? when.iso : null,
        scheduleSlot: when ? when.slotKey : null,
      });

      // Remember who this was. Without it the kitchen can take the same
      // customer's order ten times and still have no way to reach them.
      await upsertCustomerContact({ mobile: digits, name: name.trim() }).catch(() => {});

      // Straight to the screen that now owns it, rather than back to a blank
      // form — the kitchen's next question is always "is it in the queue".
      navigation?.navigate?.(when ? "Scheduled" : "Kitchen");

      setCart({}); setName(""); setMobile(""); setAddress(""); setNote("");
      setWhen(null); setGate(null);
    } catch (e) {
      Alert.alert("Couldn't save the order", friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const schedulingOffered = sched && sched.enabled;
  const blocked = when && gate && !gate.allowed;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>New order</Text>
        <Text style={styles.pageSub}>
          For an order you took on the phone, WhatsApp or Instagram.
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── the food ── */}
        <Text style={styles.sectionLabel}>WHAT DID THEY ORDER</Text>
        {menu.length === 0 ? (
          <View style={styles.emptyMenu}>
            <Text style={styles.emptyMenuText}>
              Your menu is empty. Add dishes under Menu first — you can't take an
              order for food the app doesn't know the price of.
            </Text>
          </View>
        ) : (
          <View style={styles.menuCard}>
            {menu.map(it => {
              const variants = variantsOf(it);
              const anyOn = variants.some(v => (cart[v.key] || 0) > 0);

              const control = (v) => {
                const q = cart[v.key] || 0;
                return q === 0 ? (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setQty(v.key, 1)}>
                    <Text style={styles.addBtnText}>ADD</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setQty(v.key, q - 1)}>
                      <Text style={styles.stepText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepQty}>{q}</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setQty(v.key, q + 1)}>
                      <Text style={styles.stepText}>+</Text>
                    </TouchableOpacity>
                  </View>
                );
              };

              // One portion: the dish is the row. Several: the dish is a heading
              // and each portion gets its own line, so nobody has to work out
              // which price they just tapped.
              if (variants.length === 1) {
                return (
                  <View key={it.id} style={[styles.dish, anyOn && styles.dishOn]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dishName}>{it.name}</Text>
                      <Text style={styles.dishPrice}>{inr(variants[0].price)}</Text>
                    </View>
                    {control(variants[0])}
                  </View>
                );
              }

              return (
                <View key={it.id} style={[styles.dishGroup, anyOn && styles.dishOn]}>
                  <Text style={styles.dishName}>{it.name}</Text>
                  {variants.map(v => (
                    <View key={v.key} style={styles.portionLine}>
                      <Text style={styles.portionLabel}>{v.label}</Text>
                      <Text style={styles.portionPrice}>{inr(v.price)}</Text>
                      {control(v)}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* ── who ── */}
        <Text style={styles.sectionLabel}>WHO IS IT FOR</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input} value={name} onChangeText={setName}
            placeholder="Priya" placeholderTextColor={Colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Mobile number</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={(v) => {
              const d = v.replace(/\D/g, "").slice(0, 10);
              setMobile(d);
              checkPackage(d);
            }}
            placeholder="98765 43210" placeholderTextColor={Colors.textMuted}
            keyboardType="phone-pad" maxLength={10}
          />
          <Text style={styles.fieldHint}>
            Needed so you can send them updates and so repeat orders link up.
          </Text>

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Delivery address</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={address} onChangeText={setAddress} multiline
            placeholder={"Flat 302, B wing, Shanti Residency, near D-Mart, Baner"}
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Note for the kitchen</Text>
          <TextInput
            style={styles.input} value={note} onChangeText={setNote}
            placeholder="less spicy, no coriander…" placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* ── when ── */}
        {schedulingOffered && (
          <>
            <Text style={styles.sectionLabel}>WHEN</Text>
            <View style={styles.card}>
              <View style={styles.whenRow}>
                <TouchableOpacity
                  style={[styles.whenBtn, !when && styles.whenBtnOn]}
                  onPress={() => setWhen(null)}
                >
                  <Text style={[styles.whenText, !when && styles.whenTextOn]}>As soon as possible</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.whenBtn, !!when && styles.whenBtnOn]}
                  onPress={() => {
                    const first = days[0] && days[0].times[0];
                    if (first) { setWhen(first); setDayIdx(0); }
                  }}
                >
                  <Text style={[styles.whenText, !!when && styles.whenTextOn]}>Pick a time</Text>
                </TouchableOpacity>
              </View>

              {!!when && (
                <>
                  {/* Members only, unless the kitchen made scheduling free. */}
                  {gate && !gate.allowed && (
                    <View style={styles.gateBox}>
                      <Ionicons name="lock-closed-outline" size={14} color={Colors.yellow} />
                      <Text style={styles.gateText}>
                        {gate.message} Start them on a trial from the Members screen,
                        or send this one as soon as possible.
                      </Text>
                    </View>
                  )}
                  {gate && gate.allowed && gate.message && (
                    <View style={styles.memberBox}>
                      <Ionicons name="star" size={12} color={Colors.green} />
                      <Text style={styles.memberText}>{gate.message}</Text>
                    </View>
                  )}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStrip}>
                    {days.map((d, i) => (
                      <TouchableOpacity
                        key={d.label}
                        style={[styles.dayChip, dayIdx === i && styles.dayChipOn]}
                        onPress={() => setDayIdx(i)}
                      >
                        <Text style={[styles.dayChipText, dayIdx === i && styles.dayChipTextOn]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={styles.slotWrap}>
                    {(days[dayIdx] ? days[dayIdx].times : []).map(t => {
                      const on = when && when.iso === t.iso;
                      return (
                        <TouchableOpacity
                          key={t.iso}
                          style={[styles.slot, on && styles.slotOn]}
                          onPress={() => setWhen(t)}
                        >
                          <Text style={[styles.slotText, on && styles.slotTextOn]}>
                            {t.emoji} {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* ── money ── */}
        <Text style={styles.sectionLabel}>PAYMENT</Text>
        <View style={styles.card}>
          <View style={styles.whenRow}>
            {[
              { k: "cod",  label: "Cash on delivery" },
              { k: "upi",  label: "UPI" },
              { k: "paid", label: "Already paid" },
            ].map(p => (
              <TouchableOpacity
                key={p.k}
                style={[styles.whenBtn, payMode === p.k && styles.whenBtnOn]}
                onPress={() => setPayMode(p.k)}
              >
                <Text style={[styles.whenText, payMode === p.k && styles.whenTextOn]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.billBox}>
            <View style={styles.billLine}>
              <Text style={styles.billText}>Items</Text>
              <Text style={styles.billAmt}>{inr(subtotal)}</Text>
            </View>
            <View style={styles.billLine}>
              <Text style={styles.billText}>
                Delivery{deliveryDue === 0 && delivery > 0 ? " (free over " + inr(freeAbove) + ")" : ""}
              </Text>
              <Text style={styles.billAmt}>{inr(deliveryDue)}</Text>
            </View>
            <View style={[styles.billLine, styles.billTotal]}>
              <Text style={styles.billTotalText}>Total</Text>
              <Text style={styles.billTotalAmt}>{inr(total)}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (saving || !lines.length || blocked) && styles.saveBtnOff]}
          onPress={save}
          disabled={saving || !lines.length || blocked}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…"
              : blocked ? "Not a scheduling member"
              : lines.length ? `Take order · ${inr(total)}`
              : "Add a dish first"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footNote}>
          {when
            ? "Goes to Scheduled, and joins the Kitchen on its own when it's nearly due."
            : "Goes straight into the Kitchen queue."}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, paddingBottom: 50 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  pageTitle : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900" },
  pageSub   : { color: Colors.textMuted, fontSize: 12.5, marginTop: 4, marginBottom: 8 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
    borderRadius: 11, padding: 12, marginTop: 12,
  },
  errorText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 9.5, fontWeight: "800",
    letterSpacing: 0.9, marginTop: 20, marginBottom: 9,
  },
  card: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14,
  },
  menuCard: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4,
  },
  emptyMenu    : { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
                   borderRadius: 14, padding: 16 },
  emptyMenuText: { color: Colors.textSecondary, fontSize: 12.5, lineHeight: 19 },

  dish: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dishOn   : { borderBottomColor: "rgba(124,92,255,0.25)" },
  dishGroup: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border },
  portionLine : {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingTop: 9, paddingLeft: 2,
  },
  portionLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  portionPrice: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "700" },
  dishName : { color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  dishPrice: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  addBtn    : { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 7 },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  stepper   : { flexDirection: "row", alignItems: "center",
                backgroundColor: Colors.bgElevated, borderRadius: 8,
                borderWidth: 1, borderColor: Colors.primary },
  stepBtn   : { paddingHorizontal: 11, paddingVertical: 5 },
  stepText  : { color: Colors.primary, fontSize: 17, fontWeight: "800" },
  stepQty   : { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "800", minWidth: 18, textAlign: "center" },

  fieldLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  fieldHint : { color: Colors.textMuted, fontSize: 11, marginTop: 5 },
  input     : {
    backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12,
    color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  multiline : { height: 74, textAlignVertical: "top" },

  whenRow  : { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  whenBtn  : {
    flexGrow: 1, backgroundColor: Colors.bgInput, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 12, alignItems: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  whenBtnOn : { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  whenText  : { color: Colors.textSecondary, fontSize: 12.5, fontWeight: "600" },
  whenTextOn: { color: Colors.primaryLight, fontWeight: "800" },

  gateBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12,
    backgroundColor: "rgba(245,165,36,0.09)", borderWidth: 1, borderColor: "rgba(245,165,36,0.26)",
    borderRadius: 10, padding: 11,
  },
  gateText  : { color: Colors.textSecondary, fontSize: 11.5, flex: 1, lineHeight: 17 },
  memberBox : {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12,
    backgroundColor: "rgba(34,197,94,0.10)", borderRadius: 10, padding: 9,
  },
  memberText: { color: Colors.green, fontSize: 11.5, fontWeight: "700" },

  dayStrip : { marginTop: 12, marginBottom: 4 },
  dayChip  : {
    backgroundColor: Colors.bgInput, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7,
    marginRight: 7, borderWidth: 1, borderColor: Colors.border,
  },
  dayChipOn    : { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "700" },
  dayChipTextOn: { color: "#fff" },

  slotWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  slot    : {
    backgroundColor: Colors.bgInput, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  slotOn     : { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  slotText   : { color: Colors.textSecondary, fontSize: 12 },
  slotTextOn : { color: Colors.primaryLight, fontWeight: "800" },

  billBox  : { backgroundColor: Colors.bg, borderRadius: 10, padding: 12, marginTop: 14 },
  billLine : { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  billText : { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },
  billAmt  : { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },
  billTotal: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 6, paddingTop: 9 },
  billTotalText: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", flex: 1 },
  billTotalAmt : { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },

  saveBtn    : { backgroundColor: Colors.primary, borderRadius: 13, padding: 16, alignItems: "center", marginTop: 20 },
  saveBtnOff : { backgroundColor: Colors.border },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  footNote: { color: Colors.textMuted, fontSize: 11.5, textAlign: "center", marginTop: 12, lineHeight: 17 },
});
