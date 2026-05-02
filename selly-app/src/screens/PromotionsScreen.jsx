import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Modal, FlatList,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import {
  sendFlashSale, sendNewArrival, sendAbandonedCart,
  sendSegmentBroadcast, sendVideoBlast,
  fetchCatalog, fetchCustomers,
} from "../lib/api";

// ── Promo Message Templates ────────────────────────────────────────────────────
const TEMPLATES = {
  flash: [
    { label: "⚡ Urgent Flash Sale",    text: "⚡ FLASH SALE! 🔥 Up to 50% OFF today only! Limited stock — grab yours before it's gone! Reply YES to see what's available!" },
    { label: "🕐 Last 24 Hours",        text: "⏳ Last 24 HOURS only! Our special sale ends tonight at midnight. Don't miss out — prices go back up tomorrow! Reply to order now." },
    { label: "🎉 Weekend Special",      text: "🎉 Weekend Special! Extra discounts this Saturday & Sunday only. Shop now and save big before Monday! Reply to explore." },
    { label: "🪔 Diwali Dhamaka",       text: "🪔 Diwali Dhamaka Sale is HERE! Amazing deals on all items. Celebrate the festival of lights with extra savings! 🎆 Reply to shop now!" },
    { label: "🌟 New Year Sale",        text: "🎊 New Year, New Deals! Ring in the new year with our biggest sale ever. Up to 40% off storewide — today only! 🥳 Reply YES to start shopping." },
    { label: "☀️ Summer Clearance",     text: "☀️ Summer Clearance! Hot deals on our bestsellers. Stock is flying — secure yours now before it's too late! Reply to see the deals." },
    { label: "💘 Valentine's Special",  text: "💘 Valentine's Week Special! Surprise your loved one with something special. Limited edition gifts at unbeatable prices. 🌹 Reply to explore!" },
    { label: "🎒 Back to School",       text: "🎒 Back to School SALE! Unbeatable deals on everything you need this term. Limited time only — reply to grab your picks before stock runs out!" },
  ],
  arrival: [
    { label: "✨ New Collection Drop",  text: "✨ NEW COLLECTION IS HERE! Fresh styles, exclusive designs — just arrived. Be the first to grab your favourites! 😍 Reply to browse now." },
    { label: "🆕 Trending New Arrivals",text: "🆕 Just In — What's trending right now! Our hottest new arrivals are flying off the shelves. Don't wait — reply to explore now!" },
    { label: "👑 Premium Line Launch",  text: "👑 Introducing our Premium Line! Exclusive, high-quality pieces for those who love the best. Reply PREMIUM to see the collection." },
    { label: "🌸 Festive Range",        text: "🌸 Our Festive Range is now live! Stunning outfits and gifts perfect for the season. Limited pieces — reply to book yours!" },
    { label: "📚 New Batch Starting",   text: "📚 New Batch Starting Soon! Limited seats available — enroll now and secure your spot. Reply ENROLL to know fees, schedule & get a free demo class!" },
    { label: "✈️ New Tour Package",     text: "✈️ Exciting New Tour Package just launched! Handpicked destinations, amazing experiences, unbeatable prices. Reply TRAVEL to see full details!" },
  ],
  segment: [
    { label: "⭐ VIP Exclusive Reward", text: "Hey! 🌟 As one of our VIP customers, you get EARLY ACCESS to our new collection + an extra 10% discount. This offer is only for you — reply to claim it!" },
    { label: "💤 Win-Back (We Miss You)", text: "Hey! 👋 It's been a while and we miss you! We've got exciting new products waiting for you + a special comeback offer. Reply to see what's new! 🎁" },
    { label: "🌱 New Customer Welcome", text: "Welcome to the family! 🎉 As a new member, here's a special offer just for you. Reply to explore our bestsellers and claim your first-time discount!" },
    { label: "🔄 Loyal Shopper Thanks", text: "Thank you for coming back! 💙 You're one of our most loyal customers and we truly appreciate it. Here's a special thank-you offer — reply to redeem!" },
    { label: "🎯 Personalised Deal",    text: "Hey! 🎯 We've curated a special offer just based on your past purchases. This personalised deal is valid for 48 hours only — reply to claim!" },
    { label: "📚 Education Promo",      text: "📚 Exciting news! New courses available at special prices. Early bird seats filling fast. Reply COURSE to get the full schedule and enroll before it's too late!" },
    { label: "🏔️ Tourism Deal Alert",   text: "✈️ Exclusive Travel Deal just for you! Amazing packages at unbeatable prices. Early booking bonus included. Reply TRAVEL to see destinations & pricing!" },
    { label: "😴 Inactive Nudge",       text: "Hey, we noticed you haven't been around for a while 😊 We'd love to have you back! Here's a special returning-customer deal — just reply and we'll sort you out!" },
  ],
  video: [
    { label: "🎬 Product Showcase",     text: "🎬 Check out our latest collection in action! Watch the full video and let us know what you love. Reply to order or for more details! 😍" },
    { label: "🔥 Sale Announcement",    text: "🔥 BIG SALE happening RIGHT NOW! Watch this video to see today's hottest deals. Limited stock — reply YES to grab yours before it's gone!" },
    { label: "📖 Tutorial / How-to",    text: "Hey! Here's a quick how-to video for you 📖 Watch till the end — it's super helpful! Reply if you have any questions or want to place an order." },
    { label: "🌟 Customer Story",       text: "🌟 See what our happy customers are saying! Real experiences, real results. Watch this and then reply to place your own order today!" },
    { label: "✈️ Tour Package Preview", text: "✈️ Take a sneak peek at our exclusive travel package! Watch the video and picture yourself there. Reply BOOK to get full details and pricing." },
    { label: "📚 Course Demo",          text: "📚 Watch a free demo of our course! See exactly what you'll learn and how it can transform your career. Reply DEMO to enroll or ask anything." },
    { label: "👑 New Product Launch",   text: "👑 Big reveal! Our most exciting new product is finally here. Watch to see it in action and reply to be among the first to own it! 🚀" },
  ],
};

