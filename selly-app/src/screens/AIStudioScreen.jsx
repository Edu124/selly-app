// ── AI Studio Screen ──────────────────────────────────────────────────────────
// Central hub for all AI-powered features in Selly
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal,
} from "react-native";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";

// ── Feature Cards Config ──────────────────────────────────────────────────────
const AI_FEATURES = [
  {
    id       : "insights",
    icon     : "📊",
    title    : "Smart Insights",
    desc     : "Sales forecast, best time to post, top products",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
    industries: "all",
  },
  {
    id       : "caption",
    icon     : "✍️",
    title    : "Caption Writer",
    desc     : "AI writes Instagram captions & broadcast messages",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
    industries: "all",
  },
  {
    id       : "image",
    icon     : "🖼️",
    title    : "Image Generator",
    desc     : "Generate product photos & promotional banners",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
    industries: "all",
  },
  {
    id       : "voice",
    icon     : "🎙️",
    title    : "Voice Ordering",
    desc     : "Customers send voice notes — bot auto-transcribes",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: true,
    industries: "all",
  },
  {
    id       : "reel",
    icon     : "🎬",
    title    : "Reel Script Generator",
    desc     : "AI writes 30-second Reel scripts for your products",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
    industries: "all",
  },
  {
    id       : "notebook",
    icon     : "📚",
    title    : "AI Notebooks",
    desc     : "Upload notes → AI answers student doubts on WhatsApp",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: true,
    industries: "education",
  },
  {
    id       : "flashcard",
    icon     : "🃏",
    title    : "Flashcard Generator",
    desc     : "Upload chapter → AI creates study flashcards",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: true,
    industries: "education",
  },
  {
    id       : "bulkimport",
    icon     : "📦",
    title    : "Bulk Product Import",
    desc     : "Photo of price list or Excel → auto-add all products",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: true,
    industries: "all",
  },
  {
    id       : "scanner",
    icon     : "📷",
    title    : "Scan & Sell",
    desc     : "Scan product barcode to add inventory or create bill",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: true,
    industries: "kirana,medical",
  },
  {
    id       : "pricing",
    icon     : "💰",
    title    : "Smart Pricing",
    desc     : "AI suggests optimal prices based on demand & competitors",
    badge    : "Soon",
    badgeColor: "#f59e0b",
    comingSoon: true,
    industries: "all",
  },
];

