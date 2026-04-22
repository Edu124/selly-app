// ── App Navigator ─────────────────────────────────────────────────────────────
// Auth-gated: shows LoginScreen if not signed in, main tabs if signed in.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator }     from "@react-navigation/stack";
import { useNavigation }            from "@react-navigation/native";

import { Colors }        from "../constants/colors";
import { useAuth }       from "../context/AuthContext";

import LoginScreen      from "../screens/LoginScreen";
import DashboardScreen  from "../screens/DashboardScreen";
import OrdersScreen     from "../screens/OrdersScreen";
import CatalogScreen    from "../screens/CatalogScreen";
import CustomersScreen  from "../screens/CustomersScreen";
import PromotionsScreen from "../screens/PromotionsScreen";
import BillingScreen    from "../screens/BillingScreen";
import SettingsScreen   from "../screens/SettingsScreen";

const Tab        = createBottomTabNavigator();
const RootStack  = createStackNavigator();
const MoreStack_ = createStackNavigator();

const TAB_ICONS = {
  Dashboard : "🏠",
  Orders    : "📦",
  Catalog   : "🛍️",
  Customers : "👥",
  More      : "☰",
};

// ── More Stack ────────────────────────────────────────────────────────────────
function MoreStack() {
  return (
    <MoreStack_.Navigator
      screenOptions={{
        headerStyle     : { backgroundColor: Colors.bg, elevation: 0, shadowOpacity: 0 },
        headerTintColor : Colors.textPrimary,
        headerTitleStyle: { fontWeight: "800", color: Colors.textPrimary },
        cardStyle       : { backgroundColor: Colors.bg },
      }}
    >
      <MoreStack_.Screen name="MoreHub"    component={MoreHubScreen}    options={{ title: "More" }} />
      <MoreStack_.Screen name="Promotions" component={PromotionsScreen} options={{ title: "Promotions" }} />
      <MoreStack_.Screen name="Billing"    component={BillingScreen}    options={{ title: "Billing" }} />
      <MoreStack_.Screen name="Settings"   component={SettingsScreen}   options={{ title: "Settings" }} />
      <MoreStack_.Screen name="Profile"    component={ProfileScreen}    options={{ title: "My Profile" }} />
    </MoreStack_.Navigator>
  );
}

