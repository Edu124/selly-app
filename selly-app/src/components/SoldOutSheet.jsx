// ── SoldOutSheet — the 86 list ────────────────────────────────────────────────
// Running out mid-service is routine, not an exception. The existing path is
// Menu → scroll → find the item → open the editor → find the stock toggle →
// save, which is far too slow when there's a queue and the paneer just ran out.
//
// This is one search box and one tap per item. Items already off are pinned to
// the top so putting them back is just as quick — the thing owners actually
// forget, which is how a dish stays hidden for a week.
//
// "86" is the kitchen term for an item that's off the menu.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { toggleStock } from "../lib/api";
import { friendlyError } from "../lib/errors";

export default function SoldOutSheet({ visible, onClose, products = [], onChanged }) {
  const [q,      setQ]      = useState("");
  const [busyId, setBusyId] = useState(null);
  const [local,  setLocal]  = useState({});   // id -> inStock, applied optimistically

  const inStockOf = (p) => (local[p.id] !== undefined ? local[p.id] : p.inStock !== false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match  = needle
      ? products.filter(p =>
          (p.name || "").toLowerCase().includes(needle) ||
          (p.category || "").toLowerCase().includes(needle))
      : products;
    // Sold-out first — putting things back is the half people forget.
    return [...match].sort((a, b) => {
      const ao = inStockOf(a) ? 1 : 0;
      const bo = inStockOf(b) ? 1 : 0;
      return ao - bo || (a.name || "").localeCompare(b.name || "");
    });
  }, [products, q, local]);

  const offCount = products.filter(p => !inStockOf(p)).length;

  async function flip(p) {
    if (busyId) return;
    const next = !inStockOf(p);
    setBusyId(p.id);
    setLocal(m => ({ ...m, [p.id]: next }));       // optimistic
    try {
      await toggleStock(p.id, next);
      onChanged?.();
    } catch (e) {
      setLocal(m => ({ ...m, [p.id]: !next }));    // put it back
      Alert.alert("Couldn't update", friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Sold out today</Text>
              <Text style={styles.sub}>
                {offCount === 0
                  ? "Everything is available"
                  : `${offCount} item${offCount === 1 ? "" : "s"} hidden from the ordering page`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={15} color={Colors.textMuted} />
            <TextInput
              style={styles.search}
              value={q}
              onChangeText={setQ}
              placeholder="Search the menu…"
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ("")}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {rows.length === 0 ? (
              <Text style={styles.empty}>
                {products.length === 0
                  ? "No menu items yet. Add dishes from the Menu screen first."
                  : "Nothing matches that."}
              </Text>
            ) : rows.map(p => {
              const on   = inStockOf(p);
              const busy = busyId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.row, !on && styles.rowOff]}
                  onPress={() => flip(p)}
                  disabled={busy}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, !on && styles.nameOff]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      ₹{Number(p.price || 0).toLocaleString("en-IN")}
                      {p.category ? ` · ${p.category}` : ""}
                    </Text>
                  </View>

                  {busy ? (
                    <ActivityIndicator color={Colors.textMuted} size="small" />
                  ) : on ? (
                    <View style={styles.offBtn}>
                      <Text style={styles.offBtnText}>Mark sold out</Text>
                    </View>
                  ) : (
                    <View style={styles.onBtn}>
                      <Ionicons name="refresh" size={12} color={Colors.green} />
                      <Text style={styles.onBtnText}>Put back</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 12 }} />
          </ScrollView>

          <Text style={styles.footHint}>
            Sold-out items stay on your menu but can't be ordered. Put them back
            when the next batch is ready.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "flex-end" },
  sheet   : {
    backgroundColor: Colors.bgModal, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 16, paddingBottom: 20, maxHeight: "86%",
  },

  head : { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 18, marginBottom: 13 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  sub  : { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 18, marginBottom: 10, paddingHorizontal: 12,
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
  },
  search: { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 10 },

  list : { paddingHorizontal: 18 },
  empty: { color: Colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 30, lineHeight: 19 },

  row   : {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  rowOff : { borderColor: "rgba(239,68,68,0.32)", backgroundColor: "rgba(239,68,68,0.06)" },
  name   : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  nameOff: { color: Colors.textSecondary, textDecorationLine: "line-through" },
  meta   : { color: Colors.textMuted, fontSize: 11.5, marginTop: 2 },

  offBtn    : { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  offBtnText: { color: Colors.textSecondary, fontSize: 11.5, fontWeight: "700" },
  onBtn     : { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(34,197,94,0.14)", borderWidth: 1, borderColor: "rgba(34,197,94,0.35)", borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  onBtnText : { color: Colors.green, fontSize: 11.5, fontWeight: "700" },

  footHint: { color: Colors.textMuted, fontSize: 11, paddingHorizontal: 18, paddingTop: 10, lineHeight: 16 },
});
