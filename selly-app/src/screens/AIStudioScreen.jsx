// ── AI Studio Screen ──────────────────────────────────────────────────────────
// Central hub for all AI-powered features in Selly
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import { getBaseUrl, getBusinessId } from "../lib/api";
import { friendlyError } from "../lib/errors";

// ── Feature Cards Config ──────────────────────────────────────────────────────
const AI_FEATURES = [
  {
    id: "insights", icon: "stats-chart", tile: "violet",
    title: "Smart Insights",
    desc : "Sales forecast, best time to post and top products",
    badge: "Popular", badgeTone: "amber", tech: "Groq Llama 3", action: "Open",
    comingSoon: false, industries: "all",
  },
  {
    id: "notebook", icon: "book", tile: "blue",
    title: "AI Notebooks",
    desc : "Upload notes \u2192 AI answers student doubts on WhatsApp",
    badge: "New", badgeTone: "green", tech: "Groq Llama 3", action: "Open",
    comingSoon: false, industries: "education",
  },
  {
    id: "flashcard", icon: "albums", tile: "pink",
    title: "Flashcard Generator",
    desc : "Upload chapter \u2192 AI creates study flashcards instantly",
    badge: "", badgeTone: "violet", tech: "Groq Llama 3", action: "Create",
    comingSoon: false, industries: "education",
  },
  {
    id: "pricing", icon: "pricetag", tile: "green",
    title: "Smart Pricing",
    desc : "AI suggests optimal prices based on demand & competition",
    badge: "", badgeTone: "violet", tech: "Groq Llama 3", action: "Analyze",
    comingSoon: false, industries: "all",
  },
];

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
// ── AI Notebooks Info Modal ───────────────────────────────────────────────────
function NotebookModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>📚 AI Notebooks</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody}>
          <View style={[styles.resultBox, { marginTop: 0 }]}>
            <Text style={styles.resultLabel}>How it works</Text>
            <Text style={styles.resultText}>
              {`Students can ask doubts directly on WhatsApp!\n\n` +
               `1️⃣  Student sends a question: "What is photosynthesis?"\n` +
               `2️⃣  Bot answers using Groq AI with subject context\n` +
               `3️⃣  Answers are subject-aware (biology, maths, history, etc.)\n` +
               `4️⃣  Responses in the student's language (Hindi/English)\n\n` +
               `✅  Active on your bot — set your subject/topics in Settings → FAQ field`}
            </Text>
          </View>
          <View style={[styles.resultBox, { marginTop: 12 }]}>
            <Text style={styles.resultLabel}>How to set subject context</Text>
            <Text style={styles.resultText}>
              {`Go to Settings → scroll to "FAQ / AI Context" and add your subjects:\n\n` +
               `Example:\n` +
               `"We teach Class 9–12 Physics, Chemistry, Biology, Maths. Our specialty is NEET and JEE preparation. Focus on NCERT concepts."\n\n` +
               `The AI will use this context to answer student doubts accurately.`}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Flashcard Generator Modal ─────────────────────────────────────────────────
