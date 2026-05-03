import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import { fetchDashboard } from "../lib/api";
import StatCard from "../components/StatCard";
import OrderRow from "../components/OrderRow";

// ── Industry configuration ────────────────────────────────────────────────────
// All industries use the SAME backend stats keys — only labels change here.
const INDUSTRY_CONFIG = {
  product: {
    revenueLabel  : "Today's Revenue",
    stat1Label    : "Total Orders",    stat1Icon: "📦",
    stat2Label    : "Pending",         stat2Icon: "⏳",
    stat3Label    : "Confirmed",       stat3Icon: "✅",
    stat4Label    : "Shipped",         stat4Icon: "🚚",
    stat5Label    : "Delivered",       stat5Icon: "🎉",
    stat6Label    : "Customers",       stat6Icon: "👥",
    recentTitle   : "Recent Orders",
    emptyRecent   : "No orders yet",
    quickActions  : [
      { icon: "⚡", label: "Flash Sale",    screen: "Promotions", color: Colors.yellow  },
      { icon: "✨", label: "New Arrival",   screen: "Promotions", color: Colors.blue    },
      { icon: "🛒", label: "Recover Carts", screen: "Promotions", color: Colors.accent  },
      { icon: "➕", label: "Add Product",   screen: "Catalog",    color: Colors.primary },
    ],
  },
  education: {
    revenueLabel  : "Today's Fees Collected",
    stat1Label    : "Total Enrollments", stat1Icon: "🎓",
    stat2Label    : "Pending Fees",      stat2Icon: "⏳",
    stat3Label    : "Active",            stat3Icon: "✅",
    stat4Label    : "In Progress",       stat4Icon: "📖",
    stat5Label    : "Completed",         stat5Icon: "🏆",
    stat6Label    : "Students",          stat6Icon: "👨‍🎓",
    recentTitle   : "Recent Enrollments",
    emptyRecent   : "No enrollments yet",
    quickActions  : [
      { icon: "📢", label: "Batch Alert",   screen: "Promotions",  color: Colors.blue    },
      { icon: "🎓", label: "Add Course",    screen: "Courses",     color: Colors.primary },
      { icon: "💰", label: "Fee Reminder",  screen: "Promotions",  color: Colors.yellow  },
      { icon: "📣", label: "Promo Blast",   screen: "Promotions",  color: Colors.accent  },
    ],
  },
  tourism: {
    revenueLabel  : "Today's Bookings Value",
    stat1Label    : "Total Bookings",   stat1Icon: "🗓️",
    stat2Label    : "Pending",          stat2Icon: "⏳",
    stat3Label    : "Confirmed",        stat3Icon: "✅",
    stat4Label    : "Upcoming",         stat4Icon: "✈️",
    stat5Label    : "Completed",        stat5Icon: "🎉",
    stat6Label    : "Travelers",        stat6Icon: "🧳",
    recentTitle   : "Recent Bookings",
    emptyRecent   : "No bookings yet",
    quickActions  : [
      { icon: "🌴", label: "Add Package",     screen: "Packages",    color: Colors.primary },
      { icon: "💥", label: "Flash Deal",      screen: "Promotions",  color: Colors.yellow  },
      { icon: "📋", label: "Send Itinerary",  screen: "Promotions",  color: Colors.blue    },
      { icon: "📣", label: "Promo Blast",     screen: "Promotions",  color: Colors.accent  },
    ],
  },
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { industry } = useAuth();
  const cfg = INDUSTRY_CONFIG[industry] || INDUSTRY_CONFIG.product;

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const d = await fetchDashboard();
      setData(d);
    } catch (e) {
      if (!data) setData({ stats: {}, recent: [], customers: [] });
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>📡</Text>
        <Text style={styles.errorText}>Connecting...</Text>
        <Text style={styles.errorSub}>Server is waking up. This takes a few seconds on first load.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s     = data?.stats || {};
  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()} 👋</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <View style={styles.sellyBadge}>
          <Text style={styles.sellyText}>selly</Text>
        </View>
      </View>

      {/* Revenue / top card */}
      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>{cfg.revenueLabel}</Text>
        <Text style={styles.revenueAmount}>₹{(s.todayRevenue || 0).toLocaleString("en-IN")}</Text>
        <Text style={styles.revenueTotal}>
          Total: ₹{(s.totalRevenue || 0).toLocaleString("en-IN")}
        </Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard label={cfg.stat1Label} value={s.total     || 0} icon={cfg.stat1Icon} color={Colors.primary} />
        <StatCard label={cfg.stat2Label} value={s.pending   || 0} icon={cfg.stat2Icon} color={Colors.yellow}  />
        <StatCard label={cfg.stat3Label} value={s.confirmed || 0} icon={cfg.stat3Icon} color={Colors.green}   />
        <StatCard label={cfg.stat4Label} value={s.shipped   || 0} icon={cfg.stat4Icon} color={Colors.blue}    />
        <StatCard label={cfg.stat5Label} value={s.delivered || 0} icon={cfg.stat5Icon} color={Colors.green}   />
        <StatCard label={cfg.stat6Label} value={data?.customers?.length || 0} icon={cfg.stat6Icon} color={Colors.accent} />
      </View>

      {/* Recent list */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{cfg.recentTitle}</Text>
          <TouchableOpacity onPress={() => {
            // Navigate to the correct tab name per industry
            const tab2 = industry === "education" ? "Enrollments"
                       : industry === "tourism"   ? "Bookings"
                       : "Orders";
            navigation.navigate(tab2);
          }}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {(data?.recent || []).length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{cfg.emptyRecent}</Text>
          </View>
        ) : (
          (data?.recent || []).map(order => (
            <OrderRow
              key={order.id}
              order={order}
              industry={industry}
              onPress={() => {
                const tab2 = industry === "education" ? "Enrollments"
                           : industry === "tourism"   ? "Bookings"
                           : "Orders";
                navigation.navigate(tab2, { screen: "OrderDetail", params: { orderId: order.id } });
              }}
            />
          ))
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {cfg.quickActions.map(action => (
            <ActionButton
              key={action.label}
              icon={action.icon}
              label={action.label}
              color={action.color}
              onPress={() => navigation.navigate(action.screen)}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function ActionButton({ icon, label, onPress, color }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color + "40" }]} onPress={onPress}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: Colors.bg },
  content    : { padding: 16, paddingBottom: 32 },
  center     : { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { color: Colors.textSecondary, marginTop: 12, fontSize: 14 },
  errorIcon  : { fontSize: 40, marginBottom: 8 },
  errorText  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "700", marginBottom: 4 },
  errorSub   : { color: Colors.textSecondary, fontSize: 13, marginBottom: 20, textAlign: "center" },
  retryBtn   : { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText  : { color: "#fff", fontWeight: "700" },

  // Header
  header    : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting  : { color: Colors.textPrimary, fontSize: 22, fontWeight: "800" },
  date      : { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  sellyBadge: { backgroundColor: Colors.primary + "22", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary + "44" },
  sellyText : { color: Colors.primary, fontWeight: "800", fontSize: 15, letterSpacing: 1 },

  // Revenue card
  revenueCard  : { backgroundColor: Colors.primary, borderRadius: 16, padding: 20, marginBottom: 20 },
  revenueLabel : { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600", marginBottom: 4 },
  revenueAmount: { color: "#fff", fontSize: 34, fontWeight: "900" },
  revenueTotal : { color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 4 },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },

  // Section
  section      : { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle : { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 12 },
  seeAll       : { color: Colors.primary, fontSize: 13, fontWeight: "600" },
  emptyBox     : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 24, alignItems: "center" },
  emptyText    : { color: Colors.textMuted, fontSize: 14 },

  // Actions
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  actionIcon: { fontSize: 22, marginBottom: 4 },
  actionLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
});
