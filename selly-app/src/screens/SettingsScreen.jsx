import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Switch,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Colors } from "../constants/colors";
import { getServerUrl, saveServerUrl, fetchBusinessSettings, saveBusinessSettings } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { scheduleConfig } from "../lib/scheduling";
import { friendlyError } from "../lib/errors";
import { BUSINESS_TYPE_LIST } from "../lib/businessTypes";
import {
  loadStoreConfig, saveStoreConfig, storeOpenState, DAY_SHORT,
} from "../lib/storeStatus";
import { resetDevOrders, clearDevSideData } from "../lib/devStore";

const DEFAULT_SETTINGS = {
  business_name: "", business_gst_no: "", business_address: "",
  gst_enabled: true, gst_rate: "5", delivery_charge: "49",
  free_above: "999", cod_fee: "30",
  whatsapp_number: "", bot_whatsapp: "", whatsapp_enabled: false, instagram_enabled: false,
  instagram_access_token: "", instagram_account_id: "",
  shiprocket_email: "", shiprocket_password: "", delhivery_api_key: "",
  // AI Discovery fields
  instagram_handle: "", city: "",
  // Online payment details (UPI / bank transfer)
  upi_id: "", bank_details: "",
  // Bot customisation
  greeting_message: "", location_url: "",
  // AI FAQ context
  faq_text: "",
  // Return / refund policy shown on shop page
  return_policy: "",
  // Payment methods offered to web customers: "both" | "cod_only" | "online_only"
  payment_modes: "both",
};

const INDUSTRY_OPTIONS = BUSINESS_TYPE_LIST.map(t => ({
  id: t.id, icon: t.icon, label: t.title,
}));

