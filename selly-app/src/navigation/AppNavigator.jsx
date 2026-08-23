// ── App Navigator ─────────────────────────────────────────────────────────────
// Auth-gated:
//   • No user                    → LoginScreen
//   • User, no business type set → BusinessTypeSetupScreen (first-time onboarding)
//   • User + business type set   → MainDrawer (left sidebar)
//
// Selly is food-only: cafe / bakery / cloudkitchen. See src/lib/businessTypes.js.
//
// Drawer route names are STATIC (Orders / Catalog / Customers) and only their
// visible labels change per business type. Route names used to be the labels
// themselves, which meant navigate("Menu") worked in one sector and threw in
// another — that whole class of bug is gone.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
  useWindowDimensions,
} from "react-native";
import { NavigationContainer }            from "@react-navigation/native";
import { createDrawerNavigator, DrawerContentScrollView } from "@react-navigation/drawer";
import { createStackNavigator }           from "@react-navigation/stack";
import { useNavigation, useFocusEffect }  from "@react-navigation/native";
import * as Clipboard                     from "expo-clipboard";
import { Ionicons }                       from "@expo/vector-icons";

import { Colors }  from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import { typeConfig } from "../lib/businessTypes";

import LoginScreen           from "../screens/LoginScreen";
import DashboardScreen       from "../screens/DashboardScreen";
import HomeScreen            from "../screens/HomeScreen";
import PaymentsScreen        from "../screens/PaymentsScreen";
import OrdersScreen          from "../screens/OrdersScreen";
import CatalogScreen         from "../screens/CatalogScreen";
import CakeOrdersScreen      from "../screens/CakeOrdersScreen";
import CakeMenuScreen        from "../screens/CakeMenuScreen";
import PrepQueueScreen       from "../screens/PrepQueueScreen";
import ScheduledScreen       from "../screens/ScheduledScreen";
import PackagesScreen        from "../screens/PackagesScreen";
import NewOrderScreen        from "../screens/NewOrderScreen";
import RatingsScreen         from "../screens/RatingsScreen";
import DeliveryScreen        from "../screens/DeliveryScreen";
import CustomersScreen       from "../screens/CustomersScreen";
import PromotionsScreen      from "../screens/PromotionsScreen";
import BillingScreen         from "../screens/BillingScreen";
import SettingsScreen        from "../screens/SettingsScreen";
import PhotoInquiriesScreen  from "../screens/PhotoInquiriesScreen";
import QueryInboxScreen      from "../screens/QueryInboxScreen";
import ReturnsScreen         from "../screens/ReturnsScreen";
import AdminScreen           from "../screens/AdminScreen";
import BusinessTypeSetupScreen from "../screens/BusinessTypeSetupScreen";
// Finance screens
import AccountingScreen      from "../screens/AccountingScreen";
import PayrollScreen         from "../screens/PayrollScreen";

const ADMIN_EMAIL = "codeforeai.app@gmail.com";

const Drawer     = createDrawerNavigator();
const RootStack  = createStackNavigator();
const MoreStack_ = createStackNavigator();

// ── Screen components per business type ───────────────────────────────────────
// businessTypes.js holds the labels, icons and flags but deliberately imports no
// screens (it gets pulled into screens themselves, and an import cycle through
// the navigator would be the result). The component wiring lives here.
const TYPE_SCREENS = {
  cafe        : { orders: OrdersScreen,     catalog: CatalogScreen  },
  bakery      : { orders: CakeOrdersScreen, catalog: CakeMenuScreen },
  cloudkitchen: { orders: OrdersScreen,     catalog: CatalogScreen  },
};