const SEGMENTS = [
  { key: "all",      label: "All",     emoji: "👥" },
  { key: "vip",      label: "VIP",      emoji: "⭐" },
  { key: "new",      label: "New",      emoji: "🌱" },
  { key: "inactive", label: "Inactive", emoji: "💤" },
  { key: "repeat",   label: "Repeat",   emoji: "🔄" },
];

const SEGMENT_DESC = {
  vip:      "⭐ Customers who have spent ₹5,000+",
  new:      "🌱 Customers who joined in the last 30 days",
  inactive: "💤 Customers with no activity in the last 60 days",
  repeat:   "🔄 Customers with 2 or more orders",
  all:      "👥 All your customers",
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PromotionsScreen() {
  const [products, setProducts]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);

  // Flash Sale
  const [flashMsg, setFlashMsg]     = useState("⚡ Flash Sale! Limited time offer on selected items.");
  const [selectedProds, setSelectedProds] = useState([]);

  // New Arrival
  const [arrivalMsg, setArrivalMsg] = useState("✨ New Arrivals are here! Check out our latest collection.");

  // Segment Broadcast
  const [segMsg, setSegMsg]         = useState("");
  const [segment, setSegment]       = useState("all");
  const [segProds, setSegProds]     = useState([]);

  // Video Blast
  const [videoUrl, setVideoUrl]     = useState("");
  const [videoCaption, setVideoCaption] = useState("🎬 Check out our latest collection in action! Reply to order or know more 😍");
  const [videoSegment, setVideoSegment] = useState("all");

  // Modals
  const [pickModal, setPickModal]   = useState(null); // "flash" | "arrival" | "segment" | "video"
  const [templateType, setTemplateType] = useState(null);
  const [templateSetter, setTemplateSetter] = useState(null);

  const load = async () => {
    try {
      const [c, cu] = await Promise.all([fetchCatalog(), fetchCustomers()]);
      setProducts(c.products || []);
      setCustomers(cu.customers || []);
    } catch (e) { console.warn(e.message); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const show = (msg, ok = true) => setResult({ msg, ok });

  const openTemplates = (type, setter) => {
    setTemplateType(type);
    setTemplateSetter(() => setter);
  };

  // ── Send handlers ─────────────────────────────────────────────────────────
  const sendFlash = async () => {
    if (selectedProds.length === 0) { show("Select at least one product.", false); return; }
    setLoading(true);
    try {
      const d = await sendFlashSale({ productIds: selectedProds, message: flashMsg });
      show(`✅ Flash sale sent to ${d.sent || 0} customers!`);
      setSelectedProds([]);
    } catch (e) { show("Error: " + e.message, false); }
    finally { setLoading(false); }
  };

  const sendArrival = async () => {
    if (selectedProds.length === 0) { show("Select at least one product.", false); return; }
    setLoading(true);
    try {
      const d = await sendNewArrival({ productIds: selectedProds, message: arrivalMsg });
      show(`✅ New arrival sent to ${d.sent || 0} customers!`);
      setSelectedProds([]);
    } catch (e) { show("Error: " + e.message, false); }
    finally { setLoading(false); }
  };

  const sendSegment = async () => {
    if (!segMsg.trim()) { show("Enter a message to send.", false); return; }
    setLoading(true);
    try {
      const d = await sendSegmentBroadcast({ segment, message: segMsg, productIds: segProds });
      show(`✅ Sent to ${d.sent || 0} "${segment}" customers!`);
      setSegMsg(""); setSegProds([]);
    } catch (e) { show("Error: " + e.message, false); }
    finally { setLoading(false); }
  };

  const sendAbandoned = async () => {
    setLoading(true);
    try {
      const d = await sendAbandonedCart();
      show(`✅ Recovery DMs sent to ${d.sent || 0} customers with abandoned carts.`);
    } catch (e) { show("Error: " + e.message, false); }
    finally { setLoading(false); }
  };

  const sendVideo = async () => {
    if (!videoUrl.trim())     { show("Paste a hosted video URL first.", false); return; }
    if (!videoCaption.trim()) { show("Enter a caption for the video.", false); return; }
    setLoading(true);
    try {
      const d = await sendVideoBlast({ videoUrl: videoUrl.trim(), caption: videoCaption, segment: videoSegment });
      show(`✅ Video sent to ${d.sent || 0} customers!`);
      setVideoUrl("");
    } catch (e) { show("Error: " + e.message, false); }
    finally { setLoading(false); }
  };

  // ── Product list helpers ──────────────────────────────────────────────────
  const selectedNames = products.filter(p => selectedProds.includes(p.id)).map(p => p.name).join(", ");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Promotions</Text>
      <Text style={styles.pageSubtitle}>Blast promotional DMs to your {customers.length} customers</Text>

      {/* Result banner */}
      {result && (
        <TouchableOpacity
          style={[styles.resultBanner, { backgroundColor: result.ok ? Colors.green + "22" : Colors.red + "22" }]}
          onPress={() => setResult(null)}
        >
          <Text style={[styles.resultText, { color: result.ok ? Colors.green : Colors.red }]}>{result.msg}</Text>
          <Text style={styles.dismissText}>tap to dismiss</Text>
        </TouchableOpacity>
      )}

      {/* Shared product picker box (for Flash + New Arrival) */}
      <View style={styles.pickerBox}>
        <Text style={styles.pickerLabel}>Selected Products ({selectedProds.length})</Text>
        {selectedNames
          ? <Text style={styles.pickerNames} numberOfLines={2}>{selectedNames}</Text>
          : <Text style={styles.pickerEmpty}>No products selected — tap "Choose" below</Text>
        }
        <TouchableOpacity style={styles.chooseBtn} onPress={() => setPickModal("flash")}>
          <Text style={styles.chooseBtnText}>Choose Products</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Flash Sale ──────────────────────────────────────────────────── */}
      <PromoCard icon="⚡" title="Flash Sale" color={Colors.yellow}
        description="Send an urgent limited-time DM to all customers. Marks orders with flash_sale attribution."
        customersCount={customers.length}
      >
        <MsgField
          label="Message"
          value={flashMsg}
          onChange={setFlashMsg}
          onTemplate={() => openTemplates("flash", setFlashMsg)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.yellow }, loading && styles.sendBtnDisabled]}
          onPress={sendFlash} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#000" />
            : <Text style={[styles.sendBtnText, { color: "#000" }]}>Send Flash Sale DMs</Text>}
        </TouchableOpacity>
      </PromoCard>

      {/* ─── New Arrival ─────────────────────────────────────────────────── */}
      <PromoCard icon="✨" title="New Arrival" color={Colors.blue}
        description="Announce new products to all customers. Marks orders with new_arrival attribution."
        customersCount={customers.length}
      >
        <MsgField
          label="Message"
          value={arrivalMsg}
          onChange={setArrivalMsg}
          onTemplate={() => openTemplates("arrival", setArrivalMsg)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.blue }, loading && styles.sendBtnDisabled]}
          onPress={sendArrival} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>Send New Arrival DMs</Text>}
        </TouchableOpacity>
      </PromoCard>

      {/* ─── Abandoned Cart Recovery ─────────────────────────────────────── */}
      <PromoCard icon="🛒" title="Abandoned Cart Recovery" color={Colors.accent}
        description="Re-engage customers who started a conversation but didn't complete an order in the last 24 hours."
        customersCount={customers.length}
      >
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Automatically finds customers who haven't ordered in 24h and sends a nudge DM.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.accent }, loading && styles.sendBtnDisabled]}
          onPress={sendAbandoned} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>Recover Abandoned Carts</Text>}
        </TouchableOpacity>
      </PromoCard>

      {/* ─── Segment Broadcast ───────────────────────────────────────────── */}
      <PromoCard icon="🎯" title="Segment Broadcast" color={Colors.primary}
        description="Target specific customer groups — VIPs, new customers, inactive buyers, or repeat shoppers."
        customersCount={customers.length}
      >
        <Text style={styles.fieldLabel}>Target Segment</Text>
        <SegmentSelector value={segment} onChange={setSegment} />

        {/* Optional product picker */}
        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Products (optional)</Text>
        {segProds.length > 0 && (
          <Text style={styles.pickerNames} numberOfLines={1}>
            {products.filter(p => segProds.includes(p.id)).map(p => p.name).join(", ")}
          </Text>
        )}
        <TouchableOpacity style={styles.chooseBtn} onPress={() => setPickModal("segment")}>
          <Text style={styles.chooseBtnText}>
            {segProds.length > 0 ? `${segProds.length} product(s) selected` : "Choose Products (optional)"}
          </Text>
        </TouchableOpacity>

        <MsgField
          label="Message"
          value={segMsg}
          onChange={setSegMsg}
          placeholder={`Write your message for ${segment} customers...`}
          onTemplate={() => openTemplates("segment", setSegMsg)}
          topMargin
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.primary }, loading && styles.sendBtnDisabled]}
          onPress={sendSegment} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>
                Send to {SEGMENTS.find(s => s.key === segment)?.label} Customers →
              </Text>
          }
        </TouchableOpacity>
      </PromoCard>

      {/* ─── Video Blast ─────────────────────────────────────────────────── */}
      <PromoCard icon="🎬" title="Video Blast" color="#E040FB"
        description="Send a video with a caption to a customer segment. Host the video online (Google Drive, S3, or any public URL) and paste the link here."
        customersCount={customers.length}
      >
        {/* Video URL */}
        <Text style={styles.fieldLabel}>Video URL (public link)</Text>
        <TextInput
          style={styles.msgInput}
          value={videoUrl}
          onChangeText={setVideoUrl}
          placeholder="https://drive.google.com/uc?id=... or any public .mp4 link"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          keyboardType="url"
        />
        <View style={styles.videoHint}>
          <Text style={styles.videoHintText}>
            💡 Use a direct download link. WhatsApp supports MP4/3GP up to 16 MB.
          </Text>
        </View>

        {/* Target Segment */}
        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Target Segment</Text>
        <SegmentSelector value={videoSegment} onChange={setVideoSegment} />

        {/* Caption */}
        <MsgField
          label="Caption"
          value={videoCaption}
          onChange={setVideoCaption}
          placeholder="Write a caption for the video..."
          onTemplate={() => openTemplates("video", setVideoCaption)}
          topMargin
        />

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: "#E040FB" }, loading && styles.sendBtnDisabled]}
          onPress={sendVideo} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>
                Send Video to {SEGMENTS.find(s => s.key === videoSegment)?.label} Customers →
              </Text>
          }
        </TouchableOpacity>
      </PromoCard>

      {/* Commission note */}
      <View style={styles.commissionNote}>
        <Text style={styles.commissionTitle}>💳 Commission Reminder</Text>
        <Text style={styles.commissionText}>
          Orders placed via Flash Sale, New Arrival, Abandoned Cart, or Referral promotions where
          any item is priced above ₹1,000 will attract a 5% commission from Selly.
        </Text>
      </View>

      {/* ── Product Picker Modal ───────────────────────────────────────────── */}
      <Modal visible={!!pickModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick Products</Text>
              <TouchableOpacity onPress={() => setPickModal(null)}>
                <Text style={styles.closeBtn}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={products}
              keyExtractor={p => String(p.id)}
              renderItem={({ item }) => {
                const isSegMode = pickModal === "segment";
                const list    = isSegMode ? segProds : selectedProds;
                const setList = isSegMode ? setSegProds : setSelectedProds;
                const sel = list.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.pickItem, sel && styles.pickItemActive]}
                    onPress={() => setList(prev =>
                      prev.includes(item.id) ? prev.filter(p => p !== item.id) : [...prev, item.id]
                    )}
                  >
                    <Text style={styles.pickName}>{item.name}</Text>
                    <Text style={styles.pickPrice}>₹{(item.price || 0).toLocaleString("en-IN")}</Text>
                    {sel && <Text style={styles.pickCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Template Picker Modal ─────────────────────────────────────────── */}
      <Modal visible={!!templateType} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 Message Templates</Text>
              <TouchableOpacity onPress={() => setTemplateType(null)}>
                <Text style={styles.closeBtn}>Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.templateHint}>Tap a template to use it — you can edit it after.</Text>
            <FlatList
              data={TEMPLATES[templateType] || []}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.templateItem}
                  onPress={() => {
                    if (templateSetter) templateSetter(item.text);
                    setTemplateType(null);
                  }}
                >
                  <Text style={styles.templateLabel}>{item.label}</Text>
                  <Text style={styles.templatePreview} numberOfLines={2}>{item.text}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.templateSep} />}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PromoCard({ icon, title, color, description, customersCount, children }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={[styles.promoCard, { borderColor: color + "33" }]}>
      <TouchableOpacity style={styles.promoCardHeader} onPress={() => setOpen(o => !o)}>
        <View style={[styles.promoIcon, { backgroundColor: color + "22" }]}>
          <Text style={styles.promoIconText}>{icon}</Text>
        </View>
        <View style={styles.promoCardMeta}>
          <Text style={[styles.promoTitle, { color }]}>{title}</Text>
          <Text style={styles.promoAudience}>→ {customersCount} customers</Text>
        </View>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.promoCardBody}>
          <Text style={styles.promoDesc}>{description}</Text>
          {children}
        </View>
      )}
    </View>
  );
}

