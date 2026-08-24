// ── Your ordering link ────────────────────────────────────────────────────────
//
// The thing a kitchen puts on a flyer, a sticker, an Instagram bio, or reads out
// on the phone. A customer opens it, sees the menu, and orders — no app, no
// account, and no aggregator in between.
//
// The QR is the same link, because a printed code and a tapped link have to lead
// to the same place. Two entry points that drift apart is how a kitchen ends up
// telling people the wrong thing.
//
// WHY THE CODE IS SHORT
//   The business id is a uuid. Nobody prints a uuid on a packet or reads one out
//   down the phone, so the link carries an eight-character code instead.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Share, Platform, Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Colors } from "../constants/colors";
import { fetchBusinessSettings, fetchCatalog } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { ratingBase } from "../lib/messaging";
import QrCode from "../components/QrCode";

export default function OrderLinkScreen({ navigation }) {
  const [settings, setSettings] = useState(null);
  const [dishes,   setDishes]   = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [copied,   setCopied]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        fetchBusinessSettings(),
        fetchCatalog().catch(() => ({ products: [] })),
      ]);
      setSettings((s && s.settings) || {});
      setDishes(((c && c.products) || []).filter(p => p.inStock !== false).length);
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const code = settings && settings.public_code;
  const link = code ? `${ratingBase()}/order.html?k=${code}` : null;

  async function copy() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  async function share() {
    const name = (settings && settings.business_name) || "our kitchen";
    const msg  = `Order from ${name}:\n${link}`;
    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } else {
      await Share.share({ message: msg });
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Your ordering link</Text>
      <Text style={styles.pageSub}>
        Share it, print it, put it on your packaging. Customers order straight
        from your menu — no app, nobody in between.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!code && !error && (
        <View style={styles.setupBox}>
          <Ionicons name="link-outline" size={16} color={Colors.yellow} />
          <Text style={styles.setupText}>
            Your link isn't ready yet. It's created the first time your kitchen
            details save — open Settings, check your business name, and save.
          </Text>
        </View>
      )}

      {!!code && (
        <>
          {/* An empty menu is the one thing that makes this link useless, and it
              is worth saying before they print anything. */}
          {dishes === 0 && (
            <View style={styles.setupBox}>
              <Ionicons name="restaurant-outline" size={16} color={Colors.yellow} />
              <Text style={styles.setupText}>
                Your menu is empty, so this link shows nothing to order. Add a few
                dishes under Menu first.
              </Text>
            </View>
          )}

          <View style={styles.qrCard}>
            <View style={styles.qrBox}>
              <QrCode value={link} size={190} />
            </View>
            <Text style={styles.qrCaption}>
              Point a phone camera at this and your menu opens
            </Text>
          </View>

          <View style={styles.linkCard}>
            <Text style={styles.linkLabel}>YOUR LINK</Text>
            <Text style={styles.linkText} numberOfLines={2}>{link}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btnPrimary} onPress={copy}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color="#fff" />
                <Text style={styles.btnPrimaryText}>{copied ? "Copied" : "Copy link"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={share}>
                <Ionicons name="share-social-outline" size={14} color={Colors.primaryLight} />
                <Text style={styles.btnGhostText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={() => Linking.openURL(link)}>
                <Ionicons name="eye-outline" size={14} color={Colors.primaryLight} />
                <Text style={styles.btnGhostText}>Preview</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionLabel}>WHERE TO PUT IT</Text>
          {[
            { icon: "🧾", t: "On the packet",     d: "A sticker with this code. The customer who already liked your food is the cheapest one to get back." },
            { icon: "📱", t: "Instagram bio",     d: "Replace the DM-to-order line. They tap once instead of waiting for you to reply." },
            { icon: "💬", t: "Your WhatsApp status", d: "Post it with today's menu. People who already have your number are the ones most likely to order." },
            { icon: "📄", t: "Flyers and pamphlets", d: "The QR does the work — nobody has to type an address or save a number." },
          ].map(r => (
            <View key={r.t} style={styles.tipRow}>
              <Text style={styles.tipIcon}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>{r.t}</Text>
                <Text style={styles.tipBody}>{r.d}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.footNote}>
            Orders from this link arrive in your Kitchen queue exactly like the
            ones you type in yourself, and the customer gets the same messages.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, paddingBottom: 40 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  pageTitle : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900" },
  pageSub   : { color: Colors.textMuted, fontSize: 12.5, marginTop: 5, lineHeight: 18 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
    borderRadius: 11, padding: 12, marginTop: 14,
  },
  errorText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },

  setupBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 14,
    backgroundColor: "rgba(245,165,36,0.09)", borderWidth: 1, borderColor: "rgba(245,165,36,0.26)",
    borderRadius: 12, padding: 12,
  },
  setupText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1, lineHeight: 18 },

  qrCard   : { alignItems: "center", marginTop: 18 },
  qrBox    : { backgroundColor: "#fff", padding: 16, borderRadius: 18 },
  qrCaption: { color: Colors.textMuted, fontSize: 12, marginTop: 12, textAlign: "center" },

  linkCard : {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 14, marginTop: 18,
  },
  linkLabel: { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.9 },
  linkText : { color: Colors.primaryLight, fontSize: 13, marginTop: 8, lineHeight: 19 },
  btnRow   : { flexDirection: "row", gap: 8, marginTop: 13, flexWrap: "wrap" },
  btnPrimary: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  btnPrimaryText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
  btnGhost: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  btnGhostText: { color: Colors.primaryLight, fontSize: 12.5, fontWeight: "700" },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 9.5, fontWeight: "800",
    letterSpacing: 0.9, marginTop: 24, marginBottom: 10,
  },
  tipRow  : { flexDirection: "row", gap: 11, alignItems: "flex-start", marginBottom: 14 },
  tipIcon : { fontSize: 19 },
  tipTitle: { color: Colors.textPrimary, fontSize: 13.5, fontWeight: "700" },
  tipBody : { color: Colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },

  footNote: {
    color: Colors.textMuted, fontSize: 11.5, lineHeight: 18,
    textAlign: "center", marginTop: 18, paddingHorizontal: 12,
  },
});