// ── More Stack ────────────────────────────────────────────────────────────────
function MoreStack({ industry }) {
  const cfg = typeConfig(industry);
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

      {/* Orders / Cake Orders — routed by business type */}
      <MoreStack_.Screen
        name="OrdersHub"
        component={(TYPE_SCREENS[cfg.id] || TYPE_SCREENS.cafe).orders}
        options={{ title: cfg.orders.label }}
      />

      {/* Dashboard summary */}
      <MoreStack_.Screen name="Dashboard"      component={DashboardScreen}           options={{ title: "Dashboard" }} />

      {/* Marketing & CRM */}
      <MoreStack_.Screen name="Promotions"     component={PromotionsScreen}          options={{ title: "Promotions" }} />
      <MoreStack_.Screen name="QueryInbox"     component={QueryInboxScreen}          options={{ title: "Query Inbox" }} />
      <MoreStack_.Screen name="PhotoInquiries" component={PhotoInquiriesScreen}      options={{ title: "Photo Inquiries" }} />
      <MoreStack_.Screen name="Returns"        component={ReturnsScreen}             options={{ title: "Complaints & Refunds" }} />

      {/* Finance */}
      <MoreStack_.Screen name="Accounting"   component={AccountingScreen}   options={{ title: "Accounting & Reports" }} />
      <MoreStack_.Screen name="Payroll"      component={PayrollScreen}      options={{ title: "Payroll & Staff" }} />

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
  const cfg         = typeConfig(industry);

  const sections = [
    {
      title: "Transactions",
      items: [
        { icon: cfg.icon, label: cfg.orders.label, desc: `Manage all ${cfg.orders.label.toLowerCase()} and update status`, screen: "OrdersHub" },
        { icon: "🏠", label: "Dashboard",      desc: "Sales summary, revenue charts, quick stats",          screen: "Dashboard"      },
      ],
    },
    {
      title: "Marketing",
      items: [
        { icon: "⚡", label: "Promotions",      desc: "Flash sale, segments, abandoned cart",               screen: "Promotions"     },
        { icon: "💬", label: "Query Inbox",     desc: "Customer questions & product requests",              screen: "QueryInbox"     },
        { icon: "📷", label: "Photo Inquiries", desc: "Customer image search requests",                     screen: "PhotoInquiries" },
        { icon: "⚠️", label: "Complaints",      desc: "Problems with an order — refund, credit or remake",  screen: "Returns"        },
      ],
    },
    {
      title: "Finance",
      items: [
        { icon: "📊", label: "Accounting",      desc: "Expenses, P&L, GST reports, supplier ledger",       screen: "Accounting"     },
        { icon: "💰", label: "Payroll",          desc: "Staff, attendance, salary & payslips",              screen: "Payroll"        },
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
        {/* A plan-tier badge used to sit here reading "TRIAL · 14d". There is no
            trial and there are no tiers now — billing is ₹1,000 once plus ₹20
            per completed order — so it was showing something untrue. */}
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
  const { user, profile, signOut, updateWhatsappNumber } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [waNumber, setWaNumber] = useState(profile?.whatsapp_number || "");
  const [saving,   setSaving]   = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

  const businessId = profile?.business_id || "—";
  // "Connected" now means a WhatsApp number is actually set, which is what the
  // block below has always really been about. It used to be gated on a plan
  // tier, so a paying kitchen with no number configured was told it was
  // connected when it was not.
  const isActive   = !!(profile?.whatsapp_number || "").trim();

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
        {/* The real terms, rather than a tier that no longer exists. */}
        <View style={[styles.planBadge, styles.planBadgeActive]}>
          <Text style={styles.planTextActive}>₹1,000 once + ₹20 per order</Text>
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

// ── Sidebar (left drawer) ─────────────────────────────────────────────────────
// Permanent sidebar on wide screens (tablet / desktop web), slide-out drawer on
// phones — the hamburger in the header opens it.
function SidebarContent(props) {
  const { state, navigation, navMeta } = props;
  const { profile } = useAuth();
  const active = state.routeNames[state.index];

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.sbScroll}>
      {/* Brand */}
      <View style={styles.sbBrand}>
        <View style={styles.sbLogo}>
          <Ionicons name="chatbubbles" size={17} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sbName}>selly<Text style={{ color: Colors.green }}>.</Text></Text>
          <Text style={styles.sbTag} numberOfLines={1}>
            {profile?.business_name || "My Business"}
          </Text>
        </View>
      </View>

      {/* Nav items */}
      <View style={styles.sbNav}>
        {state.routeNames.map(name => {
          const on   = name === active;
          const meta = navMeta[name] || { label: name, icon: "ellipse" };
          return (
            <TouchableOpacity
              key={name}
              style={[styles.sbItem, on && styles.sbItemOn]}
              onPress={() => navigation.navigate(name)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={meta.icon + (on ? "" : "-outline")}
                size={17}
                color={on ? "#fff" : Colors.textSecondary}
              />
              <Text style={[styles.sbLabel, on && styles.sbLabelOn]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </DrawerContentScrollView>
  );
}

// ── Main app — left sidebar navigation ────────────────────────────────────────
function MainDrawer({ industry }) {
  const cfg = typeConfig(industry);
  const ind = cfg.id;
  const { width } = useWindowDimensions();
  const permanent = width >= 1024;

  const screens = TYPE_SCREENS[ind] || TYPE_SCREENS.cafe;

  const MoreStackWithIndustry = React.useCallback(
    () => <MoreStack industry={ind} />,
    [ind]
  );

  // Route name → sidebar label + icon. Route names stay constant across business
  // types; only what the owner reads changes.
  const navMeta = React.useMemo(() => ({
    Home     : { label: "Home",              icon: "home"       },
    NewOrder : { label: "New order",         icon: "add-circle" },
    Kitchen  : { label: "Kitchen",           icon: "flame"      },
    Scheduled: { label: "Scheduled",         icon: "calendar"   },
    Members  : { label: "Members",           icon: "star"       },
    Delivery : { label: "Delivery",          icon: "bicycle"    },
    Ratings  : { label: "Ratings",           icon: "happy"      },
    Orders   : { label: cfg.orders.label,    icon: cfg.orders.icon    },
    Catalog  : { label: cfg.catalog.label,   icon: cfg.catalog.icon   },
    Customers: { label: cfg.customers.label, icon: cfg.customers.icon },
    Payments : { label: "Payments",          icon: "card"       },
    Reports  : { label: "Reports",           icon: "bar-chart"  },
    Settings : { label: "Settings",          icon: "settings"   },
    More     : { label: "More",              icon: "grid"       },
  }), [cfg]);

  return (
    <Drawer.Navigator
      drawerContent={props => <SidebarContent {...props} navMeta={navMeta} />}
      screenOptions={{
        drawerType : permanent ? "permanent" : "front",
        drawerStyle: {
          backgroundColor: Colors.bgCard,
          borderRightColor: Colors.border,
          borderRightWidth: 1,
          width: 226,
        },
        headerStyle: {
          backgroundColor: Colors.bg,
          elevation: 0, shadowOpacity: 0,
          borderBottomWidth: 1, borderBottomColor: Colors.border,
        },
        headerTintColor : Colors.textPrimary,
        headerTitleStyle: { fontWeight: "700", fontSize: 17, color: Colors.textPrimary },
        sceneContainerStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Drawer.Screen name="Home"      component={HomeScreen}      options={{ title: "Dashboard" }} />
      {/* With no customer-facing page in phase 1, typing an order in IS the way
          orders arrive — so it sits at the top, not behind More. */}
      {cfg.hasPrepQueue && (
        <Drawer.Screen name="NewOrder" component={NewOrderScreen} options={{ title: "New order" }} />
      )}
      {/* The kitchen screen sits right after Home for a cloud kitchen — it's the
          screen they'll have open all service, so it shouldn't be buried. */}
      {cfg.hasPrepQueue && (
        <Drawer.Screen name="Kitchen" component={PrepQueueScreen} options={{ title: "Kitchen" }} />
      )}
      {/* Scheduled sits beside the Kitchen, not under More: the whole value of
          taking an order early is seeing it early, and a buried screen doesn't
          get looked at the night before. */}
      {cfg.hasScheduling && (
        <Drawer.Screen name="Scheduled" component={ScheduledScreen} options={{ title: "Scheduled" }} />
      )}
      {cfg.hasScheduling && (
        <Drawer.Screen name="Members" component={PackagesScreen} options={{ title: "Members" }} />
      )}
      {/* Ratings sits in the drawer rather than under More: an unhappy customer
          is time-sensitive, and a screen nobody opens is where they get lost. */}
      {cfg.hasPrepQueue && (
        <Drawer.Screen name="Delivery" component={DeliveryScreen} options={{ title: "Delivery" }} />
      )}
      {cfg.hasPrepQueue && (
        <Drawer.Screen name="Ratings" component={RatingsScreen} options={{ title: "Ratings" }} />
      )}
      <Drawer.Screen name="Orders"    component={screens.orders}  options={{ title: cfg.orders.label }} />
      <Drawer.Screen name="Catalog"   component={screens.catalog} options={{ title: cfg.catalog.label }} />
      <Drawer.Screen name="Customers" component={CustomersScreen} options={{ title: cfg.customers.label }} />
      <Drawer.Screen name="Payments" component={PaymentsScreen}   options={{ title: "Payments" }} />
      <Drawer.Screen name="Reports"  component={AccountingScreen} options={{ title: "Reports" }} />
      <Drawer.Screen name="Settings" component={SettingsScreen}   options={{ title: "Settings" }} />
      <Drawer.Screen name="More"     component={MoreStackWithIndustry} options={{ headerShown: false }} />
    </Drawer.Navigator>
  );
}

// ── Root Navigator — auth + industry gated ────────────────────────────────────
export default function AppNavigator() {
  const { user, loading, industry, industryLoading, updateIndustry } = useAuth();

  // Memoize the tabs component so React Navigation doesn't remount on re-render
  const MainTabsComponent = React.useMemo(
    () => function IndustryTabs() { return <MainDrawer industry={industry} />; },
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

  // ── Business-type onboarding (logged in, nothing valid stored yet) ────────
  if (user && !industryLoading && !industry) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <BusinessTypeSetupScreen onIndustrySet={(ind) => updateIndustry(ind)} />
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
  // ── Sidebar ───────────────────────────────────────────────
  sbScroll : { paddingTop: 0 },
  sbBrand  : { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sbLogo   : { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  sbName   : { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "800", letterSpacing: -0.2 },
  sbTag    : { color: Colors.textMuted, fontSize: 10.5, marginTop: 1 },
  sbNav    : { paddingHorizontal: 8, paddingTop: 10, gap: 2 },
  sbItem   : { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10 },
  sbItemOn : { backgroundColor: Colors.primary },
  sbLabel  : { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  sbLabelOn: { color: "#fff", fontWeight: "700" },

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
