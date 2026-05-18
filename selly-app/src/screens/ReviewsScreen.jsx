// ── Reviews Screen ─────────────────────────────────────────────────────────────
// Shows customer star ratings collected after delivery
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { fetchReviews } from "../lib/api";

function stars(rating) {
  return "⭐".repeat(rating || 0);
}

function ratingColor(r) {
  if (r >= 4) return Colors.green;
  if (r >= 3) return Colors.yellow;
  return Colors.red;
}

export default function ReviewsScreen() {
  const [reviews, setReviews]     = useState([]);
  const [average, setAverage]     = useState(null);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const r = await fetchReviews();
      setReviews(r.reviews || []);
      setAverage(r.average);
      setTotal(r.total || 0);
    } catch (e) {
      console.warn("Reviews load error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

  // Count per rating
  const counts = [1, 3, 5].reduce((acc, r) => {
    acc[r] = reviews.filter(x => x.rating === r).length;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.avgBlock}>
          <Text style={styles.avgNumber}>{average ?? "—"}</Text>
          <Text style={styles.avgStars}>{average ? stars(Math.round(parseFloat(average))) : "No reviews yet"}</Text>
          <Text style={styles.avgLabel}>{total} review{total !== 1 ? "s" : ""}</Text>
        </View>
        <View style={styles.breakdownBlock}>
          {[5, 3, 1].map(r => (
            <View key={r} style={styles.breakdownRow}>
              <Text style={styles.breakdownStar}>{"⭐".repeat(r)}</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, {
                  width: total > 0 ? `${(counts[r] / total) * 100}%` : "0%",
                  backgroundColor: ratingColor(r),
                }]} />
              </View>
              <Text style={styles.breakdownCount}>{counts[r]}</Text>
            </View>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.ratingCircle}>
                  <Text style={[styles.ratingNum, { color: ratingColor(item.rating) }]}>{item.rating}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{item.customer_name || "Customer"}</Text>
                  <Text style={styles.ratingStars}>{stars(item.rating)}</Text>
                  {item.product_name ? (
                    <Text style={styles.productName}>{item.product_name}</Text>
                  ) : null}
                </View>
                <Text style={styles.timeText}>
                  {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⭐</Text>
              <Text style={styles.emptyText}>No reviews yet</Text>
              <Text style={styles.emptyDesc}>
                After each delivery, customers get a rating request. Their responses appear here automatically.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: Colors.bg },
  center      : { flex: 1, alignItems: "center", justifyContent: "center" },

  summaryCard : { backgroundColor: Colors.bgCard, margin: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", gap: 16 },
  avgBlock    : { alignItems: "center", justifyContent: "center", minWidth: 80 },
  avgNumber   : { color: Colors.textPrimary, fontSize: 40, fontWeight: "900" },
  avgStars    : { fontSize: 16, marginTop: 2 },
  avgLabel    : { color: Colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: "600" },

  breakdownBlock: { flex: 1, justifyContent: "center", gap: 6 },
  breakdownRow  : { flexDirection: "row", alignItems: "center", gap: 8 },
  breakdownStar : { fontSize: 11, width: 40 },
  barBg         : { flex: 1, height: 6, backgroundColor: Colors.bgInput, borderRadius: 3, overflow: "hidden" },
  barFill       : { height: 6, borderRadius: 3 },
  breakdownCount: { color: Colors.textMuted, fontSize: 11, fontWeight: "700", width: 20, textAlign: "right" },

  list        : { padding: 16, gap: 10, paddingBottom: 32 },

  card        : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardRow     : { flexDirection: "row", alignItems: "center", gap: 12 },
  ratingCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.bgInput, alignItems: "center", justifyContent: "center" },
  ratingNum   : { fontSize: 18, fontWeight: "900" },
  customerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  ratingStars : { fontSize: 14, marginTop: 2 },
  productName : { color: Colors.textSecondary, fontSize: 11, marginTop: 3, fontStyle: "italic" },
  timeText    : { color: Colors.textMuted, fontSize: 11 },

  empty       : { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon   : { fontSize: 48, marginBottom: 12 },
  emptyText   : { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  emptyDesc   : { color: Colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 18 },
});
