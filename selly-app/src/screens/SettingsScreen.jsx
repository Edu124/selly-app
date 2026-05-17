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

const DEFAULT_SETTINGS = {
  business_name: "", business_gst_no: "", business_address: "",
  gst_enabled: true, gst_rate: "5", delivery_charge: "49",
  free_above: "999", cod_fee: "30",
  whatsapp_number: "", shiprocket_email: "", shiprocket_password: "", delhivery_api_key: "",
  // AI Discovery fields
  instagram_handle: "", city: "",
  // Online payment details (UPI / bank transfer)
  upi_id: "", bank_details: "",
  // Bot customisation
  greeting_message: "", location_url: "",
  // AI FAQ context
  faq_text: "",
};

const INDUSTRY_OPTIONS = [
  { id: "product",   icon: "🛍️", label: "Product Business"      },
  { id: "education", icon: "📚", label: "Education"               },
  { id: "tourism",   icon: "✈️", label: "Tourism & Travel"        },
  { id: "kirana",    icon: "🛒", label: "Kirana / Grocery"        },
  { id: "cakes",     icon: "🎂", label: "Cake & Bakery"           },
  { id: "icecream",  icon: "🍦", label: "Ice Cream & Desserts"    },
];

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
            whatsapp_number   : s.whatsapp_number     || "",
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
        gst_rate           : Number(biz.gst_rate)        || 5,
        delivery_charge    : Number(biz.delivery_charge) || 49,
        free_above         : Number(biz.free_above)      || 999,
        cod_fee            : Number(biz.cod_fee)         || 30,
        instagram_handle   : biz.instagram_handle.trim(),
        city               : biz.city.trim(),
        whatsapp_number    : biz.whatsapp_number.trim(),
        shiprocket_email   : biz.shiprocket_email.trim(),
        shiprocket_password: biz.shiprocket_password.trim(),
        delhivery_api_key  : biz.delhivery_api_key.trim(),
        upi_id             : biz.upi_id.trim(),
        bank_details       : biz.bank_details.trim(),
        greeting_message   : biz.greeting_message.trim(),
        location_url       : biz.location_url.trim(),
        faq_text           : biz.faq_text.trim(),
      });
      setBizSaved(true);
      setTimeout(() => setBizSaved(false), 2000);
    } catch (e) {
      Alert.alert("Error", e.message);
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${url}/`, { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        setTestResult({ ok: true, msg: "✅ Connected successfully!" });
      } else {
        setTestResult({ ok: false, msg: `❌ Server responded with ${resp.status}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: "❌ " + e.message });
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
            const DEFAULT = "https://instagram-bot-production-ef01.up.railway.app";
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

        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>WhatsApp Business Number</Text>
        <Text style={styles.fieldHint}>Customers see a "Chat with us" link after order confirmation</Text>
        <TextInput style={styles.input} value={biz.whatsapp_number} onChangeText={v => setBizField("whatsapp_number", v)} placeholder="+919876543210" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />

        <View style={styles.sectionDivider} />
        <Text style={[styles.cardTitle, { marginBottom: 4 }]}>💳 Online Payment Details</Text>
        <Text style={styles.cardDesc}>
          When a student / customer chooses to pay online, these details are shown to them so they can transfer the amount directly.
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
            💡 After paying, students reply with a screenshot — you confirm the enrollment manually from the Enrollments screen.
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
          placeholder={"Hi {name}! 👋 Welcome to DLA Commerce Classes!\n\nExpert coaching for 11th, 12th & Degree Commerce. 📚"}
          placeholderTextColor={Colors.textMuted}
          multiline
          autoCorrect={false}
        />

        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Location / Maps Link</Text>
        <Text style={styles.fieldHint}>Shown when a student asks "where are you?" or "location?"</Text>
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
        <InfoRow label="Platform" value="Instagram Commerce Bot" />
        <InfoRow label="Billing"  value="₹3,000/month + 5% commission" />
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