export default function SettingsScreen() {
  const { industry: activeIndustry, updateIndustry, profile } = useAuth();
  const [serverUrl, setServerUrl]   = useState("");
  const [saved, setSaved]           = useState(false);
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [industrySaving, setIndustrySaving] = useState(false);

  const [biz, setBiz]         = useState(DEFAULT_SETTINGS);
  const [bizSaving, setBizSaving] = useState(false);
  const [bizSaved, setBizSaved]   = useState(false);

  useEffect(() => {
    getServerUrl().then(url => setServerUrl(url));
    // profile.business_name comes from Supabase auth metadata (set at signup)
    // and is used as a fallback if business_settings hasn't been written yet.
    const profileName = profile?.business_name || "";
    fetchBusinessSettings()
      .then(d => {
        if (d?.settings && d.settings.business_id) {
          const s = d.settings;
          setBiz({
            business_name     : s.business_name       || profileName,
            business_gst_no   : s.business_gst_no     || "",
            business_address  : s.business_address    || "",
            gst_enabled       : s.gst_enabled !== false && s.gst_enabled !== "false" && s.gst_enabled !== 0,
            gst_rate          : String(s.gst_rate          ?? 5),
            delivery_charge   : String(s.delivery_charge   ?? 49),
            free_above        : String(s.free_above         ?? 999),
            cod_fee           : String(s.cod_fee            ?? 30),
            whatsapp_number        : s.whatsapp_number        || "",
            bot_whatsapp           : s.bot_whatsapp           || "",
            whatsapp_enabled       : s.whatsapp_enabled  === true || s.whatsapp_enabled  === "true",
            instagram_enabled      : s.instagram_enabled === true || s.instagram_enabled === "true",
            instagram_access_token : s.instagram_access_token || "",
            instagram_account_id   : s.instagram_account_id   || "",
            shiprocket_email  : s.shiprocket_email    || "",
            shiprocket_password: s.shiprocket_password || "",
            delhivery_api_key : s.delhivery_api_key   || "",
            upi_id            : s.upi_id              || "",
            bank_details      : s.bank_details        || "",
            instagram_handle  : s.instagram_handle    || "",
            city              : s.city               || "",
            greeting_message  : s.greeting_message    || "",
            location_url      : s.location_url        || "",
            faq_text          : s.faq_text            || "",
            return_policy     : s.return_policy       || "",
            payment_modes     : s.payment_modes       || "both",
          });
        }
      })
      .catch(() => {});
  }, []);

  const setBizField = (k, v) => setBiz(b => ({ ...b, [k]: v }));

  const saveBiz = async () => {
    setBizSaving(true);
    try {
      await saveBusinessSettings({
        business_name      : biz.business_name.trim(),
        business_gst_no    : biz.business_gst_no.trim(),
        business_address   : biz.business_address.trim(),
        gst_enabled        : biz.gst_enabled,
        gst_rate           : biz.gst_rate        === "" ? 5   : Number(biz.gst_rate),
        delivery_charge    : biz.delivery_charge === "" ? 49  : Number(biz.delivery_charge),
        free_above         : biz.free_above      === "" ? 999 : Number(biz.free_above),
        cod_fee            : biz.cod_fee         === "" ? 30  : Number(biz.cod_fee),
        instagram_handle   : biz.instagram_handle.trim(),
        city               : biz.city.trim(),
        whatsapp_number    : biz.whatsapp_number.trim(),
        bot_whatsapp       : biz.bot_whatsapp.trim(),
        whatsapp_enabled        : biz.whatsapp_enabled,
        instagram_enabled       : biz.instagram_enabled,
        instagram_access_token  : biz.instagram_access_token.trim(),
        instagram_account_id    : biz.instagram_account_id.trim(),
        shiprocket_email   : biz.shiprocket_email.trim(),
        shiprocket_password: biz.shiprocket_password.trim(),
        delhivery_api_key  : biz.delhivery_api_key.trim(),
        upi_id             : biz.upi_id.trim(),
        bank_details       : biz.bank_details.trim(),
        greeting_message   : biz.greeting_message.trim(),
        location_url       : biz.location_url.trim(),
        faq_text           : biz.faq_text.trim(),
        return_policy      : biz.return_policy.trim(),
        payment_modes      : biz.payment_modes || "both",
      });
      setBizSaved(true);
      setTimeout(() => setBizSaved(false), 2000);
    } catch (e) {
      Alert.alert("Error", friendlyError(e));
    } finally {
      setBizSaving(false);
    }
  };

  const save = async () => {
    const url = serverUrl.trim().replace(/\/$/, "");
    await saveServerUrl(url);
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const testConnection = async () => {
    const url = serverUrl.trim().replace(/\/$/, "");
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(`${url}/`);
      if (resp.ok) {
        setTestResult({ ok: true, msg: "✅ Connected successfully!" });
      } else {
        setTestResult({ ok: false, msg: `❌ Server responded with ${resp.status}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: "❌ " + friendlyError(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Server config */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌐 Server URL</Text>
        <Text style={styles.cardDesc}>
          Your Selly server URL. This is pre-configured — only change it if instructed by support.
        </Text>

        <Text style={styles.fieldLabel}>Backend URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://localhost:3000"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {testResult && (
          <View style={[styles.testResult, { backgroundColor: testResult.ok ? Colors.green + "22" : Colors.red + "22" }]}>
            <Text style={{ color: testResult.ok ? Colors.green : Colors.red, fontWeight: "600" }}>
              {testResult.msg}
            </Text>
          </View>
        )}

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.testBtn, testing && styles.btnDisabled]}
            onPress={testConnection}
            disabled={testing}
          >
            {testing ? <ActivityIndicator color={Colors.primary} size="small" /> : <Text style={styles.testBtnText}>Test</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, saved && { backgroundColor: Colors.green }]}
            onPress={save}
          >
            <Text style={styles.saveBtnText}>{saved ? "Saved ✓" : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.resetBtn}
          onPress={async () => {
            const { getServerUrl: _ , saveServerUrl } = await import("../lib/api");
            const DEFAULT = "https://instagram-bot-production-04ae.up.railway.app";
            await saveServerUrl(DEFAULT);
            setServerUrl(DEFAULT);
            setTestResult({ ok: true, msg: "✅ Reset to default server URL" });
          }}
        >
          <Text style={styles.resetBtnText}>↺ Reset to Default</Text>
        </TouchableOpacity>
      </View>

      {/* Business Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏪 Business Settings</Text>
        <Text style={styles.cardDesc}>Configure your billing details, taxes, and charges shown to customers.</Text>

        <Text style={styles.fieldLabel}>Business Name</Text>
        <TextInput style={styles.input} value={biz.business_name} onChangeText={v => setBizField("business_name", v)} placeholder="Your Store Name" placeholderTextColor={Colors.textMuted} />

        <Text style={styles.fieldLabel}>City</Text>
        <Text style={styles.fieldHint}>Used to generate your public shop page URL on selly.codeforgeai.app</Text>
        <TextInput style={styles.input} value={biz.city} onChangeText={v => setBizField("city", v)} placeholder="Mumbai" placeholderTextColor={Colors.textMuted} />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Instagram Handle</Text>
        <Text style={styles.fieldHint}>Customers on your shop page can tap "Message on Instagram" to DM you</Text>
        <TextInput style={styles.input} value={biz.instagram_handle} onChangeText={v => setBizField("instagram_handle", v)} placeholder="@yourshop" placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} />

        <View style={[styles.paymentNote, { marginTop: 12, marginBottom: 4 }]}>
          <Text style={styles.paymentNoteText}>
            🌐 Once saved, your shop page goes live at{"\n"}
            selly.codeforgeai.app/shop/your-store-name — discoverable by Google &amp; AI platforms.
          </Text>
        </View>

        <View style={styles.sectionDivider} />

        <Text style={styles.fieldLabel}>GST Number</Text>
        <TextInput style={styles.input} value={biz.business_gst_no} onChangeText={v => setBizField("business_gst_no", v)} placeholder="22AAAAA0000A1Z5" placeholderTextColor={Colors.textMuted} autoCapitalize="characters" />

        <Text style={styles.fieldLabel}>Business Address</Text>
        <TextInput style={[styles.input, { height: 70, textAlignVertical: "top" }]} value={biz.business_address} onChangeText={v => setBizField("business_address", v)} placeholder="Shop address for invoices" placeholderTextColor={Colors.textMuted} multiline />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>GST on Orders</Text>
            <Text style={styles.switchDesc}>Charge GST on every order</Text>
          </View>
          <Switch
            value={biz.gst_enabled}
            onValueChange={v => setBizField("gst_enabled", v)}
            trackColor={{ false: Colors.border, true: Colors.primary + "88" }}
            thumbColor={biz.gst_enabled ? Colors.primary : Colors.textMuted}
          />
        </View>

        {biz.gst_enabled && (
          <>
            <Text style={styles.fieldLabel}>GST Rate (%)</Text>
            <TextInput style={styles.input} value={biz.gst_rate} onChangeText={v => setBizField("gst_rate", v)} keyboardType="numeric" placeholder="5" placeholderTextColor={Colors.textMuted} />
          </>
        )}

        <Text style={styles.fieldLabel}>Delivery Charge (₹)</Text>
        <TextInput style={styles.input} value={biz.delivery_charge} onChangeText={v => setBizField("delivery_charge", v)} keyboardType="numeric" placeholder="49" placeholderTextColor={Colors.textMuted} />

        <Text style={styles.fieldLabel}>Free Delivery Above (₹)</Text>
        <TextInput style={styles.input} value={biz.free_above} onChangeText={v => setBizField("free_above", v)} keyboardType="numeric" placeholder="999" placeholderTextColor={Colors.textMuted} />

        <Text style={styles.fieldLabel}>COD Extra Charge (₹)</Text>
        <TextInput style={styles.input} value={biz.cod_fee} onChangeText={v => setBizField("cod_fee", v)} keyboardType="numeric" placeholder="30" placeholderTextColor={Colors.textMuted} />

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Payment Methods on Shop Page</Text>
        <Text style={styles.fieldHint}>Which payment options to offer customers when they checkout online</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {[
            { val: "both",        label: "COD + Online" },
            { val: "cod_only",    label: "COD Only"     },
            { val: "online_only", label: "Online Only"  },
          ].map(opt => (
            <TouchableOpacity key={opt.val}
              onPress={() => setBizField("payment_modes", opt.val)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                borderWidth: 1.5,
                borderColor: biz.payment_modes === opt.val ? Colors.primary : Colors.border,
                backgroundColor: biz.payment_modes === opt.val ? Colors.primary + "18" : Colors.bgInput,
              }}>
              <Text style={{
                fontSize: 12, fontWeight: "700",
                color: biz.payment_modes === opt.val ? Colors.primary : Colors.textSecondary,
              }}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Your Personal WhatsApp Number</Text>
        <Text style={styles.fieldHint}>Complex customer queries are forwarded to this number</Text>
        <TextInput style={styles.input} value={biz.whatsapp_number} onChangeText={v => setBizField("whatsapp_number", v)} placeholder="+919876543210" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>WhatsApp Bot Number</Text>
        <Text style={styles.fieldHint}>The Meta API number customers contact on your shop page</Text>
        <TextInput style={styles.input} value={biz.bot_whatsapp} onChangeText={v => setBizField("bot_whatsapp", v)} placeholder="+919876543210" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

        <View style={styles.sectionDivider} />
        <Text style={[styles.cardTitle, { marginBottom: 4 }]}>📡 Active Channels</Text>
        <Text style={styles.cardDesc}>Choose which channels your bot is active on. Only enabled channels will show contact buttons on your shop page.</Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <View>
            <Text style={styles.fieldLabel}>WhatsApp Bot</Text>
            <Text style={styles.fieldHint}>Customers can order via WhatsApp</Text>
          </View>
          <Switch value={biz.whatsapp_enabled} onValueChange={v => setBizField("whatsapp_enabled", v)} trackColor={{ true: Colors.primary }} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <View>
            <Text style={styles.fieldLabel}>Instagram Bot</Text>
            <Text style={styles.fieldHint}>Customers can order via Instagram DM</Text>
          </View>
          <Switch value={biz.instagram_enabled} onValueChange={v => setBizField("instagram_enabled", v)} trackColor={{ true: Colors.primary }} />
        </View>

        {biz.instagram_enabled && (
          <>
            <View style={{ backgroundColor: "rgba(225,48,108,0.08)", borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "rgba(225,48,108,0.25)" }}>
              <Text style={{ color: "#E1306C", fontSize: 12, fontWeight: "800", marginBottom: 4 }}>📲 What these credentials power:</Text>
              <Text style={{ color: "#E1306C", fontSize: 11, lineHeight: 17 }}>
                {"• Instagram DM bot (customers can order via DM)\n• AI Studio → Post to Instagram (publish images & Reels directly from the app)\n• Shop page — show latest Instagram posts"}
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Instagram Account ID</Text>
            <Text style={styles.fieldHint}>Numeric ID of your Instagram Business account. Find it: Meta Business Suite → Instagram Account → About → Instagram ID.</Text>
            <TextInput style={styles.input} value={biz.instagram_account_id} onChangeText={v => setBizField("instagram_account_id", v)} placeholder="17841459744700340" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Instagram Access Token</Text>
            <Text style={styles.fieldHint}>{"Long-lived access token from Meta Graph API Explorer.\nNeeds permission: instagram_content_publish\nGet it at: developers.facebook.com/tools/explorer"}</Text>
            <TextInput style={[styles.input, { fontSize: 11 }]} value={biz.instagram_access_token} onChangeText={v => setBizField("instagram_access_token", v)} placeholder="EAAxxxxx..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={2} />

            <TouchableOpacity
              style={{ backgroundColor: "rgba(225,48,108,0.1)", borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: "rgba(225,48,108,0.3)", flexDirection: "row", alignItems: "center", gap: 8 }}
              onPress={() => Alert.alert(
                "How to get your Access Token",
                "1. Go to developers.facebook.com/tools/explorer\n2. Select your Facebook App\n3. Click 'Generate Access Token'\n4. Add permission: instagram_content_publish\n5. Copy the token\n\nFor a long-lived token (60 days):\nUse the Token Debugger to extend it, or set up a permanent token via System User in Meta Business Manager.",
                [{ text: "OK" }]
              )}
            >
              <Text style={{ fontSize: 16 }}>❓</Text>
              <Text style={{ color: "#E1306C", fontSize: 12, fontWeight: "700" }}>How to get your Access Token</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.sectionDivider} />
        <Text style={[styles.cardTitle, { marginBottom: 4 }]}>💳 Online Payment Details</Text>
        <Text style={styles.cardDesc}>
          When a customer chooses to pay online, these details are shown to them so they can transfer the amount directly.
        </Text>

        <Text style={styles.fieldLabel}>UPI ID / Phone Pay Number</Text>
        <Text style={styles.fieldHint}>e.g. yourname@paytm · 9876543210@upi · business@okicici</Text>
        <TextInput
          style={styles.input}
          value={biz.upi_id}
          onChangeText={v => setBizField("upi_id", v)}
          placeholder="yourname@paytm"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Bank Account Details</Text>
        <Text style={styles.fieldHint}>Optional — shown if you want to accept NEFT/IMPS transfers</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: "top" }]}
          value={biz.bank_details}
          onChangeText={v => setBizField("bank_details", v)}
          placeholder={"Bank: SBI\nAccount No: 1234567890\nIFSC: SBIN0001234\nName: Your Name"}
          placeholderTextColor={Colors.textMuted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={[styles.paymentNote, { marginTop: 10, marginBottom: 4 }]}>
          <Text style={styles.paymentNoteText}>
            💡 After paying, customers reply with a screenshot — you confirm the order manually from the Orders screen.
          </Text>
        </View>

        <View style={styles.sectionDivider} />
        <Text style={[styles.cardTitle, { marginBottom: 4 }]}>🤖 Bot Customisation</Text>
        <Text style={styles.cardDesc}>Personalise how the bot greets customers and responds to location queries.</Text>

        <Text style={styles.fieldLabel}>Custom Greeting Message</Text>
        <Text style={styles.fieldHint}>Use {"{name}"} where you want the customer's name. Leave blank to use the default greeting.</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: "top" }]}
          value={biz.greeting_message}
          onChangeText={v => setBizField("greeting_message", v)}
          placeholder={"Hi {name}! 👋 Welcome to Crumb & Co.!\n\nBrowse the menu and order right here — everything comes to your table. ☕"}
          placeholderTextColor={Colors.textMuted}
          multiline
          autoCorrect={false}
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Location / Maps Link</Text>
        <Text style={styles.fieldHint}>Shown when a customer asks "where are you?" or "location?"</Text>
        <TextInput
          style={styles.input}
          value={biz.location_url}
          onChangeText={v => setBizField("location_url", v)}
          placeholder="https://maps.app.goo.gl/..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>AI FAQ Context</Text>
        <Text style={styles.fieldHint}>
          Write common Q&As here. The AI will use these to answer customer questions automatically.{"\n"}
          Format: "Q: Do you deliver to Pune? A: Yes, 2–3 days."
        </Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: "top" }]}
          value={biz.faq_text}
          onChangeText={v => setBizField("faq_text", v)}
          placeholder={"Q: Do you deliver outside the city? A: Yes, shipping available pan-India.\nQ: What is your return policy? A: 7-day easy return."}
          placeholderTextColor={Colors.textMuted}
          multiline
          autoCorrect={false}
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Return / Refund Policy</Text>
        <Text style={styles.fieldHint}>
          Shown on your public shop page and in the return request form. Leave blank to use a default message.
        </Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: "top" }]}
          value={biz.return_policy}
          onChangeText={v => setBizField("return_policy", v)}
          placeholder={"e.g. We accept returns within 7 days of delivery. Items must be unused and in original condition."}
          placeholderTextColor={Colors.textMuted}
          multiline
          autoCorrect={false}
        />

        <View style={styles.sectionDivider} />
        <Text style={[styles.cardTitle, { marginBottom: 4 }]}>🚚 Shipping Integration</Text>
        <Text style={styles.cardDesc}>Enter credentials to enable auto-tracking updates.</Text>

        <Text style={styles.fieldLabel}>Shiprocket Email</Text>
        <TextInput style={styles.input} value={biz.shiprocket_email} onChangeText={v => setBizField("shiprocket_email", v)} placeholder="your@email.com" placeholderTextColor={Colors.textMuted} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.fieldLabel}>Shiprocket Password</Text>
        <TextInput style={styles.input} value={biz.shiprocket_password} onChangeText={v => setBizField("shiprocket_password", v)} placeholder="••••••••" placeholderTextColor={Colors.textMuted} secureTextEntry />

        <Text style={styles.fieldLabel}>Delhivery API Key</Text>
        <TextInput style={styles.input} value={biz.delhivery_api_key} onChangeText={v => setBizField("delhivery_api_key", v)} placeholder="Token xxxxxxxx" placeholderTextColor={Colors.textMuted} autoCapitalize="none" />

        <TouchableOpacity
          style={[styles.saveBtn, bizSaved && { backgroundColor: Colors.green }, bizSaving && { opacity: 0.6 }]}
          onPress={saveBiz}
          disabled={bizSaving}
        >
          {bizSaving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>{bizSaved ? "Saved ✓" : "Save Business Settings"}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Trading hours & store status */}
      <StoreHoursCard />
      <SchedulingCard />

      {/* Preview data controls — dev builds only */}
      {__DEV__ && <DemoDataCard />}

      {/* Industry picker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏭 Business Industry</Text>
        <Text style={styles.cardDesc}>Change your business type. This updates the tab labels throughout the app.</Text>
        {INDUSTRY_OPTIONS.map(opt => {
          const isActive = activeIndustry === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.industryRow,
                isActive && styles.industryRowActive,
              ]}
              onPress={async () => {
                if (isActive || industrySaving) return;
                setIndustrySaving(true);
                await updateIndustry(opt.id);
                setIndustrySaving(false);
              }}
              disabled={industrySaving}
            >
              <Text style={styles.industryIcon}>{opt.icon}</Text>
              <Text style={[styles.industryLabel, isActive && styles.industryLabelActive]}>{opt.label}</Text>
              {isActive && <Text style={styles.industryCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
        {industrySaving && (
          <ActivityIndicator color={Colors.primary} size="small" style={{ marginTop: 8 }} />
        )}
      </View>

      {/* Business ID — for admin WhatsApp number registration */}
      <BusinessIdCard />

      {/* About */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ℹ️ About Selly</Text>
        <InfoRow label="Version"  value="1.0.0" />
        <InfoRow label="Platform" value="Ordering for cloud kitchens" />
        <InfoRow label="Billing"  value="₹1,000 once + ₹20 per order" />
        <InfoRow label="Support"  value="help@selly.in" />
      </View>

      {/* Pricing reminder */}
      <View style={[styles.card, { borderColor: Colors.primary + "44" }]}>
        <Text style={[styles.cardTitle, { color: Colors.primary }]}>💳 Your Plan</Text>
        <View style={styles.planFeature}><Text style={styles.planCheck}>✓</Text><Text style={styles.planText}>Unlimited customers & orders</Text></View>
        <View style={styles.planFeature}><Text style={styles.planCheck}>✓</Text><Text style={styles.planText}>Instagram DM automation</Text></View>
        <View style={styles.planFeature}><Text style={styles.planCheck}>✓</Text><Text style={styles.planText}>Flash sales & new arrival blasts</Text></View>
        <View style={styles.planFeature}><Text style={styles.planCheck}>✓</Text><Text style={styles.planText}>Abandoned cart recovery</Text></View>
        <View style={styles.planFeature}><Text style={styles.planCheck}>✓</Text><Text style={styles.planText}>Referral program</Text></View>
        <View style={styles.planFeature}><Text style={styles.planCheck}>✓</Text><Text style={styles.planText}>Review collection pipeline</Text></View>
        <View style={[styles.planFeature, { marginTop: 8 }]}>
          <Text style={styles.commissionNote}>5% commission on promo orders with items above ₹1,000</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Business ID card — shows the Supabase auth UUID so admin can register the WA number
function BusinessIdCard() {
  const [bid, setBid]       = useState("…");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setBid(session.user.id);
    });
  }, []);

  const copy = async () => {
    await Clipboard.setStringAsync(bid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.card, { borderColor: "#6C47FF44" }]}>
      <Text style={styles.cardTitle}>🔑 Your Business ID</Text>
      <Text style={styles.cardDesc}>
        Share this ID with the Selly admin when linking your WhatsApp number. It must match exactly.
      </Text>
      <TouchableOpacity style={styles.bidBox} onPress={copy}>
        <Text style={styles.bidText} selectable>{bid}</Text>
        <Text style={styles.bidCopy}>{copied ? "Copied ✓" : "📋 Copy"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ── Preview data ──────────────────────────────────────────────────────────────
// Orders placed from the ordering page pile up alongside the seeded ones, and a
// queue mixing both is confusing to demo from. This puts it back to a clean
// state for the current business type.
function DemoDataCard() {
  const { industry } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      await resetDevOrders(industry);
      await clearDevSideData();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      Alert.alert("Couldn't reset", friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>🧪 Preview data</Text>
      <Text style={styles.cardDesc}>
        Resets orders, the sold-out list and sent messages back to the sample data
        for your business type. Only affects this preview, never live data.
      </Text>
      <TouchableOpacity
        style={[styles.saveBtn, done && { backgroundColor: Colors.green }, busy && { opacity: 0.6 }]}
        onPress={reset}
        disabled={busy}
      >
        {busy
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.saveBtnText}>{done ? "Reset ✓" : "Reset sample data"}</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Trading hours ─────────────────────────────────────────────────────────────
// ── Scheduling ────────────────────────────────────────────────────────────────
// Two decisions live here, and they are not the same decision:
//   · whether customers may choose a delivery time at all
//   · what they pay each month for the privilege
//
// The price is deliberately not a constant in code. A kitchen in Baner and one
// in Kharadi will not charge the same, and a kitchen that changes its mind
// should not change what existing members already pay — which is why the amount
// is copied onto each member row when they join, not read from here at billing.
function SchedulingCard() {
  const [cfg,    setCfg]    = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    loadStoreConfig().then(({ config }) => setCfg(config)).catch(() => setCfg(null));
  }, []);

  if (!cfg) return null;

  const sched = scheduleConfig({ schedule_config: cfg.schedule });

  const setSched = (patch) => {
    setCfg(c => ({ ...c, schedule: { ...(c.schedule || {}), ...patch } }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    try {
      await saveStoreConfig(cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      Alert.alert("Couldn't save", friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>📅 Scheduling</Text>
      <Text style={styles.cardDesc}>
        Lets a customer order now and choose when it arrives — tonight for tomorrow's
        breakfast, for instance. Orders wait on the Scheduled screen and move into the
        Kitchen on their own when they come due.
      </Text>

      <View style={styles.schedRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Accept scheduled orders</Text>
          <Text style={styles.fieldHint}>
            {sched.enabled ? "Customers can pick a delivery time" : "Everything is treated as ASAP"}
          </Text>
        </View>
        <Switch
          value={sched.enabled}
          onValueChange={v => setSched({ enabled: v })}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {sched.enabled && (
        <>
          <View style={styles.schedRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Free for everyone</Text>
              <Text style={styles.fieldHint}>
                {sched.freeWithoutPackage
                  ? "Anyone can schedule — you earn nothing from it"
                  : "Only paying members can schedule"}
              </Text>
            </View>
            <Switch
              value={!!sched.freeWithoutPackage}
              onValueChange={v => setSched({ freeWithoutPackage: v })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {!sched.freeWithoutPackage && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Monthly package price (₹)</Text>
              <Text style={styles.fieldHint}>
                What a new member pays you each month. Existing members keep the price
                they joined at.
              </Text>
              <TextInput
                style={styles.input}
                value={sched.packagePrice == null ? "" : String(sched.packagePrice)}
                onChangeText={v => {
                  const n = v.replace(/[^0-9]/g, "");
                  setSched({ packagePrice: n === "" ? null : Number(n) });
                }}
                placeholder="e.g. 99"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Free trial (days)</Text>
              <Text style={styles.fieldHint}>
                Long enough for the habit to form. Zero means no trial.
              </Text>
              <TextInput
                style={styles.input}
                value={String(sched.trialDays ?? 14)}
                onChangeText={v => setSched({ trialDays: Number(v.replace(/[^0-9]/g, "") || 0) })}
                placeholder="14"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
            </>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Shortest notice (minutes)</Text>
          <Text style={styles.fieldHint}>
            How far ahead a slot must be booked. Too low and someone books 7:00 at 6:58.
          </Text>
          <TextInput
            style={styles.input}
            value={String(sched.leadMinutes ?? 45)}
            onChangeText={v => setSched({ leadMinutes: Number(v.replace(/[^0-9]/g, "") || 0) })}
            placeholder="45"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>How far ahead bookings open (days)</Text>
          <TextInput
            style={styles.input}
            value={String(sched.maxDaysAhead ?? 7)}
            onChangeText={v => setSched({ maxDaysAhead: Number(v.replace(/[^0-9]/g, "") || 1) })}
            placeholder="7"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
          />

          <View style={styles.slotPreview}>
            <Text style={styles.slotPreviewLabel}>MEAL WINDOWS ON OFFER</Text>
            {sched.slots.map(s => (
              <Text key={s.key} style={styles.slotPreviewText}>
                {s.emoji}  {s.label} · {s.from} – {s.to}
              </Text>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, { flex: 0, marginTop: 16 }, saving && styles.btnDisabled]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save scheduling"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Hours decide whether the ordering page accepts an order when the owner hasn't
// manually paused. A day with no times is closed — that's how a kitchen says
// "we don't trade Mondays" without having to remember to pause every week.
function StoreHoursCard() {
  const [cfg,     setCfg]     = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    loadStoreConfig().then(({ config }) => setCfg(config)).catch(() => setCfg(null));
  }, []);

  if (!cfg) return null;

  const setDay = (i, key, value) => {
    setCfg(c => {
      const hours = c.hours.map((h, idx) => {
        if (idx !== i) return h;
        return { ...(h || { open: "10:00", close: "23:00" }), [key]: value };
      });
      return { ...c, hours };
    });
    setSaved(false);
  };

  const toggleDay = (i) => {
    setCfg(c => ({
      ...c,
      hours: c.hours.map((h, idx) => (idx === i ? (h ? null : { open: "10:00", close: "23:00" }) : h)),
    }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    try {
      await saveStoreConfig(cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      Alert.alert("Couldn't save", friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const state = storeOpenState(cfg);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>🕒 Trading Hours</Text>
      <Text style={styles.cardDesc}>
        When the ordering page accepts orders. Right now you are{" "}
        <Text style={{ color: state.open ? Colors.green : Colors.red, fontWeight: "700" }}>
          {state.open ? "open" : "closed"}
        </Text>
        {!state.open && state.reason === "manual" ? " (paused from the dashboard)" : ""}.
      </Text>

      {DAY_SHORT.map((d, i) => {
        const h    = cfg.hours[i];
        const shut = !h;
        return (
          <View key={d} style={hoursStyles.row}>
            <TouchableOpacity style={hoursStyles.dayBtn} onPress={() => toggleDay(i)}>
              <Text style={[hoursStyles.day, shut && { color: Colors.textMuted }]}>{d}</Text>
            </TouchableOpacity>

            {shut ? (
              <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleDay(i)}>
                <Text style={hoursStyles.closed}>Closed — tap to open</Text>
              </TouchableOpacity>
            ) : (
              <View style={hoursStyles.times}>
                <TextInput
                  style={hoursStyles.time}
                  value={h.open}
                  onChangeText={v => setDay(i, "open", v)}
                  placeholder="10:00"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={5}
                />
                <Text style={hoursStyles.dash}>–</Text>
                <TextInput
                  style={hoursStyles.time}
                  value={h.close}
                  onChangeText={v => setDay(i, "close", v)}
                  placeholder="23:00"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={5}
                />
                <TouchableOpacity onPress={() => toggleDay(i)}>
                  <Text style={hoursStyles.shutLink}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      <Text style={styles.fieldHint}>
        24-hour times. A closing time earlier than the opening time means past midnight —
        18:00 to 02:00 keeps you open through the night.
      </Text>

      <Text style={styles.fieldLabel}>Delivery radius (km)</Text>
      <TextInput
        style={styles.input}
        value={String(cfg.deliveryRadiusKm ?? "")}
        onChangeText={v => { setCfg(c => ({ ...c, deliveryRadiusKm: v.replace(/[^0-9.]/g, "") })); setSaved(false); }}
        keyboardType="numeric"
        placeholder="5"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Typical prep time (minutes)</Text>
      <Text style={styles.fieldHint}>
        Used for the "ready in about N minutes" line customers see, and to flag
        overdue orders on the kitchen screen.
      </Text>
      <TextInput
        style={styles.input}
        value={String(cfg.defaultPrepMinutes ?? "")}
        onChangeText={v => { setCfg(c => ({ ...c, defaultPrepMinutes: v.replace(/[^0-9]/g, "") })); setSaved(false); }}
        keyboardType="numeric"
        placeholder="30"
        placeholderTextColor={Colors.textMuted}
      />

      <TouchableOpacity
        style={[styles.saveBtn, saved && { backgroundColor: Colors.green }, saving && { opacity: 0.6 }]}
        onPress={save}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.saveBtnText}>{saved ? "Saved ✓" : "Save Trading Hours"}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const hoursStyles = StyleSheet.create({
  row     : { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  dayBtn  : { width: 42 },
  day     : { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  closed  : { color: Colors.textMuted, fontSize: 12.5, fontStyle: "italic" },
  times   : { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  time    : {
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    color: Colors.textPrimary, fontSize: 13, width: 72, textAlign: "center",
  },
  dash     : { color: Colors.textMuted, fontSize: 13 },
  shutLink : { color: Colors.textMuted, fontSize: 11.5, marginLeft: 2 },
});


const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: Colors.bg },
  content     : { padding: 16, paddingBottom: 40 },
  pageTitle   : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", marginBottom: 20 },

  card        : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  cardTitle   : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  cardDesc    : { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 12 },

  fieldLabel  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input       : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border },

  testResult  : { borderRadius: 8, padding: 10, marginTop: 10 },

  btnRow      : { flexDirection: "row", gap: 10, marginTop: 12 },
  testBtn     : { flex: 1, backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.primary },
  testBtnText : { color: Colors.primary, fontWeight: "700", fontSize: 14 },
  saveBtn     : { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  saveBtnText : { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnDisabled : { opacity: 0.6 },
  resetBtn    : { marginTop: 8, padding: 10, alignItems: "center" },
  resetBtnText: { color: Colors.textMuted, fontSize: 13, textDecorationLine: "underline" },

  infoRow     : { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel   : { color: Colors.textSecondary, fontSize: 13 },
  infoValue   : { color: Colors.textPrimary, fontSize: 13, fontWeight: "600" },

  bidBox      : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#6C47FF44", gap: 8 },
  bidText     : { flex: 1, color: "#a78bfa", fontSize: 12, fontFamily: "monospace", letterSpacing: 0.5 },
  bidCopy     : { color: Colors.primary, fontWeight: "700", fontSize: 13 },

  switchRow   : { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  switchLabel : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },
  switchDesc  : { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },

  fieldHint   : { color: Colors.textMuted, fontSize: 11, marginBottom: 6, marginTop: -2 },
  sectionDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },

  schedRow        : { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
                      borderBottomWidth: 1, borderBottomColor: Colors.border },
  slotPreview     : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, marginTop: 14 },
  slotPreviewLabel: { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800",
                      letterSpacing: 0.9, marginBottom: 8 },
  slotPreviewText : { color: Colors.textSecondary, fontSize: 12.5, lineHeight: 21 },

  paymentNote     : { backgroundColor: Colors.primary + "12", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.primary + "30" },
  paymentNoteText : { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },

  planFeature : { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  planCheck   : { color: Colors.green, fontWeight: "800", marginRight: 8, fontSize: 14 },
  planText    : { color: Colors.textSecondary, fontSize: 13 },
  commissionNote: { color: Colors.accent, fontSize: 12, fontStyle: "italic" },

  // Industry picker
  industryRow       : { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.bgInput },
  industryRowActive : { borderColor: Colors.primary, backgroundColor: Colors.primary + "12" },
  industryIcon      : { fontSize: 20, marginRight: 12 },
  industryLabel     : { flex: 1, color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
  industryLabelActive: { color: Colors.primary, fontWeight: "800" },
  industryCheck     : { color: Colors.primary, fontSize: 16, fontWeight: "900" },
});
