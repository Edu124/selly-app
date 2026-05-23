// ── App Navigator ─────────────────────────────────────────────────────────────
// Auth-gated:
//   • No user  → LoginScreen
//   • User, no industry set → IndustrySetupScreen (first-time onboarding)
//   • User + industry set  → 4-tab MainTabs (AI / Catalog / Customers / Settings / More)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
} from "react-native";
import { NavigationContainer }            from "@react-navigation/native";
import { createBottomTabNavigator }       from "@react-navigation/bottom-tabs";
import { createStackNavigator }           from "@react-navigation/stack";
import { useNavigation, useFocusEffect }  from "@react-navigation/native";
import * as Clipboard                     from "expo-clipboard";

import { Colors }  from "../constants/colors";
import { useAuth } from "../context/AuthContext";

import LoginScreen           from "../screens/LoginScreen";
import DashboardScreen       from "../screens/DashboardScreen";
import AIStudioScreen        from "../screens/AIStudioScreen";
import OrdersScreen          from "../screens/OrdersScreen";
import CatalogScreen         from "../screens/CatalogScreen";
import CustomersScreen       from "../screens/CustomersScreen";
import PromotionsScreen      from "../screens/PromotionsScreen";
import BillingScreen         from "../screens/BillingScreen";
import SettingsScreen        from "../screens/SettingsScreen";
import PhotoInquiriesScreen  from "../screens/PhotoInquiriesScreen";
import QueryInboxScreen      from "../screens/QueryInboxScreen";
import ClassScheduleScreen   from "../screens/ClassScheduleScreen";
import ReviewsScreen         from "../screens/ReviewsScreen";
import ReturnsScreen         from "../screens/ReturnsScreen";
import AdminScreen           from "../screens/AdminScreen";
import IndustrySetupScreen   from "../screens/IndustrySetupScreen";
// Education-specific screens
import EnrollmentsScreen     from "../screens/EnrollmentsScreen";
import CoursesScreen         from "../screens/CoursesScreen";
// Tourism-specific screens
import BookingsScreen        from "../screens/BookingsScreen";
import PackagesScreen        from "../screens/PackagesScreen";
// Kirana-specific screens
import KiranaOrdersScreen    from "../screens/KiranaOrdersScreen";
import InventoryScreen       from "../screens/InventoryScreen";
// Cakes-specific screens
import CakeOrdersScreen      from "../screens/CakeOrdersScreen";
import CakeMenuScreen        from "../screens/CakeMenuScreen";
// Ice Cream-specific screens
import IceCreamOrdersScreen  from "../screens/IceCreamOrdersScreen";
import FlavorsScreen         from "../screens/FlavorsScreen";
// Finance screens
import AccountingScreen      from "../screens/AccountingScreen";
import PayrollScreen         from "../screens/PayrollScreen";
import ScanAndSellScreen     from "../screens/ScanAndSellScreen";

const ADMIN_EMAIL = "codeforeai.app@gmail.com";

const Tab        = createBottomTabNavigator();
const RootStack  = createStackNavigator();
const MoreStack_ = createStackNavigator();