function FlashcardModal({ visible, onClose, industry }) {
  const [topic,   setTopic]   = useState("");
  const [cards,   setCards]   = useState([]);
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!topic.trim()) return Alert.alert("Enter a topic or chapter name");
    setLoading(true);
    setCards([]);
    try {

      const base = await getBaseUrl();
      const res = await fetch(`${base}/api/ai/generate`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({
          type    : "flashcards",
          context : topic.trim(),
          industry,
          systemPrompt: `You are an expert teacher. Create 8 flashcards for the topic: "${topic}". Return ONLY a JSON array like: [{"q":"Question?","a":"Answer"},...]. No extra text, just valid JSON.`,
        }),
      });
      const data = await res.json();
      try {
        // Try to parse JSON from result
        const raw = data.result || "";
        const jsonStart = raw.indexOf("[");
        const jsonEnd   = raw.lastIndexOf("]") + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(raw.substring(jsonStart, jsonEnd));
          setCards(parsed);
        } else {
          setCards([{ q: "Could not parse flashcards", a: raw }]);
        }
      } catch (_) {
        setCards([{ q: "Error parsing response", a: data.result || "" }]);
      }
    } catch (e) {
      Alert.alert("Error", friendlyError(e));
    } finally {
      setLoading(false);
    }
  }

  const [flipped, setFlipped] = useState({});

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>🃏 Flashcard Generator</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Chapter / Topic</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Photosynthesis, Quadratic Equations, World War 2"
            placeholderTextColor={Colors.textMuted}
            value={topic}
            onChangeText={setTopic}
          />
          <TouchableOpacity style={styles.generateBtn} onPress={generate} disabled={loading}>
            {loading
              ? <><ActivityIndicator color="#fff" /><Text style={[styles.generateBtnText, { marginLeft: 8 }]}>Generating...</Text></>
              : <Text style={styles.generateBtnText}>✨ Generate 8 Flashcards</Text>
            }
          </TouchableOpacity>

          {cards.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Tap a card to flip it 👇</Text>
              {cards.map((card, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.flashCard}
                  onPress={() => setFlipped(prev => ({ ...prev, [i]: !prev[i] }))}
                >
                  <Text style={styles.flashCardNum}>Card {i + 1}</Text>
                  <Text style={styles.flashCardText}>
                    {flipped[i] ? card.a : card.q}
                  </Text>
                  <Text style={styles.flashCardHint}>{flipped[i] ? "📖 Answer — tap to see Q" : "❓ Question — tap to see A"}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
// ── Smart Pricing Modal ───────────────────────────────────────────────────────
function SmartPricingModal({ visible, onClose, industry }) {
  const [product,  setProduct]  = useState("");
  const [cost,     setCost]     = useState("");
  const [market,   setMarket]   = useState("");
  const [result,   setResult]   = useState("");
  const [loading,  setLoading]  = useState(false);

  async function analyse() {
    if (!product.trim()) return Alert.alert("Enter product name first");
    setLoading(true);
    setResult("");
    try {

      const [base, bid] = await Promise.all([getBaseUrl(), getBusinessId()]);
      const res = await fetch(`${base}/api/ai/pricing`, {
        method : "POST",
        headers: { "Content-Type": "application/json", "X-Business-ID": bid },
        body   : JSON.stringify({
          product    : product.trim(),
          cost_price : cost ? Number(cost) : null,
          market_info: market.trim(),
          industry,
          bid,
        }),
      });
      const data = await res.json();
      setResult(data.suggestion || data.result || data.error || "No response");
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
          <Text style={styles.modalTitle}>💰 Smart Pricing AI</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Product Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Blue Cotton Kurta"
            placeholderTextColor={Colors.textMuted}
            value={product}
            onChangeText={setProduct}
          />

          <Text style={styles.fieldLabel}>Your Cost Price (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 250"
            placeholderTextColor={Colors.textMuted}
            value={cost}
            onChangeText={setCost}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Market / Competition Info (optional)</Text>
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: "top" }]}
            placeholder="e.g. Competitors sell similar at ₹499, local demand is high during festivals"
            placeholderTextColor={Colors.textMuted}
            value={market}
            onChangeText={setMarket}
            multiline
          />

          <TouchableOpacity style={styles.generateBtn} onPress={analyse} disabled={loading}>
            {loading
              ? <><ActivityIndicator color="#fff" /><Text style={[styles.generateBtnText, { marginLeft: 8 }]}>Analysing...</Text></>
              : <Text style={styles.generateBtnText}>✨ Get Price Recommendation</Text>
            }
          </TouchableOpacity>

          {result ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>AI Pricing Recommendation:</Text>
              <Text style={styles.resultText}>{result}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
// ── Main AI Studio Screen ─────────────────────────────────────────────────────
export default function AIStudioScreen() {
  const { industry } = useAuth();
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [flashcardOpen,setFlashcardOpen]= useState(false);
  const [pricingOpen,  setPricingOpen]  = useState(false);

  function handleFeature(id, comingSoon) {
    if (comingSoon) {
      Alert.alert("Coming Soon", "This feature is in development and will be available soon! 🚀");
      return;
    }
    if (id === "insights") setInsightsOpen(true);
    if (id === "notebook") setNotebookOpen(true);
    if (id === "flashcard")setFlashcardOpen(true);
    if (id === "pricing")  setPricingOpen(true);
  }

  const visibleFeatures = AI_FEATURES.filter(f =>
    f.industries === "all" || f.industries.split(",").includes(industry)
  );

  const tile = k => Colors.tile[k] || Colors.tile.violet;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={Colors.gradHero}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />

        <View style={styles.heroEyebrow}>
          <Ionicons name="sparkles" size={11} color="#d9ccff" />
          <Text style={styles.heroEyebrowText}>Smarter tools, bigger results</Text>
        </View>

        <Text style={styles.heroTitle}>Create, Automate & Grow</Text>
        <Text style={styles.heroTitleAccent}>with AI</Text>
        <Text style={styles.heroSub}>
          Smart insights and pricing help for your business — powered by Groq Llama 3.
        </Text>
      </LinearGradient>

      {/* ── Popular Tools ────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Popular Tools</Text>
        <Text style={styles.sectionLink}>{visibleFeatures.length} tools</Text>
      </View>

      {visibleFeatures.map(f => (
        <TouchableOpacity
          key={f.id}
          style={[styles.toolCard, f.comingSoon && styles.toolCardDim]}
          onPress={() => handleFeature(f.id, f.comingSoon)}
          activeOpacity={0.8}
        >
          <View style={styles.toolTop}>
            <View style={[styles.toolIcon, { backgroundColor: tile(f.tile)[0] }]}>
              <Ionicons name={f.icon} size={19} color={tile(f.tile)[1]} />
            </View>
            {!!f.badge && !f.comingSoon && (
              <View style={[styles.pill, { backgroundColor: tile(f.badgeTone)[0] }]}>
                <Text style={[styles.pillText, { color: tile(f.badgeTone)[1] }]}>{f.badge}</Text>
              </View>
            )}
            {f.comingSoon && (
              <View style={styles.pill}><Text style={styles.pillText}>Soon</Text></View>
            )}
          </View>

          <Text style={styles.toolTitle}>{f.title}</Text>
          <Text style={styles.toolDesc}>{f.desc}</Text>

          <View style={styles.toolFoot}>
            <View style={styles.techTag}><Text style={styles.techTagText}>{f.tech}</Text></View>
            <View style={styles.toolBtn}>
              <Text style={styles.toolBtnText}>{f.action}</Text>
              <Ionicons name="arrow-forward" size={12} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* ── Upgrade banner ───────────────────────────────────── */}
      <LinearGradient
        colors={Colors.gradPrimary}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.upsell}
      >
        <View style={styles.upsellIcon}>
          <Ionicons name="rocket" size={19} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.upsellTitle}>Do more with AI</Text>
          <Text style={styles.upsellSub}>Save time and focus on what really matters — your growth.</Text>
        </View>
      </LinearGradient>

      {/* Modals */}
      <InsightsModal       visible={insightsOpen}  onClose={() => setInsightsOpen(false)}  industry={industry} />
      <NotebookModal       visible={notebookOpen}  onClose={() => setNotebookOpen(false)} />
      <FlashcardModal      visible={flashcardOpen} onClose={() => setFlashcardOpen(false)} industry={industry} />
      <SmartPricingModal   visible={pricingOpen}   onClose={() => setPricingOpen(false)}   industry={industry} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 14, gap: 10, paddingBottom: 40 },

  // ── Hero ──────────────────────────────────────────────────
  hero        : { borderRadius: 22, padding: 20, overflow: "hidden", marginBottom: 4 },
  heroGlowA   : { position: "absolute", top: -70, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(157,135,255,0.30)" },
  heroGlowB   : { position: "absolute", bottom: -80, left: -60, width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(45,212,191,0.12)" },
  heroEyebrow : { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 14 },
  heroEyebrowText: { color: "#e6dcff", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3 },
  heroTitle       : { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.4, lineHeight: 31 },
  heroTitleAccent : { color: "#c9b6ff", fontSize: 26, fontWeight: "800", letterSpacing: -0.4, lineHeight: 31, marginBottom: 8 },
  heroSub         : { color: "rgba(255,255,255,0.72)", fontSize: 12.5, lineHeight: 18, marginBottom: 16 },

  promptBar   : { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(10,10,18,0.55)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", paddingLeft: 13, paddingRight: 6, paddingVertical: 6 },
  promptInput : { flex: 1, color: "#fff", fontSize: 13.5, paddingVertical: 8, outlineStyle: "none" },
  promptSend  : { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },

  chipRow     : { flexDirection: "row", gap: 7 },
  promptChip  : { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.11)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 18, paddingHorizontal: 11, paddingVertical: 6 },
  promptChipText: { color: "rgba(255,255,255,0.88)", fontSize: 11, fontWeight: "600" },

  // ── Sections ──────────────────────────────────────────────
  sectionRow  : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 2 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15.5, fontWeight: "800", letterSpacing: -0.2 },
  sectionLink : { color: Colors.textMuted, fontSize: 11.5, fontWeight: "600" },

  // ── Activity stat tiles ───────────────────────────────────
  statGrid  : { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  statCard  : { flexGrow: 1, flexBasis: "46%", backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  statIcon  : { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 9 },
  statLabel : { color: Colors.textMuted, fontSize: 10.5, fontWeight: "600", letterSpacing: 0.2 },
  statValRow: { flexDirection: "row", alignItems: "flex-end", gap: 7, marginTop: 2 },
  statValue : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  statDelta : { color: Colors.green, fontSize: 10.5, fontWeight: "700", marginBottom: 3 },

  // ── Quick actions ─────────────────────────────────────────
  quickRow  : { flexDirection: "row", gap: 9, paddingVertical: 2 },
  quickCard : { flexDirection: "row", alignItems: "center", gap: 10, width: 218, backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  quickIcon : { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  quickTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  quickSub  : { color: Colors.textMuted, fontSize: 10.5, marginTop: 1 },

  // ── Tool cards ────────────────────────────────────────────
  toolCard  : { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  toolCardDim: { opacity: 0.6 },
  toolTop   : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  toolIcon  : { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pill      : { backgroundColor: Colors.bgElevated, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  pillText  : { color: Colors.textMuted, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4 },
  toolTitle : { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  toolDesc  : { color: Colors.textSecondary, fontSize: 12, lineHeight: 17.5, marginTop: 3 },
  toolFoot  : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13 },
  techTag   : { backgroundColor: Colors.bgElevated, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  techTagText: { color: Colors.textMuted, fontSize: 10.5, fontWeight: "600" },
  toolBtn   : { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.primary, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 7 },
  toolBtnText: { color: "#fff", fontSize: 11.5, fontWeight: "700" },

  // ── Upgrade banner ────────────────────────────────────────
  upsell     : { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 15, marginTop: 14 },
  upsellIcon : { width: 38, height: 38, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  upsellTitle: { color: "#fff", fontSize: 14.5, fontWeight: "800" },
  upsellSub  : { color: "rgba(255,255,255,0.82)", fontSize: 11.5, marginTop: 2, lineHeight: 16 },

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

  // Image picker
  pickRow         : { flexDirection: "row", gap: 10, marginBottom: 12 },
  pickBtn         : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingVertical: 16, alignItems: "center", gap: 6 },
  pickBtnIcon     : { fontSize: 26 },
  pickBtnText     : { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },

  srcImageWrap    : { borderRadius: 12, overflow: "hidden", marginBottom: 12, position: "relative" },
  srcImagePreview : { width: "100%", height: 200, borderRadius: 12 },
  changeSrcBtn    : { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  changeSrcText   : { color: "#fff", fontSize: 11, fontWeight: "700" },

  strengthRow      : { flexDirection: "row", gap: 8, marginBottom: 8 },
  strengthBtn      : { flex: 1, backgroundColor: Colors.bgCard, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 10, alignItems: "center" },
  strengthBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  strengthBtnText  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "700" },
  strengthBtnTextActive: { color: Colors.primary },
  strengthBtnSub   : { color: Colors.textMuted, fontSize: 10, marginTop: 2 },

  resultImagePreview: { width: "100%", height: 220, borderRadius: 10, marginTop: 6 },

  // Flashcard
  flashCard     : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: Colors.primary + "44", marginBottom: 8, alignItems: "center", minHeight: 100, justifyContent: "center" },
  flashCardNum  : { color: Colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 },
  flashCardText : { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", textAlign: "center", lineHeight: 22 },
  flashCardHint : { color: Colors.textMuted, fontSize: 10, marginTop: 10 },

  // Instagram post modal
  igMediaBadge    : { backgroundColor: Colors.bgCard, borderRadius: 20, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  igMediaBadgeText: { color: Colors.textPrimary, fontSize: 12, fontWeight: "700" },
  captionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  aiCaptionBtn    : { backgroundColor: Colors.primary + "22", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary + "44", flexDirection: "row", alignItems: "center", gap: 4 },
  aiCaptionBtnText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  igTipCard   : { backgroundColor: "rgba(108,71,255,0.08)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.primary + "33", marginBottom: 10 },
  igTipTitle  : { color: Colors.primary, fontSize: 12, fontWeight: "800", marginBottom: 6 },
  igTipText   : { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },

  successBox    : { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  successTitle  : { color: Colors.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "center" },
  successSub    : { color: Colors.textSecondary, fontSize: 14, textAlign: "center", marginTop: 6 },

  // Video modal
  videoWaitCard : { backgroundColor: "rgba(108,71,255,0.08)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.primary + "33", marginTop: 12, alignItems: "center", gap: 6 },
  videoWaitText : { color: Colors.primary, fontSize: 14, fontWeight: "700" },
  videoWaitSub  : { color: Colors.textMuted, fontSize: 12, textAlign: "center" },
  promptIdea    : { backgroundColor: Colors.bg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  promptIdeaText: { color: Colors.textSecondary, fontSize: 12, fontStyle: "italic" },
});
