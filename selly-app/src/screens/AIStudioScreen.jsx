// ── AI Studio Screen ──────────────────────────────────────────────────────────
// Central hub for all AI-powered features in Selly
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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
    desc     : "Customers send voice notes — bot auto-transcribes & orders",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
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
    comingSoon: false,
    industries: "education",
  },
  {
    id       : "flashcard",
    icon     : "🃏",
    title    : "Flashcard Generator",
    desc     : "Upload chapter → AI creates study flashcards instantly",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
    industries: "education",
  },
  {
    id       : "bulkimport",
    icon     : "📦",
    title    : "Bulk Product Import",
    desc     : "Paste price list or describe products → auto-add all",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
    industries: "all",
  },
  {
    id       : "scanner",
    icon     : "📷",
    title    : "Scan & Sell",
    desc     : "Barcode/SKU lookup → quick bill generation",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
    industries: "kirana,icecream,cakes,product",
  },
  {
    id       : "pricing",
    icon     : "💰",
    title    : "Smart Pricing",
    desc     : "AI suggests optimal prices based on demand & competition",
    badge    : "Free",
    badgeColor: "#22c55e",
    comingSoon: false,
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

// ── Image Generator Modal (Text→Image + Image→Image) ─────────────────────────
function ImageGeneratorModal({ visible, onClose }) {
  const [mode,      setMode]      = useState("text");   // "text" | "transform"
  const [prompt,    setPrompt]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [imageUrl,  setImageUrl]  = useState("");
  const [srcImage,  setSrcImage]  = useState(null);     // { uri, base64 }
  const [strength,  setStrength]  = useState("0.75");   // 0-1

  const MODES = [
    { id: "text",      label: "✨ Text → Image" },
    { id: "transform", label: "🔄 Transform Image" },
  ];

  // Pick image from gallery or camera for img2img
  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to use this feature.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setSrcImage({
        uri   : asset.uri,
        base64: `data:image/jpeg;base64,${asset.base64}`,
      });
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to use this feature.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setSrcImage({
        uri   : asset.uri,
        base64: `data:image/jpeg;base64,${asset.base64}`,
      });
    }
  }

  async function generate() {
    if (!prompt.trim()) return Alert.alert("Enter a prompt first");
    if (mode === "transform" && !srcImage) return Alert.alert("Pick a source image first");
    setLoading(true);
    setImageUrl("");
    try {
      const { getBaseUrl } = await import("../lib/api");
      const base = await getBaseUrl();

      if (mode === "text") {
        const res = await fetch(`${base}/api/ai/image`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({ prompt: prompt.trim() }),
        });
        const data = await res.json();
        if (data.error) return Alert.alert("Error", data.error);
        setImageUrl(data.imageUrl || "");
      } else {
        // img2img — sends base64 source + prompt
        const res = await fetch(`${base}/api/ai/image-transform`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({
            image   : srcImage.base64,
            prompt  : prompt.trim(),
            strength: Number(strength) || 0.75,
          }),
        });
        const data = await res.json();
        if (data.error) return Alert.alert("Error", data.error);
        setImageUrl(data.imageUrl || "");
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }

  const isTransform = mode === "transform";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>🖼️ AI Image Studio</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">

          {/* Mode selector */}
          <View style={styles.typeRow}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.typeBtn, mode === m.id && styles.typeBtnActive]}
                onPress={() => { setMode(m.id); setImageUrl(""); }}
              >
                <Text style={[styles.typeBtnText, mode === m.id && styles.typeBtnTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Source image picker (img2img mode only) */}
          {isTransform && (
            <>
              <Text style={styles.fieldLabel}>Source Image</Text>
              {srcImage ? (
                <View style={styles.srcImageWrap}>
                  <Image source={{ uri: srcImage.uri }} style={styles.srcImagePreview} resizeMode="cover" />
                  <TouchableOpacity style={styles.changeSrcBtn} onPress={() => setSrcImage(null)}>
                    <Text style={styles.changeSrcText}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickRow}>
                  <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
                    <Text style={styles.pickBtnIcon}>🖼️</Text>
                    <Text style={styles.pickBtnText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pickBtn} onPress={takePhoto}>
                    <Text style={styles.pickBtnIcon}>📷</Text>
                    <Text style={styles.pickBtnText}>Camera</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.fieldLabel}>Transformation Strength</Text>
              <View style={styles.strengthRow}>
                {["0.4","0.6","0.75","0.9"].map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.strengthBtn, strength === v && styles.strengthBtnActive]}
                    onPress={() => setStrength(v)}
                  >
                    <Text style={[styles.strengthBtnText, strength === v && styles.strengthBtnTextActive]}>
                      {v === "0.4" ? "Subtle" : v === "0.6" ? "Moderate" : v === "0.75" ? "Strong" : "Max"}
                    </Text>
                    <Text style={[styles.strengthBtnSub, strength === v && { color: Colors.primary }]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hintText}>
                💡 "Subtle" keeps the original close. "Max" heavily transforms it. Use "Strong" for style changes like making a product photo look like a painting.
              </Text>
            </>
          )}

          {/* Prompt */}
          <Text style={styles.fieldLabel}>
            {isTransform ? "How should it be transformed?" : "Describe the image you want"}
          </Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder={isTransform
              ? `e.g. "Make it look like a professional studio product photo with white background"`
              : `e.g. "A beautiful Indian woman wearing a blue silk saree, white background, professional product photo"`
            }
            placeholderTextColor={Colors.textMuted}
            value={prompt}
            onChangeText={setPrompt}
            multiline
          />

          {!isTransform && (
            <Text style={styles.hintText}>💡 Tip: Describe the product, style, background, and mood for best results</Text>
          )}

          <TouchableOpacity style={styles.generateBtn} onPress={generate} disabled={loading}>
            {loading
              ? <><ActivityIndicator color="#fff" /><Text style={[styles.generateBtnText, { marginLeft: 8 }]}>
                  {isTransform ? "Transforming (~45s)..." : "Generating (~30s)..."}
                </Text></>
              : <Text style={styles.generateBtnText}>
                  {isTransform ? "🔄 Transform Image" : "✨ Generate Image"}
                </Text>
            }
          </TouchableOpacity>

          {/* Result */}
          {imageUrl ? (
            <View style={styles.resultBox}>
              {isTransform && srcImage && (
                <>
                  <Text style={styles.resultLabel}>Before:</Text>
                  <Image source={{ uri: srcImage.uri }} style={styles.resultImagePreview} resizeMode="cover" />
                  <Text style={[styles.resultLabel, { marginTop: 12 }]}>After (AI Transformed):</Text>
                </>
              )}
              {!isTransform && <Text style={styles.resultLabel}>Generated Image:</Text>}
              <Image source={{ uri: imageUrl }} style={styles.resultImagePreview} resizeMode="cover" />
              <Text style={[styles.resultText, { color: Colors.textMuted, fontSize: 11, marginTop: 6 }]} numberOfLines={2}>{imageUrl}</Text>
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

// ── Voice Ordering Info Modal ─────────────────────────────────────────────────
function VoiceModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>🎙️ Voice Ordering</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody}>
          <View style={[styles.resultBox, { marginTop: 0 }]}>
            <Text style={styles.resultLabel}>How it works</Text>
            <Text style={styles.resultText}>
              {`Your customers can already send voice notes on WhatsApp!\n\n` +
               `1️⃣  Customer sends a voice note saying what they want\n` +
               `2️⃣  Bot transcribes using Groq Whisper AI\n` +
               `3️⃣  Intent is extracted from the speech\n` +
               `4️⃣  Order flow continues automatically\n\n` +
               `✅  This feature is active by default on your bot — no setup needed!`}
            </Text>
          </View>
          <View style={[styles.resultBox, { marginTop: 12 }]}>
            <Text style={styles.resultLabel}>Tip for better results</Text>
            <Text style={styles.resultText}>
              {`Train your customers to say clear product names. Example:\n\n` +
               `"Mujhe 2 blue cotton kurta chahiye size M"\n` +
               `("I want 2 blue cotton kurta size M")\n\n` +
               `The AI understands Hindi, English, and Hinglish!`}
            </Text>
          </View>
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
      const { getBaseUrl } = await import("../lib/api");
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
      Alert.alert("Error", e.message);
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

// ── Bulk Import Modal ─────────────────────────────────────────────────────────
function BulkImportModal({ visible, onClose }) {
  const [text,    setText]    = useState("");
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function parseProducts() {
    if (!text.trim()) return Alert.alert("Enter product list text first");
    setLoading(true);
    setResult(null);
    try {
      const { getBaseUrl, getBusinessId } = await import("../lib/api");
      const [base, bid] = await Promise.all([getBaseUrl(), getBusinessId()]);
      const res = await fetch(`${base}/api/catalog/parse-import`, {
        method : "POST",
        headers: { "Content-Type": "application/json", "X-Business-ID": bid },
        body   : JSON.stringify({ text: text.trim(), bid }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doImport() {
    if (!result?.products?.length) return;
    setImporting(true);
    try {
      const { getBaseUrl, getBusinessId } = await import("../lib/api");
      const [base, bid] = await Promise.all([getBaseUrl(), getBusinessId()]);
      const res = await fetch(`${base}/api/catalog/bulk-import`, {
        method : "POST",
        headers: { "Content-Type": "application/json", "X-Business-ID": bid },
        body   : JSON.stringify({ products: result.products, bid }),
      });
      const data = await res.json();
      Alert.alert("Success!", `${data.imported || result.products.length} products added to catalog!`, [
        { text: "Done", onPress: () => { setText(""); setResult(null); onClose(); } }
      ]);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>📦 Bulk Product Import</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Paste your product list</Text>
          <Text style={styles.hintText}>
            {"Format: Name - Price - Description (one per line)\nExample:\nBlue Cotton Kurta - 499 - Premium cotton, summer wear\nRed Silk Saree - 1299 - Pure silk, festival special"}
          </Text>
          <TextInput
            style={[styles.input, { height: 140, textAlignVertical: "top" }]}
            placeholder={"Product Name - Price - Description\nAnother Product - Price"}
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.generateBtn} onPress={parseProducts} disabled={loading}>
            {loading
              ? <><ActivityIndicator color="#fff" /><Text style={[styles.generateBtnText, { marginLeft: 8 }]}>Parsing...</Text></>
              : <Text style={styles.generateBtnText}>🔍 Parse Products</Text>
            }
          </TouchableOpacity>

          {result?.products?.length > 0 && (
            <View style={[styles.resultBox, { marginTop: 16 }]}>
              <Text style={styles.resultLabel}>Found {result.products.length} products — preview:</Text>
              {result.products.slice(0, 5).map((p, i) => (
                <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 8 }}>
                  <Text style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: "700" }}>{p.name}</Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>₹{p.price} · {p.description}</Text>
                </View>
              ))}
              {result.products.length > 5 && (
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 6 }}>...and {result.products.length - 5} more</Text>
              )}
              <TouchableOpacity
                style={[styles.generateBtn, { marginTop: 12, backgroundColor: "#22c55e" }]}
                onPress={doImport}
                disabled={importing}
              >
                {importing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.generateBtnText}>✅ Import {result.products.length} Products</Text>
                }
              </TouchableOpacity>
            </View>
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
      const { getBaseUrl, getBusinessId } = await import("../lib/api");
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

// ── Scan & Sell Modal (redirect info) ────────────────────────────────────────
function ScanSellInfoModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>📷 Scan & Sell</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody}>
          <View style={[styles.resultBox, { marginTop: 0 }]}>
            <Text style={styles.resultLabel}>Quick Bill from Barcode/SKU</Text>
            <Text style={styles.resultText}>
              {`Find it in the More tab!\n\n` +
               `Go to: More → Scan & Sell\n\n` +
               `Features:\n` +
               `• Type or scan product barcode/SKU\n` +
               `• Instantly add to bill\n` +
               `• Adjust quantities\n` +
               `• Generate bill with total\n\n` +
               `💡 Add SKU/Product Numbers to your Catalog/Inventory items to enable barcode search.`}
            </Text>
          </View>
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
  const [voiceOpen,    setVoiceOpen]    = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [flashcardOpen,setFlashcardOpen]= useState(false);
  const [bulkOpen,     setBulkOpen]     = useState(false);
  const [pricingOpen,  setPricingOpen]  = useState(false);
  const [scanOpen,     setScanOpen]     = useState(false);

  function handleFeature(id, comingSoon) {
    if (comingSoon) {
      Alert.alert("Coming Soon", "This feature is in development and will be available soon! 🚀");
      return;
    }
    if (id === "caption" || id === "reel") setCaptionOpen(true);
    if (id === "image")    setImageOpen(true);
    if (id === "insights") setInsightsOpen(true);
    if (id === "voice")    setVoiceOpen(true);
    if (id === "notebook") setNotebookOpen(true);
    if (id === "flashcard")setFlashcardOpen(true);
    if (id === "bulkimport") setBulkOpen(true);
    if (id === "pricing")  setPricingOpen(true);
    if (id === "scanner")  setScanOpen(true);
  }

  const visibleFeatures = AI_FEATURES.filter(f =>
    f.industries === "all" || f.industries.split(",").includes(industry)
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <View style={styles.headerTop}>
          <View style={styles.headerLogoWrap}>
            <Text style={styles.headerLogoIcon}>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>AI Studio</Text>
            <Text style={styles.headerSub}>Grow faster with artificial intelligence</Text>
          </View>
        </View>
        <View style={styles.headerBadgeRow}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeDot}>●</Text>
            <Text style={styles.headerBadgeText}>Groq Llama 3</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeDot}>●</Text>
            <Text style={styles.headerBadgeText}>Flux Images</Text>
          </View>
          <View style={[styles.headerBadge, styles.headerBadgeFree]}>
            <Text style={styles.headerBadgeFreeText}>✦ FREE</Text>
          </View>
        </View>
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
      <CaptionWriterModal  visible={captionOpen}   onClose={() => setCaptionOpen(false)}   industry={industry} />
      <ImageGeneratorModal visible={imageOpen}     onClose={() => setImageOpen(false)} />
      <InsightsModal       visible={insightsOpen}  onClose={() => setInsightsOpen(false)}  industry={industry} />
      <VoiceModal          visible={voiceOpen}     onClose={() => setVoiceOpen(false)} />
      <NotebookModal       visible={notebookOpen}  onClose={() => setNotebookOpen(false)} />
      <FlashcardModal      visible={flashcardOpen} onClose={() => setFlashcardOpen(false)} industry={industry} />
      <BulkImportModal     visible={bulkOpen}      onClose={() => setBulkOpen(false)} />
      <SmartPricingModal   visible={pricingOpen}   onClose={() => setPricingOpen(false)}   industry={industry} />
      <ScanSellInfoModal   visible={scanOpen}      onClose={() => setScanOpen(false)} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container : { flex: 1, backgroundColor: Colors.bg },
  content   : { padding: 16, gap: 10, paddingBottom: 40 },

  // Header — professional gradient card
  header         : { backgroundColor: "#0f0a1e", borderRadius: 20, padding: 20, marginBottom: 6, borderWidth: 1, borderColor: Colors.primary + "55", overflow: "hidden" },
  headerGlow     : { position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: Colors.primary + "25" },
  headerTop      : { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  headerLogoWrap : { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.primary + "33", borderWidth: 1, borderColor: Colors.primary + "66", alignItems: "center", justifyContent: "center" },
  headerLogoIcon : { fontSize: 26 },
  headerTitle    : { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 0.3 },
  headerSub      : { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  headerBadgeRow : { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  headerBadge    : { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  headerBadgeDot : { color: "#22c55e", fontSize: 7 },
  headerBadgeText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600" },
  headerBadgeFree: { backgroundColor: Colors.primary + "33", borderColor: Colors.primary + "66" },
  headerBadgeFreeText: { color: Colors.primary, fontSize: 11, fontWeight: "800" },

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
});