// ── Industry-aware screen config ──────────────────────────────────────────────
const INDUSTRY_CONFIG = {
  product: {
    catalog  : { name: "Catalog",   icon: "🛍️", component: CatalogScreen         },
    customers: { name: "Customers", icon: "👥", component: CustomersScreen        },
    orders   : { name: "Orders",    icon: "📦", component: OrdersScreen           },
  },
  education: {
    catalog  : { name: "Courses",     icon: "📚", component: CoursesScreen        },
    customers: { name: "Students",    icon: "👨‍🎓", component: CustomersScreen      },
    orders   : { name: "Enrollments", icon: "🎓", component: EnrollmentsScreen    },
  },
  tourism: {
    catalog  : { name: "Packages",  icon: "🌍", component: PackagesScreen         },
    customers: { name: "Travelers", icon: "🧳", component: CustomersScreen        },
    orders   : { name: "Bookings",  icon: "🗓️", component: BookingsScreen         },
  },
  kirana: {
    catalog  : { name: "Inventory", icon: "📦", component: InventoryScreen        },
    customers: { name: "Customers", icon: "👥", component: CustomersScreen        },
    orders   : { name: "Orders",    icon: "🧾", component: KiranaOrdersScreen     },
  },
  cakes: {
    catalog  : { name: "Menu",      icon: "📋", component: CakeMenuScreen         },
    customers: { name: "Customers", icon: "👥", component: CustomersScreen        },
    orders   : { name: "Orders",    icon: "🎂", component: CakeOrdersScreen       },
  },
  icecream: {
    catalog  : { name: "Flavors",      icon: "🎨", component: FlavorsScreen         },
    customers: { name: "Customers",    icon: "👥", component: CustomersScreen       },
    orders   : { name: "Orders",       icon: "🍦", component: IceCreamOrdersScreen  },
  },
  restaurant: {
    catalog  : { name: "Menu",         icon: "🍽️", component: CatalogScreen         },
    customers: { name: "Customers",    icon: "👥", component: CustomersScreen       },
    orders   : { name: "Orders",       icon: "🍕", component: OrdersScreen          },
  },
  salon: {
    catalog  : { name: "Services",     icon: "💅", component: CatalogScreen         },
    customers: { name: "Clients",      icon: "👤", component: CustomersScreen       },
    orders   : { name: "Appointments", icon: "📅", component: BookingsScreen        },
  },
  medical: {
    catalog  : { name: "Medicines",    icon: "💊", component: InventoryScreen       },
    customers: { name: "Patients",     icon: "🏥", component: CustomersScreen       },
    orders   : { name: "Orders",       icon: "🧾", component: KiranaOrdersScreen    },
  },
};

// ── Placeholder screen for features under construction ────────────────────────
function ComingSoonScreen({ route }) {
  const title = route?.params?.title || "Feature";
  const desc  = route?.params?.desc  || "This feature is coming soon.";
  const icon  = route?.params?.icon  || "🚀";
  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.bg }} contentContainerStyle={{ padding: 24, alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <Text style={{ fontSize: 64, marginBottom: 20 }}>{icon}</Text>
      <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 10 }}>{title}</Text>
      <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22, maxWidth: 280 }}>{desc}</Text>
      <View style={{ marginTop: 24, backgroundColor: Colors.primary + "22", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 1, borderColor: Colors.primary + "44" }}>
        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: "700" }}>Coming Soon</Text>
      </View>
    </ScrollView>
  );
}

// ── More Stack ────────────────────────────────────────────────────────────────
function MoreStack({ industry }) {
  const cfg = INDUSTRY_CONFIG[industry] || INDUSTRY_CONFIG.product;
  return (
    <MoreStack_.Navigator
      screenOptions={{
        headerStyle     : { backgroundColor: Colors.bg, elevation: 0, shadowOpacity: 0 },
        headerTintColor : Colors.textPrimary,
        headerTitleStyle: { fontWeight: "800", color: Colors.textPrimary },
        cardStyle       : { backgroundColor: Colors.bg },
      }}
    >
      <MoreStack_.Screen name="MoreHub"        component={MoreHubScreen}             options={{ title: "More" }} />

      {/* Orders / Enrollments / Bookings — industry-routed */}
      <MoreStack_.Screen
        name="OrdersHub"
        component={cfg.orders.component}
        options={{ title: cfg.orders.name }}
      />

      {/* Dashboard summary */}
      <MoreStack_.Screen name="Dashboard"      component={DashboardScreen}           options={{ title: "Dashboard" }} />

      {/* Marketing & CRM */}
      <MoreStack_.Screen name="Promotions"     component={PromotionsScreen}          options={{ title: "Promotions" }} />
      <MoreStack_.Screen name="QueryInbox"     component={QueryInboxScreen}          options={{ title: "Query Inbox" }} />
      <MoreStack_.Screen name="PhotoInquiries" component={PhotoInquiriesScreen}      options={{ title: "Photo Inquiries" }} />
      <MoreStack_.Screen name="Reviews"        component={ReviewsScreen}             options={{ title: "Customer Reviews" }} />
      <MoreStack_.Screen name="Returns"        component={ReturnsScreen}             options={{ title: "Returns & Refunds" }} />
      <MoreStack_.Screen name="ClassSchedule"  component={ClassScheduleScreen}       options={{ title: "Class Schedule" }} />

      {/* Finance */}
      <MoreStack_.Screen name="Accounting"   component={AccountingScreen}   options={{ title: "Accounting & Reports" }} />
      <MoreStack_.Screen name="Payroll"      component={PayrollScreen}      options={{ title: "Payroll & Staff" }} />
      <MoreStack_.Screen name="ScanAndSell"  component={ScanAndSellScreen}  options={{ title: "Scan & Sell" }} />

      {/* Account */}
      <MoreStack_.Screen name="Billing"        component={BillingScreen}             options={{ title: "Billing" }} />
      <MoreStack_.Screen name="Profile"        component={ProfileScreen}             options={{ title: "My Profile" }} />
      <MoreStack_.Screen name="Admin"          component={AdminScreen}               options={{ title: "Admin Panel" }} />
    </MoreStack_.Navigator>
  );
}