// ── Caption Writer Modal ──────────────────────────────────────────────────────
function CaptionWriterModal({ visible, onClose, industry }) {
  const [prompt,   setPrompt]   = useState("");
  const [result,   setResult]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [type,     setType]     = useState("instagram");

  const TYPES = [
    { id: "instagram", label: "📸 Instagram" },
    { id: "broadcast", label: "📢 Broadcast" },
    { id: "reel",      label: "🎬 Reel Script" },
  ];

  async function generate() {
    if (!prompt.trim()) return Alert.alert("Enter a prompt first");
    setLoading(true);
    setResult("");
    try {
      const systemMap = {
        instagram : `You are a social media expert for Indian small businesses. Write an engaging Instagram caption with emojis and relevant hashtags. Keep it under 150 words. Industry: ${industry}.`,
        broadcast : `You are a marketing expert for Indian small businesses. Write a WhatsApp broadcast message that's personal, warm, and drives action. Keep it under 100 words. Industry: ${industry}.`,
        reel      : `You are a content creator for Indian small businesses. Write a 30-second Reel script with a hook, main content, and CTA. Use simple Hindi-English mix. Industry: ${industry}.`,
      };
      const { getBaseUrl } = await import("../lib/api");
      const base = await getBaseUrl();
      const res = await fetch(`${base}/api/ai/generate`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ type, context: prompt.trim(), industry }),
      });
      const data = await res.json();
      setResult(data.result || data.error || "No response");
    } catch (e) {
      setResult("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>✍️ AI Content Writer</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody}>
          {/* Type selector */}
          <View style={styles.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeBtn, type === t.id && styles.typeBtnActive]}
                onPress={() => setType(t.id)}
              >
                <Text style={[styles.typeBtnText, type === t.id && styles.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Prompt */}
          <Text style={styles.fieldLabel}>What do you want to promote?</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder={`e.g. "New summer collection kurtas starting ₹499"`}
            placeholderTextColor={Colors.textMuted}
            value={prompt}
            onChangeText={setPrompt}
            multiline
          />
          <TouchableOpacity style={styles.generateBtn} onPress={generate} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.generateBtnText}>✨ Generate</Text>
            }
          </TouchableOpacity>
          {/* Result */}
          {result ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Result:</Text>
              <Text style={styles.resultText}>{result}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Image Generator Modal ─────────────────────────────────────────────────────
function ImageGeneratorModal({ visible, onClose }) {
  const [prompt,  setPrompt]  = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl,setImageUrl]= useState("");

  async function generate() {
    if (!prompt.trim()) return Alert.alert("Enter a prompt first");
    setLoading(true);
    setImageUrl("");
    try {
      const { getBaseUrl } = await import("../lib/api");
      const base = await getBaseUrl();
      const res = await fetch(`${base}/api/ai/image`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      setImageUrl(data.imageUrl || "");
      if (data.error) Alert.alert("Error", data.error);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>🖼️ AI Image Generator</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody}>
          <Text style={styles.fieldLabel}>Describe the image you want</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder={`e.g. "A beautiful Indian woman wearing a blue silk saree, white background, product photo"`}
            placeholderTextColor={Colors.textMuted}
            value={prompt}
            onChangeText={setPrompt}
            multiline
          />
          <Text style={styles.hintText}>💡 Tip: Describe the product, style, background, and mood for best results</Text>
          <TouchableOpacity style={styles.generateBtn} onPress={generate} disabled={loading}>
            {loading
              ? <><ActivityIndicator color="#fff" /><Text style={[styles.generateBtnText,{marginLeft:8}]}>Generating (~30s)...</Text></>
              : <Text style={styles.generateBtnText}>✨ Generate Image</Text>
            }
          </TouchableOpacity>
          {imageUrl ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Generated Image URL:</Text>
              <Text style={[styles.resultText, {color: Colors.primary}]}>{imageUrl}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Smart Insights Modal ──────────────────────────────────────────────────────
function InsightsModal({ visible, onClose, industry }) {
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(false);

  React.useEffect(() => {
    if (visible && !insights) loadInsights();
  }, [visible]);

  async function loadInsights() {
    setLoading(true);
    try {
      const { getBaseUrl, getBusinessId } = await import("../lib/api");
      const [base, bid] = await Promise.all([getBaseUrl(), getBusinessId()]);
      const res = await fetch(`${base}/api/ai/insights?bid=${bid}`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) { setInsights({ error: data.error }); return; }
      // Server returns { insights: "1. ...\n2. ...", stats: { totalOrders, totalRev, topItems } }
      setInsights({
        raw     : data.insights || "",
        stats   : data.stats || {},
      });
    } catch (e) {
      setInsights({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>📊 Smart Insights</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.loadingText}>AI is analysing your business...</Text>
            </View>
          ) : insights?.error ? (
            <Text style={{ color: "#ef4444", padding: 16 }}>{insights.error}</Text>
          ) : insights ? (
            <>
              {/* Quick stat chips */}
              {insights.stats && (
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  <View style={styles.statChip}>
                    <Text style={styles.statChipVal}>{insights.stats.totalOrders ?? 0}</Text>
                    <Text style={styles.statChipLabel}>Orders (30d)</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.statChipVal}>₹{(insights.stats.totalRev ?? 0).toLocaleString("en-IN")}</Text>
                    <Text style={styles.statChipLabel}>Revenue</Text>
                  </View>
                  {insights.stats.topItems?.length > 0 && (
                    <View style={[styles.statChip, { flex: 1, minWidth: 120 }]}>
                      <Text style={styles.statChipVal} numberOfLines={1}>{insights.stats.topItems[0]}</Text>
                      <Text style={styles.statChipLabel}>Top Product</Text>
                    </View>
                  )}
                </View>
              )}
              {/* AI insights text */}
              {insights.raw ? (
                <View style={styles.insightCard}>
                  <Text style={styles.insightTitle}>💡 AI Recommendations</Text>
                  <Text style={styles.insightText}>{insights.raw}</Text>
                </View>
              ) : (
                <Text style={{ color: Colors.textMuted, padding: 16, textAlign: "center" }}>No data yet — start getting orders to see insights!</Text>
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main AI Studio Screen ─────────────────────────────────────────────────────
export default function AIStudioScreen() {
  const { industry } = useAuth();
  const [captionOpen,  setCaptionOpen]  = useState(false);
  const [imageOpen,    setImageOpen]    = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  function handleFeature(id, comingSoon) {
    if (comingSoon) {
      Alert.alert("Coming Soon", "This feature is in development and will be available soon! 🚀");
      return;
    }
    if (id === "caption" || id === "reel") setCaptionOpen(true);
    if (id === "image")    setImageOpen(true);
    if (id === "insights") setInsightsOpen(true);
  }

  const visibleFeatures = AI_FEATURES.filter(f =>
    f.industries === "all" || f.industries.split(",").includes(industry)
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🤖 AI Studio</Text>
        <Text style={styles.headerSub}>Powered by Groq · Free for all features</Text>
      </View>

      {/* Feature cards */}
      {visibleFeatures.map(f => (
        <TouchableOpacity
          key={f.id}
          style={[styles.featureCard, f.comingSoon && styles.featureCardDim]}
          onPress={() => handleFeature(f.id, f.comingSoon)}
          activeOpacity={0.75}
        >
          <Text style={styles.featureIcon}>{f.icon}</Text>
          <View style={styles.featureMeta}>
            <View style={styles.featureTitleRow}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <View style={[styles.badge, { backgroundColor: f.badgeColor + "22", borderColor: f.badgeColor + "44" }]}>
                <Text style={[styles.badgeText, { color: f.badgeColor }]}>{f.comingSoon ? "Soon" : f.badge}</Text>
              </View>
            </View>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
          <Text style={styles.chevron}>{f.comingSoon ? "🔒" : "›"}</Text>
        </TouchableOpacity>
      ))}

      {/* Modals */}
      <CaptionWriterModal  visible={captionOpen}  onClose={() => setCaptionOpen(false)}  industry={industry} />
      <ImageGeneratorModal visible={imageOpen}    onClose={() => setImageOpen(false)} />
      <InsightsModal       visible={insightsOpen} onClose={() => setInsightsOpen(false)} industry={industry} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, gap: 10, paddingBottom: 40 },

  header    : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 20, marginBottom: 6, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", letterSpacing: 0.5 },
  headerSub  : { color: Colors.textMuted, fontSize: 12, marginTop: 4 },

  featureCard    : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 14 },
  featureCardDim : { opacity: 0.65 },
  featureIcon    : { fontSize: 32 },
  featureMeta    : { flex: 1 },
  featureTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  featureTitle   : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  featureDesc    : { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  badge          : { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  badgeText      : { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  chevron        : { color: Colors.textMuted, fontSize: 22 },

  // Modal
  modal       : { flex: 1, backgroundColor: Colors.bg },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "900" },
  modalClose  : { color: Colors.textMuted, fontSize: 22, padding: 4 },
  modalBody   : { flex: 1, padding: 20 },

  fieldLabel  : { color: Colors.textSecondary, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  input       : { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontSize: 14, marginBottom: 12 },
  hintText    : { color: Colors.textMuted, fontSize: 11, marginBottom: 12, lineHeight: 16 },

  typeRow     : { flexDirection: "row", gap: 8, marginBottom: 16 },
  typeBtn     : { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  typeBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  typeBtnText  : { color: Colors.textSecondary, fontSize: 11, fontWeight: "700" },
  typeBtnTextActive: { color: Colors.primary },

  generateBtn    : { backgroundColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 },
  generateBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  resultBox  : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: Colors.border },
  resultLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 8, textTransform: "uppercase" },
  resultText : { color: Colors.textPrimary, fontSize: 14, lineHeight: 22 },

  loadingBox  : { alignItems: "center", padding: 40, gap: 16 },
  loadingText : { color: Colors.textSecondary, fontSize: 14 },

  insightCard : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  insightTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 8 },
  insightText : { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 4 },

  statChip     : { backgroundColor: Colors.bgCard, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, alignItems: "center", minWidth: 80 },
  statChipVal  : { color: Colors.textPrimary, fontSize: 16, fontWeight: "900" },
  statChipLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
});