function SegmentSelector({ value, onChange }) {
  return (
    <>
      <View style={styles.segmentRow}>
        {SEGMENTS.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.segBtn, value === s.key && styles.segBtnActive]}
            onPress={() => onChange(s.key)}
          >
            <Text style={styles.segBtnEmoji}>{s.emoji}</Text>
            <Text style={[styles.segBtnText, value === s.key && { color: Colors.primary }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.segInfoBox}>
        <Text style={styles.segInfoText}>{SEGMENT_DESC[value]}</Text>
      </View>
    </>
  );
}

function MsgField({ label, value, onChange, placeholder, onTemplate, topMargin = false }) {
  return (
    <View style={topMargin ? { marginTop: 10 } : undefined}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TouchableOpacity style={styles.templateBtn} onPress={onTemplate}>
          <Text style={styles.templateBtnText}>📋 Templates</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.msgInput}
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={3}
        placeholder={placeholder || "Write your message..."}
        placeholderTextColor={Colors.textMuted}
        textAlignVertical="top"
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: Colors.bg },
  content     : { padding: 16, paddingBottom: 40 },
  pageTitle   : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", marginBottom: 4 },
  pageSubtitle: { color: Colors.textSecondary, fontSize: 13, marginBottom: 20 },

  resultBanner: { borderRadius: 12, padding: 14, marginBottom: 16 },
  resultText  : { fontSize: 14, fontWeight: "700" },
  dismissText : { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  pickerBox   : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.primary + "33" },
  pickerLabel : { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  pickerNames : { color: Colors.textPrimary, fontSize: 13, marginBottom: 8 },
  pickerEmpty : { color: Colors.textMuted, fontSize: 13, marginBottom: 8, fontStyle: "italic" },
  chooseBtn   : { backgroundColor: Colors.primary + "22", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.primary + "44" },
  chooseBtnText: { color: Colors.primary, fontWeight: "700", fontSize: 13 },

  promoCard       : { backgroundColor: Colors.bgCard, borderRadius: 16, marginBottom: 16, borderWidth: 1, overflow: "hidden" },
  promoCardHeader : { flexDirection: "row", alignItems: "center", padding: 14 },
  promoIcon       : { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  promoIconText   : { fontSize: 22 },
  promoCardMeta   : { flex: 1 },
  promoTitle      : { fontSize: 16, fontWeight: "800" },
  promoAudience   : { color: Colors.textMuted, fontSize: 12 },
  chevron         : { color: Colors.textMuted, fontSize: 14 },
  promoCardBody   : { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  promoDesc       : { color: Colors.textSecondary, fontSize: 13, marginTop: 10, marginBottom: 12, lineHeight: 18 },

  fieldLabelRow : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  fieldLabel    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  templateBtn   : { backgroundColor: Colors.bgInput, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border },
  templateBtnText: { color: Colors.primary, fontSize: 11, fontWeight: "700" },

  msgInput    : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 13, borderWidth: 1, borderColor: Colors.border, textAlignVertical: "top", minHeight: 80 },
  sendBtn     : { borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText : { color: "#fff", fontWeight: "800", fontSize: 15 },

  infoBox  : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  infoText : { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },

  videoHint    : { marginTop: 6, marginBottom: 4 },
  videoHintText: { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },

  commissionNote : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.primary + "33", marginTop: 4 },
  commissionTitle: { color: Colors.primary, fontSize: 14, fontWeight: "800", marginBottom: 6 },
  commissionText : { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },

  segmentRow  : { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  segBtn      : { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border },
  segBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  segBtnEmoji : { fontSize: 13 },
  segBtnText  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  segInfoBox  : { backgroundColor: Colors.bgInput, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  segInfoText : { color: Colors.textSecondary, fontSize: 12 },

  modalOverlay : { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet   : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "80%" },
  modalHandle  : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader  : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle   : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  closeBtn     : { color: Colors.primary, fontSize: 16, fontWeight: "700" },
  pickItem     : { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.primary + "15" },
  pickName     : { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  pickPrice    : { color: Colors.primary, fontSize: 14, fontWeight: "700", marginRight: 8 },
  pickCheck    : { color: Colors.green, fontSize: 16, fontWeight: "800" },

  templateHint  : { color: Colors.textMuted, fontSize: 12, marginBottom: 12, fontStyle: "italic" },
  templateItem  : { paddingVertical: 12 },
  templateLabel : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  templatePreview: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  templateSep   : { height: 1, backgroundColor: Colors.border },
});