// ── More Hub ──────────────────────────────────────────────────────────────────
function MoreHubScreen() {
  const nav = useNavigation();
  const { user, profile, industry } = useAuth();
  const isAdminUser = user?.email === ADMIN_EMAIL;
  const cfg         = INDUSTRY_CONFIG[(industry || "").toLowerCase()] || INDUSTRY_CONFIG.product;
  const isEducation = (industry || "").toLowerCase() === "education";

  const sections = [
    {
      title: "Transactions",
      items: [
        { icon: cfg.orders.icon, label: cfg.orders.name, desc: `Manage all ${cfg.orders.name.toLowerCase()} and update status`, screen: "OrdersHub" },
        { icon: "🏠", label: "Dashboard",      desc: "Sales summary, revenue charts, quick stats",          screen: "Dashboard"      },
      ],
    },
    {
      title: "Marketing",
      items: [
        { icon: "⚡", label: "Promotions",      desc: "Flash sale, segments, abandoned cart",               screen: "Promotions"     },
        { icon: "💬", label: "Query Inbox",     desc: "Customer questions & product requests",              screen: "QueryInbox"     },
        { icon: "📷", label: "Photo Inquiries", desc: "Customer image search requests",                     screen: "PhotoInquiries" },
        { icon: "⭐", label: "Reviews",         desc: "Customer star ratings after delivery",               screen: "Reviews"        },
        { icon: "↩",  label: "Returns",         desc: "Return, refund & complaint requests",                screen: "Returns"        },
        ...(isEducation ? [{ icon: "📅", label: "Class Schedule", desc: "Schedule classes & auto-send reminders", screen: "ClassSchedule" }] : []),
      ],
    },
    {
      title: "Finance",
      items: [
        { icon: "📊", label: "Accounting",      desc: "Expenses, P&L, GST reports, supplier ledger",       screen: "Accounting"     },
        { icon: "💰", label: "Payroll",          desc: "Staff, attendance, salary & payslips",              screen: "Payroll"        },
        { icon: "📷", label: "Scan & Sell",      desc: "Barcode/SKU lookup → quick bill generation",        screen: "ScanAndSell"    },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: "💳", label: "Billing",         desc: "Subscription, commissions, payments",                screen: "Billing"        },
        { icon: "👤", label: "My Profile",      desc: "Business ID, plan, webhook URL",                    screen: "Profile"        },
        ...(isAdminUser ? [{ icon: "🔐", label: "Admin Panel", desc: "Manage client subscriptions", screen: "Admin" }] : []),
      ],
    },
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
          profile?.subscription_status === "active"  ? styles.planBadgeActive  :
          profile?.subscription_status === "expired" ? styles.planBadgeExpired :
                                                       styles.planBadgeTrial,
        ]}>
          <Text style={[
            styles.planBadgeText,
            profile?.subscription_status === "active"  ? styles.planTextActive  :
            profile?.subscription_status === "expired" ? styles.planTextExpired :
                                                         styles.planTextTrial,
          ]}>
            {profile?.subscription_status === "active"  ? "PRO"
           : profile?.subscription_status === "expired" ? "EXPIRED"
           : `TRIAL · ${profile?.trial_days_left ?? 14}d`}
          </Text>
        </View>
      </View>

      {sections.map(section => (
        <View key={section.title}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map(item => (
            <TouchableOpacity key={item.screen} style={styles.item} onPress={() => nav.navigate(item.screen)}>
              <Text style={styles.itemIcon}>{item.icon}</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ── Profile Screen ────────────────────────────────────────────────────────────
function ProfileScreen() {
  const { user, profile, signOut, updateWhatsappNumber, refreshSubscription } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [waNumber, setWaNumber] = useState(profile?.whatsapp_number || "");
  const [saving,   setSaving]   = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  // Refresh live trial countdown every time this screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshSubscription?.();
    }, [])
  );

  const businessId = profile?.business_id || "—";
  const daysLeft   = profile?.trial_days_left ?? 14;
  const isActive   = profile?.plan === "pro" || profile?.plan === "team" || profile?.subscription_status === "active";
  const isExpired  = profile?.subscription_status === "expired";

  async function copyId() {
    await Clipboard.setStringAsync(businessId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  async function saveNumber() {
    if (!waNumber.trim()) return;
    setSaving(true);
    setSavedMsg(null);
    const result = await updateWhatsappNumber(waNumber.trim());
    setSaving(false);
    if (result.ok) {
      setSavedMsg("✅ Number saved! We'll activate your WhatsApp within 24 hours.");
      setTimeout(() => setSavedMsg(null), 4000);
    } else {
      setSavedMsg("⚠️ Failed to save. Try again.");
    }
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
          isActive  ? styles.planBadgeActive  :
          isExpired ? styles.planBadgeExpired  :
                      styles.planBadgeTrial,
        ]}>
          <Text style={
            isActive  ? styles.planTextActive  :
            isExpired ? styles.planTextExpired  :
                        styles.planTextTrial
          }>
            {isActive  ? `✓ ${(profile?.plan || "pro").toUpperCase()} — Active`
           : isExpired ? `⛔ Trial Expired`
           :             `⏱ TRIAL — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
          </Text>
        </View>
      </View>

      {/* WhatsApp Connection Status */}
      {isActive ? (
        <View style={styles.connectedBox}>
          <Text style={styles.connectedIcon}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.connectedTitle}>WhatsApp Connected</Text>
            <Text style={styles.connectedNumber}>{profile?.whatsapp_number || "—"}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.activationBox}>
          <Text style={styles.activationIcon}>⏳</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.activationTitle}>Activation Pending</Text>
            <Text style={styles.activationDesc}>
              Your account is being set up. We'll connect your WhatsApp number within 24 hours and notify you.
            </Text>
          </View>
        </View>
      )}

      {/* WhatsApp Number Input */}
      <View style={styles.credBox}>
        <Text style={styles.credLabel}>YOUR WHATSAPP BUSINESS NUMBER</Text>
        <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
          Enter the phone number you want your bot to run on (with country code, e.g. +919876543210)
        </Text>
        <View style={styles.credRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0, padding: 10, fontSize: 14 }]}
            placeholder="+91 98765 43210"
            placeholderTextColor={Colors.textMuted}
            value={waNumber}
            onChangeText={setWaNumber}
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            style={[styles.copyBtn, saving && { opacity: 0.6 }]}
            onPress={saveNumber}
            disabled={saving}
          >
            <Text style={styles.copyBtnText}>{saving ? "..." : "Save"}</Text>
          </TouchableOpacity>
        </View>
        {savedMsg ? (
          <Text style={{ color: savedMsg.startsWith("✅") ? "#22c55e" : "#ef4444", fontSize: 12, marginTop: 8 }}>
            {savedMsg}
          </Text>
        ) : null}
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
        <Text style={styles.credHint}>Your unique identifier for this business account.</Text>
      </View>

      {/* How it works box */}
      {!isActive && (
        <View style={styles.howBox}>
          <Text style={styles.howTitle}>🚀 How it works</Text>
          <Text style={styles.howStep}>1️⃣  Register & enter your WhatsApp number above</Text>
          <Text style={styles.howStep}>2️⃣  Our team connects your number (within 24 hrs)</Text>
          <Text style={styles.howStep}>3️⃣  Add your products in the Catalog tab</Text>
          <Text style={styles.howStep}>4️⃣  Customers order directly via WhatsApp — bot handles everything!</Text>
          <Text style={styles.howContact}>Questions? hello@selly.in</Text>
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

// ── Main Tabs — unified 4+More structure for all industries ───────────────────
function MainTabs({ industry }) {
  const ind = (industry || "product").toLowerCase();
  const cfg = INDUSTRY_CONFIG[ind] || INDUSTRY_CONFIG.product;

  // Wrap MoreStack so it receives industry
  const MoreStackWithIndustry = React.useCallback(
    () => <MoreStack industry={ind} />,
    [ind]
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          const icons = {
            AI        : "🤖",
            [cfg.catalog.name]  : cfg.catalog.icon,
            [cfg.customers.name]: cfg.customers.icon,
            Settings  : "⚙️",
            More      : "☰",
          };
          return (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>
              {icons[route.name] || "•"}
            </Text>
          );
        },
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
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 2 },
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
      {/* Tab 1 — AI Studio */}
      <Tab.Screen
        name="AI"
        component={AIStudioScreen}
        options={{ title: "AI Studio", tabBarLabel: "AI" }}
      />

      {/* Tab 2 — Catalog (industry label) */}
      <Tab.Screen
        name={cfg.catalog.name}
        component={cfg.catalog.component}
        options={{ title: cfg.catalog.name }}
      />

      {/* Tab 3 — Customers (industry label) */}
      <Tab.Screen
        name={cfg.customers.name}
        component={cfg.customers.component}
        options={{ title: cfg.customers.name }}
      />

      {/* Tab 4 — Settings (direct) */}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />

      {/* Tab 5 — More (orders, dashboard, promotions, finance…) */}
      <Tab.Screen
        name="More"
        component={MoreStackWithIndustry}
        options={{ headerShown: false, tabBarLabel: "More" }}
      />
    </Tab.Navigator>
  );
}

// ── Root Navigator — auth + industry gated ────────────────────────────────────
export default function AppNavigator() {
  const { user, loading, industry, industryLoading, updateIndustry } = useAuth();

  // Memoize the tabs component so React Navigation doesn't remount on re-render
  const MainTabsComponent = React.useMemo(
    () => function IndustryTabs() { return <MainTabs industry={industry} />; },
    [industry]
  );

  // ── Splash (auth check or industry fetch in progress) ────────────────────
  if (loading || (user && industryLoading)) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>Sell<Text style={{ color: Colors.primary }}>y</Text></Text>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  // ── Industry onboarding (logged in but no industry chosen yet) ───────────
  if (user && !industryLoading && !industry) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <IndustrySetupScreen onIndustrySet={(ind) => updateIndustry(ind)} />
      </View>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: Colors.bg } }}>
        {user ? (
          <RootStack.Screen name="Main" component={MainTabsComponent} />
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

  // Section headers in More hub
  sectionTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },

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
  planBadge       : { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  planBadgeActive : { backgroundColor: "rgba(34,197,94,0.15)" },
  planBadgeTrial  : { backgroundColor: "rgba(108,71,255,0.15)" },
  planBadgeExpired: { backgroundColor: "rgba(239,68,68,0.15)" },
  planBadgeText   : { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  planTextActive  : { color: "#22c55e", fontSize: 10, fontWeight: "800" },
  planTextTrial   : { color: Colors.primary, fontSize: 10, fontWeight: "800" },
  planTextExpired : { color: "#ef4444", fontSize: 10, fontWeight: "800" },

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
  credHint : { color: Colors.textMuted, fontSize: 11, marginTop: 8, lineHeight: 16 },
  copyBtn  : { backgroundColor: Colors.primary + "22", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary + "44" },
  copyBtnDone: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)" },
  copyBtnText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },

  // WhatsApp connected
  connectedBox   : { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", gap: 12 },
  connectedIcon  : { fontSize: 28 },
  connectedTitle : { color: "#22c55e", fontSize: 14, fontWeight: "800" },
  connectedNumber: { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 2 },

  // Activation pending
  activationBox  : { flexDirection: "row", alignItems: "flex-start", backgroundColor: "rgba(234,179,8,0.08)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(234,179,8,0.25)", gap: 12 },
  activationIcon : { fontSize: 26 },
  activationTitle: { color: "#eab308", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  activationDesc : { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },

  // How it works
  howBox    : { backgroundColor: "rgba(108,71,255,0.08)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.primary + "44" },
  howTitle  : { color: Colors.primary, fontSize: 14, fontWeight: "800", marginBottom: 10 },
  howStep   : { color: Colors.textSecondary, fontSize: 13, lineHeight: 22 },
  howContact: { color: Colors.primary, fontSize: 12, marginTop: 10, fontWeight: "600" },

  // Input
  input: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontSize: 15 },

  // Sign out
  signOutBtn : { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", marginTop: 4 },
  signOutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
  version    : { textAlign: "center", color: Colors.textMuted, fontSize: 11, marginTop: 16 },
});
