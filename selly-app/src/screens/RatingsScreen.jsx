// ── Ratings — what customers actually said ────────────────────────────────────
//
// Built around one belief: the average is the least useful number here. A
// kitchen sitting at 4.3 learns nothing from 4.3. What changes their Tuesday is
// "arrived cold, eleven times this month" and "Kavita is about to stop
// ordering".
//
// So this leads with the recurring words and the people who need a reply, and
// puts the average in a corner where it belongs.
//
// One and two stars already opened a complaint when they were submitted, so
// this screen links to it rather than making the kitchen re-enter the same
// thing in two places.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { fetchRatings } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { deliver } from "../lib/messaging";
import {
  RATINGS, ratingFor, summarise, isComplaint, severityOf, replyStarter,
} from "../lib/ratings";

const SEVERITY = {
  urgent: { label: "Needs a call", colour: "#f87171", bg: "rgba(239,68,68,0.14)" },
  high  : { label: "Unhappy",      colour: Colors.yellow, bg: "rgba(245,165,36,0.14)" },
};

function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function RatingsScreen({ navigation }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState("all");   // all | needsReply

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetchRatings();
      setRows(Array.isArray(r) ? r : []);
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

  async function reply(r) {
    await deliver({
      mobile : r.mobile,
      text   : replyStarter(r),
      channel: "whatsapp",
    });
  }

  if (loading && !rows.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const stats  = summarise(rows);
  const unhappy = rows.filter(r => isComplaint(r.score) && !r.replied_at);
  const shown  = filter === "needsReply" ? unhappy : rows;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Ratings</Text>
          <Text style={styles.pageSub}>
            {stats.count === 0 ? "No ratings yet" : `${stats.count} ratings · ${stats.average} average`}
          </Text>
        </View>
        {stats.count > 0 && (
          <View style={styles.avgBox}>
            <Text style={styles.avgNum}>{stats.average}</Text>
            <Text style={styles.avgOf}>/ 5</Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {stats.count === 0 && !error && (
        <View style={styles.empty}>
          <Ionicons name="happy-outline" size={38} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Nothing rated yet</Text>
          <Text style={styles.emptyBody}>
            Every delivered order gets a one-tap rating link in its message.
            Answers land here.
          </Text>
        </View>
      )}

      {stats.count > 0 && (
        <>
          {/* ── the thing worth acting on ── */}
          {unhappy.length > 0 && (
            <TouchableOpacity
              style={styles.alertCard}
              activeOpacity={0.8}
              onPress={() => setFilter(filter === "needsReply" ? "all" : "needsReply")}
            >
              <Ionicons name="alert-circle" size={17} color="#f87171" />
              <Text style={styles.alertText}>
                {unhappy.length} unhappy customer{unhappy.length === 1 ? "" : "s"} waiting on a reply
              </Text>
              <Text style={styles.alertLink}>{filter === "needsReply" ? "Show all" : "Show"}</Text>
            </TouchableOpacity>
          )}

          {/* ── what people keep saying ── */}
          <Text style={styles.sectionLabel}>WHAT PEOPLE KEEP SAYING</Text>
          <View style={styles.wordsCard}>
            {stats.topWords.map(w => {
              const bad = ["Arrived cold","Late","Very late","Item missing","Wrong item",
                           "Bland","Too oily","Packaging leaked","Tasted stale",
                           "Small portion","A bit late","Made me unwell"].includes(w.word);
              return (
                <View key={w.word} style={[styles.word, bad && styles.wordBad]}>
                  <Text style={[styles.wordText, bad && styles.wordTextBad]}>{w.word}</Text>
                  <Text style={[styles.wordCount, bad && styles.wordTextBad]}>×{w.count}</Text>
                </View>
              );
            })}
          </View>

          {/* ── the spread ── */}
          <Text style={styles.sectionLabel}>THE SPREAD</Text>
          <View style={styles.barsCard}>
            {stats.breakdown.map(b => (
              <View key={b.score} style={styles.barRow}>
                <Text style={styles.barEmoji}>{b.emoji}</Text>
                <View style={styles.barTrack}>
                  <View style={[
                    styles.barFill,
                    { width: `${Math.round(b.share * 100)}%`,
                      backgroundColor: b.score >= 4 ? Colors.green
                                     : b.score === 3 ? Colors.yellow : "#f87171" },
                  ]} />
                </View>
                <Text style={styles.barCount}>{b.count}</Text>
              </View>
            ))}
          </View>

          {/* ── every rating ── */}
          <Text style={styles.sectionLabel}>
            {filter === "needsReply" ? `NEEDS A REPLY · ${shown.length}` : `EVERY RATING · ${shown.length}`}
          </Text>
          {shown.map(r => {
            const def = ratingFor(r.score);
            const sev = SEVERITY[severityOf(r)];
            return (
              <View key={r.id} style={[styles.card, sev && { borderColor: sev.bg }]}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardEmoji}>{def ? def.emoji : "•"}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{r.name || "Guest"}</Text>
                      {sev && (
                        <View style={[styles.sevTag, { backgroundColor: sev.bg }]}>
                          <Text style={[styles.sevText, { color: sev.colour }]}>{sev.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.meta}>
                      #{String(r.order_id).slice(-5)} · {timeAgo(r.created_at)}
                      {r.replied_at ? " · replied" : ""}
                    </Text>
                  </View>
                </View>

                {(r.keywords || []).length > 0 && (
                  <View style={styles.chipRow}>
                    {r.keywords.map(k => (
                      <View key={k} style={styles.chip}>
                        <Text style={styles.chipText}>{k}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {!!r.comment && <Text style={styles.comment}>“{r.comment}”</Text>}

                {isComplaint(r.score) && !r.replied_at && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.replyBtn} onPress={() => reply(r)}>
                      <Ionicons name="logo-whatsapp" size={13} color="#fff" />
                      <Text style={styles.replyText}>Reply now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.linkBtn}
                      onPress={() => navigation?.navigate?.("More", { screen: "Returns" })}
                    >
                      <Text style={styles.linkText}>Open complaint →</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}

      <Text style={styles.footNote}>
        A rating of two or below opens a complaint on its own, so nothing waits on
        somebody noticing it here.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, paddingBottom: 40 },
  center    : { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },

  head     : { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  pageTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: "900" },
  pageSub  : { color: Colors.textMuted, fontSize: 12.5, marginTop: 4 },
  avgBox   : { flexDirection: "row", alignItems: "baseline", gap: 2 },
  avgNum   : { color: Colors.textPrimary, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  avgOf    : { color: Colors.textMuted, fontSize: 13 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
    borderRadius: 11, padding: 12, marginBottom: 12,
  },
  errorText: { color: Colors.textSecondary, fontSize: 12.5, flex: 1 },

  alertCard: {
    flexDirection: "row", alignItems: "center", gap: 9,
    backgroundColor: "rgba(239,68,68,0.09)", borderWidth: 1, borderColor: "rgba(239,68,68,0.30)",
    borderRadius: 13, padding: 13,
  },
  alertText: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", flex: 1 },
  alertLink: { color: "#f87171", fontSize: 12.5, fontWeight: "800" },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 9.5, fontWeight: "800",
    letterSpacing: 0.9, marginTop: 20, marginBottom: 9,
  },

  wordsCard: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 13,
  },
  word: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(34,197,94,0.10)", borderRadius: 20,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  wordBad     : { backgroundColor: "rgba(239,68,68,0.11)" },
  wordText    : { color: Colors.green, fontSize: 12.5, fontWeight: "600" },
  wordTextBad : { color: "#f87171" },
  wordCount   : { color: Colors.green, fontSize: 11.5, fontWeight: "800" },

  barsCard: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 13,
  },
  barRow  : { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  barEmoji: { fontSize: 17, width: 24 },
  barTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: Colors.bg, overflow: "hidden" },
  barFill : { height: 7, borderRadius: 4 },
  barCount: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", minWidth: 20, textAlign: "right" },

  card: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 14, padding: 13, marginBottom: 10,
  },
  cardTop  : { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  cardEmoji: { fontSize: 24 },
  nameRow  : { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  name     : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  sevTag   : { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2.5 },
  sevText  : { fontSize: 9.5, fontWeight: "800" },
  meta     : { color: Colors.textMuted, fontSize: 11.5, marginTop: 4 },

  chipRow : { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 11 },
  chip    : { backgroundColor: Colors.bg, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  chipText: { color: Colors.textSecondary, fontSize: 11.5 },
  comment : { color: Colors.textSecondary, fontSize: 12.5, fontStyle: "italic",
              marginTop: 11, lineHeight: 18 },

  actions : { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  replyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.green, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8,
  },
  replyText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  linkBtn  : { paddingVertical: 8 },
  linkText : { color: Colors.primaryLight, fontSize: 12, fontWeight: "700" },

  empty     : { alignItems: "center", paddingVertical: 50, paddingHorizontal: 26 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "700", marginTop: 14 },
  emptyBody : { color: Colors.textMuted, fontSize: 12.5, textAlign: "center", marginTop: 8, lineHeight: 19 },

  footNote: {
    color: Colors.textMuted, fontSize: 11.5, lineHeight: 18,
    textAlign: "center", marginTop: 22, paddingHorizontal: 16,
  },
});