// ── More Hub ──────────────────────────────────────────────────────────────────
function MoreHubScreen() {
  const nav     = useNavigation();
  const { user, profile } = useAuth();

  const items = [
    { icon: "⚡", label: "Promotions",   desc: "Flash sale, new arrivals, abandoned cart", screen: "Promotions" },
    { icon: "💳", label: "Billing",       desc: "Subscription, commissions, payments",      screen: "Billing"    },
    { icon: "👤", label: "My Profile",    desc: "Business ID, plan, webhook URL",            screen: "Profile"    },
    { icon: "⚙️",  label: "Settings",     desc: "Server config",                             screen: "Settings"   },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mini profile card */}
      <View style={styles.miniProfile}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {(profile?.business_name || user?.email || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.miniName}>{profile?.business_name || "My Business"}</Text>
          <Text style={styles.miniEmail}>{user?.email}</Text>
        </View>
        <View style={[
          styles.planBadge,
          profile?.plan === "pro" || profile?.plan === "team"
            ? styles.planBadgeActive
            : styles.planBadgeTrial,
        ]}>
          <Text style={[
            styles.planBadgeText,
            profile?.plan === "pro" ? styles.planTextActive : styles.planTextTrial,
          ]}>
            {(profile?.plan || "trial").toUpperCase()}
          </Text>
        </View>
      </View>

      {items.map(item => (
        <TouchableOpacity key={item.screen} style={styles.item} onPress={() => nav.navigate(item.screen)}>
          <Text style={styles.itemIcon}>{item.icon}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemDesc}>{item.desc}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Profile Screen ────────────────────────────────────────────────────────────
import * as Clipboard from "expo-clipboard";
import { useState } from "react";

function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const [copiedId,      setCopiedId]      = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const businessId  = profile?.business_id || "—";
  const webhookUrl  = `https://instagram-bot-production-ef01.up.railway.app/webhook/buyer?bid=${businessId}`;
  const daysLeft    = profile?.trial_days_left ?? 14;
  const isActive    = profile?.plan === "pro" || profile?.plan === "team";

  async function copyId() {
    await Clipboard.setStringAsync(businessId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }
  async function copyWebhook() {
    await Clipboard.setStringAsync(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Business info */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatarLg}>
          <Text style={styles.profileAvatarText}>
            {(profile?.business_name || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>{profile?.business_name || "My Business"}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
        <View style={[
          styles.planBadge,
          isActive ? styles.planBadgeActive : styles.planBadgeTrial,
        ]}>
          <Text style={isActive ? styles.planTextActive : styles.planTextTrial}>
            {isActive ? `✓ ${(profile?.plan||"pro").toUpperCase()}` : `⏱ TRIAL — ${daysLeft} days left`}
          </Text>
        </View>
      </View>

      {/* Business ID */}
      <View style={styles.credBox}>
        <Text style={styles.credLabel}>BUSINESS ID</Text>
        <View style={styles.credRow}>
          <Text style={styles.credValue} numberOfLines={1}>{businessId}</Text>
          <TouchableOpacity
            style={[styles.copyBtn, copiedId && styles.copyBtnDone]}
            onPress={copyId}
          >
            <Text style={styles.copyBtnText}>{copiedId ? "Copied ✓" : "Copy"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.credHint}>
          Enter this ID when setting up the WhatsApp webhook.
        </Text>
      </View>

      {/* Webhook URL */}
      <View style={styles.credBox}>
        <Text style={styles.credLabel}>WHATSAPP WEBHOOK URL</Text>
        <View style={styles.credRow}>
          <Text style={styles.credValueSm} numberOfLines={2}>{webhookUrl}</Text>
          <TouchableOpacity
            style={[styles.copyBtn, copiedWebhook && styles.copyBtnDone]}
            onPress={copyWebhook}
          >
            <Text style={styles.copyBtnText}>{copiedWebhook ? "Copied ✓" : "Copy"}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.credHint}>
          Paste this in Meta WhatsApp → Webhooks configuration.
        </Text>
      </View>

      {/* Upgrade prompt */}
      {!isActive && (
        <View style={styles.upgradeBox}>
          <Text style={styles.upgradeTitle}>⚡ Upgrade to Pro</Text>
          <Text style={styles.upgradeDesc}>
            ₹3,000/month · Unlimited products · Advanced analytics · Priority support
          </Text>
          <Text style={styles.upgradeContact}>Contact hello@selly.in to upgrade</Text>
        </View>
      )}

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Selly v1.0.0 · hello@selly.in</Text>
    </ScrollView>
  );
}

// ── Main Tabs ─────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>
            {TAB_ICONS[route.name] || "•"}
          </Text>
        ),
        tabBarActiveTintColor  : Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor : Colors.border,
          borderTopWidth : 1,
          paddingBottom  : 6,
          paddingTop     : 6,
          height         : 62,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        headerStyle: {
          backgroundColor: Colors.bg,
          elevation: 0, shadowOpacity: 0,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
        },
        headerTintColor  : Colors.textPrimary,
        headerTitleStyle : { fontWeight: "900", fontSize: 18, color: Colors.textPrimary },
        headerRight: () => (
          <View style={{ marginRight: 16 }}>
            <Text style={{ color: Colors.primary, fontWeight: "900", fontSize: 16, letterSpacing: 1 }}>
              selly
            </Text>
          </View>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Dashboard" }} />
      <Tab.Screen name="Orders"    component={OrdersScreen}    options={{ title: "Orders"    }} />
      <Tab.Screen name="Catalog"   component={CatalogScreen}   options={{ title: "Catalog"   }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ title: "Customers" }} />
      <Tab.Screen name="More"      component={MoreStack}       options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

// ── Root Navigator — auth-gated ───────────────────────────────────────────────
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    // Splash / loading state while checking stored session
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>Sell<Text style={{ color: Colors.primary }}>y</Text></Text>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: Colors.bg } }}>
        {user ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, gap: 10, paddingBottom: 40 },
  splash    : { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", alignItems: "center" },
  splashLogo: { fontSize: 52, fontWeight: "900", color: Colors.textPrimary },

  // More hub mini profile
  miniProfile  : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 6, gap: 12 },
  avatarCircle : { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "33", alignItems: "center", justifyContent: "center" },
  avatarText   : { color: Colors.primary, fontSize: 18, fontWeight: "900" },
  miniName     : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  miniEmail    : { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  // More hub items
  item     : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  itemIcon : { fontSize: 26, marginRight: 14 },
  itemMeta : { flex: 1 },
  itemLabel: { color: Colors.textPrimary, fontSize: 16, fontWeight: "700" },
  itemDesc : { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  chevron  : { color: Colors.textMuted, fontSize: 22 },

  // Plan badge
  planBadge      : { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  planBadgeActive: { backgroundColor: "rgba(34,197,94,0.15)" },
  planBadgeTrial : { backgroundColor: "rgba(108,71,255,0.15)" },
  planBadgeText  : { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  planTextActive : { color: "#22c55e", fontSize: 10, fontWeight: "800" },
  planTextTrial  : { color: Colors.primary, fontSize: 10, fontWeight: "800" },

  // Profile screen
  profileCard      : { backgroundColor: Colors.bgCard, borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  profileAvatarLg  : { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary + "33", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  profileAvatarText: { color: Colors.primary, fontSize: 32, fontWeight: "900" },
  profileName      : { color: Colors.textPrimary, fontSize: 20, fontWeight: "900", textAlign: "center" },
  profileEmail     : { color: Colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 10 },

  // Credentials
  credBox  : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  credLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" },
  credRow  : { flexDirection: "row", alignItems: "center", gap: 10 },
  credValue: { flex: 1, color: Colors.textPrimary, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  credValueSm: { flex: 1, color: Colors.textPrimary, fontSize: 11, fontFamily: "monospace" },
  credHint : { color: Colors.textMuted, fontSize: 11, marginTop: 8, lineHeight: 16 },
  copyBtn  : { backgroundColor: Colors.primary + "22", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary + "44" },
  copyBtnDone: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)" },
  copyBtnText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },

  // Upgrade
  upgradeBox    : { backgroundColor: "rgba(108,71,255,0.08)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.primary + "44" },
  upgradeTitle  : { color: Colors.primary, fontSize: 15, fontWeight: "800", marginBottom: 6 },
  upgradeDesc   : { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  upgradeContact: { color: Colors.primary, fontSize: 12, marginTop: 8, fontWeight: "600" },

  // Sign out
  signOutBtn : { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", marginTop: 4 },
  signOutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
  version    : { textAlign: "center", color: Colors.textMuted, fontSize: 11, marginTop: 16 },
});
