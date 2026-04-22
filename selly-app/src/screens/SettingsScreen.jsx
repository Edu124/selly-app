import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { Colors } from "../constants/colors";
import { getServerUrl, saveServerUrl } from "../lib/api";

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState("");
  const [saved, setSaved]         = useState(false);
  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    getServerUrl().then(url => setServerUrl(url));
  }, []);

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

  planFeature : { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  planCheck   : { color: Colors.green, fontWeight: "800", marginRight: 8, fontSize: 14 },
  planText    : { color: Colors.textSecondary, fontSize: 13 },
  commissionNote: { color: Colors.accent, fontSize: 12, fontStyle: "italic" },
});
