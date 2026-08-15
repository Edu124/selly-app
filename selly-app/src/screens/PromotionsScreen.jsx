import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Modal, FlatList, Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker    from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem     from "expo-file-system";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import { typeConfig } from "../lib/businessTypes";
import {
  sendFlashSale, sendNewArrival, sendAbandonedCart,
  sendSegmentBroadcast, sendVideoBlast,
  sendImageBlast, sendPdfBlast, uploadMedia,
  fetchCatalog, fetchCustomers,
} from "../lib/api";

// ── Promo Message Templates ────────────────────────────────────────────────────
const TEMPLATES_CAFE = {
  flash: [
    { label: "⚡ Happy Hours",          text: "⚡ HAPPY HOURS! 🔥 Flat 30% off all beverages, 4–7 PM today only. Walk in or reply to reserve a table!" },
    { label: "🕐 Last Orders Tonight",  text: "⏳ Kitchen closes in 2 hours! Craving something before we shut? Reply with your order and we'll have it ready." },
    { label: "🎉 Weekend Special",      text: "🎉 Weekend Special! Free dessert with every main course, Saturday & Sunday. Reply to book your table 🍰" },
    { label: "☕ Combo Deal",           text: "☕ Coffee + Croissant for just ₹199 — all day today. Reply to order or just walk in!" },
    { label: "🪔 Festive Menu",         text: "🪔 Our festive menu is live! Special thalis and sweets, this week only. Reply to reserve a table 🎆" },
    { label: "🌧️ Rainy Day Offer",      text: "🌧️ Perfect chai weather! Buy any hot beverage and get pakoras free, today only. Reply to order in." },
    { label: "🎂 Birthday Table",       text: "🎂 Celebrating something? Book a table this week and the cake slice is on us. Reply BOOK with your date." },
  ],
  arrival: [
    { label: "✨ New Menu Launch",      text: "✨ OUR NEW MENU IS HERE! Fresh dishes, new flavours — just launched. Reply MENU to see what's new 😍" },
    { label: "🆕 Dish of the Week",     text: "🆕 This week's special: something we're genuinely proud of. Limited servings daily — reply to reserve yours!" },
    { label: "👑 Chef's Signature",     text: "👑 Introducing our chef's signature dish! Made fresh, in limited numbers. Reply to try it before it's gone." },
    { label: "🌸 Seasonal Menu",        text: "🌸 Our seasonal menu is now live! Fresh produce, new dishes. Reply to book a table and taste the season 🍽️" },
  ],
};

const TEMPLATES_BAKERY = {
  flash: [
    { label: "🍰 Fresh Batch Today",    text: "🍰 Fresh out of the oven! Today's batch is ready — reply to reserve yours before it's sold out." },
    { label: "⏳ Same-Day Slots",       text: "⏳ A few same-day cake slots left for today! Reply CAKE with your flavour and size to grab one." },
    { label: "🎉 Weekend Offer",        text: "🎉 Weekend Special! Flat 15% off on all 1 kg cakes, Saturday & Sunday. Reply to place your order 🎂" },
    { label: "🪔 Festive Hampers",      text: "🪔 Festive hampers are here! Assorted sweets and cookies, beautifully boxed. Reply HAMPER to order 🎁" },
    { label: "💘 Valentine's Special",  text: "💘 Valentine's specials are live — heart cakes, cupcake boxes and more. Order early, slots fill fast 🌹" },
    { label: "🥐 Morning Bake",         text: "🥐 Fresh croissants and breads out at 8 AM daily. Reply to reserve yours for pickup." },
  ],
  arrival: [
    { label: "✨ New Flavour",          text: "✨ NEW FLAVOUR ALERT! Just added to our menu, and we think you'll love it. Reply to try a slice 😍" },
    { label: "🎂 Custom Cakes Open",    text: "🎂 Custom cake orders are open! Any flavour, any size, your exact message on top. Reply CAKE to start." },
    { label: "🧁 New Dessert Range",    text: "🧁 Our new dessert range just launched — cupcakes, tarts and more. Reply to see the full menu!" },
    { label: "🍞 Artisan Breads",       text: "🍞 Freshly baked artisan breads now available daily. Reply BREAD to reserve today's batch." },
  ],
};

const TEMPLATES_CLOUD = {
  flash: [
    { label: "⚡ Lunch Rush Deal",      text: "⚡ LUNCH DEAL! Order before 1 PM and get free delivery + a complimentary dessert. Reply to order now!" },
    { label: "🕐 Dinner Pre-Order",     text: "⏳ Pre-order tonight's dinner now and skip the wait. Reply with your order and we'll deliver hot at your time." },
    { label: "🎉 Weekend Combo",        text: "🎉 Weekend Family Combo — feeds 4, flat ₹699. Order direct and skip the aggregator commission. Reply to order!" },
    { label: "🛵 Free Delivery Today",  text: "🛵 Free delivery on all orders today! Order direct from us — same food, better price. Reply to order." },
    { label: "🪔 Festive Thali",        text: "🪔 Festive thali available this week only. Limited portions daily — reply to reserve yours 🎆" },
  ],
  arrival: [
    { label: "✨ New Menu Launch",      text: "✨ OUR NEW MENU IS LIVE! Fresh dishes added. Reply MENU to see everything and order direct 😍" },
    { label: "🆕 New Dish",             text: "🆕 Just added to the menu — and it's already our team's favourite. Reply to try it today!" },
    { label: "🍱 New Combo Meals",      text: "🍱 New combo meals — a full meal at a better price. Reply COMBO to see the options." },
  ],
};

const TEMPLATES_SEGMENT = [
  { label: "⭐ Regular's Reward",        text: "Hey! 🌟 You're one of our regulars, so here's something just for you — a free dessert on your next visit. Reply to claim it!" },
  { label: "💤 Win-Back (We Miss You)",  text: "Hey! 👋 It's been a while and we miss you! We've added new dishes since you were last here, plus a comeback treat. Reply to see what's new 🎁" },
  { label: "🌱 New Customer Welcome",    text: "Welcome! 🎉 Thanks for your first order. Here's 10% off your next one — reply to see the menu and order again." },
  { label: "🔄 Loyal Customer Thanks",   text: "Thank you for coming back! 💙 You're one of our most loyal customers and we genuinely appreciate it. Here's a thank-you treat — reply to redeem!" },
  { label: "🎯 Your Usual",              text: "Hey! 🎯 Craving your usual? We've got it ready to go. Reply and we'll start on it right away." },
  { label: "😴 Inactive Nudge",          text: "Hey, we haven't seen you in a while 😊 We'd love to have you back — here's a returning-customer offer. Just reply and we'll sort you out!" },
];

// Birthday reminders replace the old fee reminders. The occasions table is what
// feeds these — see OccasionsScreen.
const TEMPLATES_BIRTHDAY = [
  { label: "🎂 Birthday This Week",     text: "🎂 A little birdie told us there's a birthday coming up! Want us to make something special? Reply CAKE and we'll take it from there 💝" },
  { label: "🎉 Birthday Discount",      text: "🎉 Happy birthday month! Here's 15% off anything you order this week — our treat. Reply to use it 🎈" },
  { label: "🔁 Repeat Last Year's Cake", text: "🎂 This time last year we baked you something lovely. Want the same again? Reply YES and we'll have it ready — 10% off for returning customers 💝" },
  { label: "💍 Anniversary Reminder",   text: "💍 An anniversary is coming up! Let us make it easier — cakes, desserts or a reserved table. Reply and we'll sort it out 🥂" },
  { label: "🎁 Celebration Booking",    text: "🎁 Planning a celebration? Book with us this month and the cake is on the house. Reply BOOK with your date 🎉" },
];

// ── Template set for the current business type ────────────────────────────────
function getTemplates(businessTypeId) {
  const base = businessTypeId === "bakery"       ? TEMPLATES_BAKERY
             : businessTypeId === "cloudkitchen" ? TEMPLATES_CLOUD
             :                                     TEMPLATES_CAFE;
  return {
    flash   : base.flash,
    arrival : base.arrival,
    segment : TEMPLATES_SEGMENT,
    birthday: TEMPLATES_BIRTHDAY,
    video   : TEMPLATES_VIDEO,
    image   : TEMPLATES_IMAGE,
    pdf     : TEMPLATES_PDF,
  };
}

const TEMPLATES_VIDEO = [
  { label: "🎬 Dish Showcase",        text: "🎬 Watch our signature dish being made! Fresh, every single time. Reply to order or book a table 😍" },
  { label: "🔥 Offer Announcement",   text: "🔥 Today's offer, in 20 seconds! Watch and reply to claim it before the kitchen closes." },
  { label: "👨‍🍳 Behind the Kitchen",   text: "👨‍🍳 A peek behind our kitchen — this is how your food gets made. Reply if it made you hungry 😋" },
  { label: "🌟 Customer Story",       text: "🌟 What our regulars say about us. Real people, real plates. Reply to book a table and see for yourself!" },
  { label: "✨ New Menu Reveal",      text: "✨ Our new menu, revealed. Watch to see what's new and reply to try it this week 🍽️" },
];

const TEMPLATES_IMAGE = [
  { label: "📸 Today's Special",       text: "📸 Today's special, fresh out of the kitchen! Limited servings — reply to reserve yours 😋" },
  { label: "📋 Full Menu",             text: "📋 Here's our full menu! Save it and reply with what you'd like — we'll have it ready." },
  { label: "🎂 Cake Gallery",          text: "🎂 A few we baked this week. Want something like this? Reply CAKE and tell us the occasion 💝" },
  { label: "📢 Important Notice",      text: "📢 Quick update from us — please have a look. Reply if you have any questions!" },
  { label: "🗓️ This Week's Specials",  text: "🗓️ This week's specials, one image. Save it and reply to order any day 🍽️" },
  { label: "🌟 Event Highlight",       text: "🌟 Highlights from the weekend! Thanks to everyone who came by ❤️" },
];

const TEMPLATES_PDF = [
  { label: "📃 Full Menu Card",        text: "📃 Our full menu is attached! Browse and reply with your order — we'll get started 😍" },
  { label: "🎂 Cake Price List",       text: "🎂 Our cake price list is attached — flavours, sizes and rates. Reply CAKE to place an order 💝" },
  { label: "🍱 Catering Package",      text: "🍱 Our catering packages are attached. Reply with your date and headcount for a quote." },
  { label: "🎉 Party Menu",            text: "🎉 Party and event menu attached. Reply to check availability for your date 🥂" },
  { label: "📑 Invoice / Bill",        text: "📑 Your bill is attached for reference. Thank you for ordering with us 🙏" },
];

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
export default function PromotionsScreen({ route }) {
  const { industry } = useAuth();
  const type      = typeConfig(industry);
  const audience  = "customers";
  const itemWord  = type.itemWord;                     // dish | cake
  const itemWordC = itemWord.charAt(0).toUpperCase() + itemWord.slice(1);
  const templates = getTemplates(type.id);

  const scrollRef       = useRef(null);
  const birthdayYRef    = useRef(0);   // Y offset of the birthday card

  const [products, setProducts]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);

  // Flash Sale
  const [flashMsg, setFlashMsg]     = useState("⚡ Flash offer! Limited time deal on today's specials.");
  const [flashProds,    setFlashProds]    = useState([]);

  // New Arrival
  const [arrivalMsg,  setArrivalMsg]  = useState("✨ Something new on the menu! Come and try it this week.");
  const [arrivalProds, setArrivalProds] = useState([]);

  // Segment Broadcast
  const [segMsg, setSegMsg]         = useState("");
  const [segment, setSegment]       = useState("all");
  const [segProds, setSegProds]     = useState([]);

  // Video Blast
  const [videoUrl, setVideoUrl]     = useState("");
  const [videoCaption, setVideoCaption] = useState(
    "🎬 A look at what we're serving today! Reply to order or book a table 😍"
  );
  const [videoSegment, setVideoSegment] = useState("all");

  // ── Image Blast ──────────────────────────────────────────────────────────────
  const [imageUri,     setImageUri]     = useState(null);   // local preview URI
  const [imageUrl,     setImageUrl]     = useState("");      // hosted URL after upload
  const [imageCaption, setImageCaption] = useState(
    "📸 Fresh out of the kitchen! Reply to order 😋"
  );
  const [imageSegment, setImageSegment] = useState("all");
  const [imageUploading, setImageUploading] = useState(false);

  // ── PDF Blast ────────────────────────────────────────────────────────────────
  const [pdfUri,      setPdfUri]      = useState(null);
  const [pdfUrl,      setPdfUrl]      = useState("");
  const [pdfFilename, setPdfFilename] = useState("Menu.pdf");
  const [pdfCaption,  setPdfCaption]  = useState(
    "📃 Our full menu is attached — reply with what you'd like!"
  );
  const [pdfSegment,  setPdfSegment]  = useState("all");
  const [pdfUploading, setPdfUploading] = useState(false);

  // Birthday / occasion campaign — replaces the old fee reminder.
  const [bdayMsg, setBdayMsg] = useState(
    "🎂 A little birdie told us there's a birthday coming up! Want us to make something special? Reply CAKE and we'll take it from there 💝"
  );
  const [bdaySeg, setBdaySeg] = useState("all");

  // Modals
  const [pickModal, setPickModal]   = useState(null);
  const [templateType, setTemplateType] = useState(null);
  const [templateSetter, setTemplateSetter] = useState(null);

  // Auto-scroll to the birthday card when opened from a dashboard quick action
  useEffect(() => {
    if (route?.params?.action === "birthday" && birthdayYRef.current) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: birthdayYRef.current - 16, animated: true });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [route?.params?.action]);

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

  // ── Pick & upload image ───────────────────────────────────────────────────────
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { show("Gallery permission required.", false); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality   : 0.75,
      base64    : false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setImageUrl(""); // clear previous hosted URL
    setImageUploading(true);
    try {
      const base64   = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const filename = asset.uri.split("/").pop() || "image.jpg";
      const mimeType = asset.type === "image" ? "image/jpeg" : "image/png";
      const d = await uploadMedia({ base64, mimeType, filename });
      setImageUrl(d.url);
    } catch (e) {
      show("Upload failed: " + e.message, false);
    } finally {
      setImageUploading(false);
    }
  };

  // ── Pick & upload PDF ─────────────────────────────────────────────────────────
  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type               : ["application/pdf", "*/*"],
        copyToCacheDirectory: true,
      });
      // Handle both Expo SDK 49- (result.type) and 50+ (result.canceled / result.assets)
      const asset = result.assets ? result.assets[0] : (result.type === "success" ? result : null);
      if (!asset) return;
      const uri      = asset.uri;
      const fname    = asset.name || "Document.pdf";
      setPdfUri(uri);
      setPdfFilename(fname);
      setPdfUrl("");
      setPdfUploading(true);
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const d = await uploadMedia({ base64, mimeType: "application/pdf", filename: fname });
      setPdfUrl(d.url);
    } catch (e) {
      show("PDF upload failed: " + e.message, false);
    } finally {
      setPdfUploading(false);
    }
  };

  // ── Send handlers ─────────────────────────────────────────────────────────────
  const sendImage = async () => {
    const url = imageUrl.trim();
    if (!url) { show("Pick or paste an image first.", false); return; }
    setLoading(true);
    try {
      const d = await sendImageBlast({ imageUrl: url, caption: imageCaption, segment: imageSegment });
      show(`✅ Image sent to ${d.sent || 0} ${audience}!`);
      setImageUri(null); setImageUrl("");
    } catch (e) { show("Error: " + e.message, false); }
    finally { setLoading(false); }
  };

  const sendPdf = async () => {
    const url = pdfUrl.trim();
    if (!url) { show("Pick or paste a PDF first.", false); return; }
    setLoading(true);
    try {
      const d = await sendPdfBlast({ pdfUrl: url, caption: pdfCaption, filename: pdfFilename, segment: pdfSegment });
      show(`✅ PDF sent to ${d.sent || 0} ${audience}!`);
      setPdfUri(null); setPdfUrl("");
    } catch (e) { show("Error: " + e.message, false); }
    finally { setLoading(false); }
  };

  // ── Send handlers ─────────────────────────────────────────────────────────
  const sendFlash = async () => {
    if (flashProds.length === 0) { show(`Select at least one ${itemWord}.`, false); return; }
    setLoading(true);
    try {
      const d = await sendFlashSale({ productIds: flashProds, message: flashMsg });
      show(`✅ Flash offer sent to ${d.sent || 0} ${audience}!`);
      setFlashProds([]);
    } catch (e) { show("Error: " + e.message, false); }
    finally { setLoading(false); }
  };

  const sendArrival = async () => {
    if (arrivalProds.length === 0) { show(`Select at least one ${itemWord}.`, false); return; }
    setLoading(true);
    try {
      const d = await sendNewArrival({ productIds: arrivalProds, message: arrivalMsg });
      show(`✅ Announcement sent to ${d.sent || 0} ${audience}!`);
      setArrivalProds([]);
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

  const sendBirthday = async () => {
    if (!bdayMsg.trim()) { show("Enter a message to send.", false); return; }
    setLoading(true);
    try {
      const d = await sendSegmentBroadcast({ segment: bdaySeg, message: bdayMsg, productIds: [] });
      show(`✅ Birthday offer sent to ${d.sent || 0} ${audience}!`);
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
  const flashNames   = products.filter(p => flashProds.includes(p.id)).map(p => p.name).join(", ");
  const arrivalNames = products.filter(p => arrivalProds.includes(p.id)).map(p => p.name).join(", ");

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Promotions</Text>
      <Text style={styles.pageSubtitle}>Blast promotional DMs to your {customers.length} {audience}</Text>

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

      {/* ─── Flash offer ─────────────────────────────────────────────────── */}
      <PromoCard
        icon="⚡"
        title="Flash Offer"
        color={Colors.yellow}
        description="Send an urgent limited-time offer to all customers. Marks orders with flash_sale attribution."
        customersCount={customers.length}
      >
        <Text style={styles.fieldLabel}>{itemWordC}es to promote</Text>
        {flashNames
          ? <Text style={styles.pickerNames} numberOfLines={2}>{flashNames}</Text>
          : <Text style={styles.pickerEmpty}>Nothing selected yet</Text>}
        <TouchableOpacity style={[styles.chooseBtn, { marginBottom: 10 }]} onPress={() => setPickModal("flash")}>
          <Text style={styles.chooseBtnText}>
            {flashProds.length > 0 ? `${flashProds.length} selected — change` : `Choose ${itemWord}es`}
          </Text>
        </TouchableOpacity>

        <MsgField
          label="Message"
          value={flashMsg}
          onChange={setFlashMsg}
          onTemplate={() => openTemplates("flash", setFlashMsg)}
          topMargin
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.yellow }, loading && styles.sendBtnDisabled]}
          onPress={sendFlash} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#000" />
            : <Text style={[styles.sendBtnText, { color: "#000" }]}>Send Flash Offer</Text>}
        </TouchableOpacity>
      </PromoCard>

      {/* ─── New on the menu ─────────────────────────────────────────────── */}
      <PromoCard
        icon="✨"
        title="New on the Menu"
        color={Colors.blue}
        description="Announce something new to all customers. Marks orders with new_arrival attribution."
        customersCount={customers.length}
      >
        <Text style={styles.fieldLabel}>{itemWordC}es to announce</Text>
        {arrivalNames
          ? <Text style={styles.pickerNames} numberOfLines={2}>{arrivalNames}</Text>
          : <Text style={styles.pickerEmpty}>Nothing selected yet</Text>}
        <TouchableOpacity style={[styles.chooseBtn, { marginBottom: 10 }]} onPress={() => setPickModal("arrival")}>
          <Text style={styles.chooseBtnText}>
            {arrivalProds.length > 0 ? `${arrivalProds.length} selected — change` : `Choose ${itemWord}es`}
          </Text>
        </TouchableOpacity>

        <MsgField
          label="Message"
          value={arrivalMsg}
          onChange={setArrivalMsg}
          onTemplate={() => openTemplates("arrival", setArrivalMsg)}
          topMargin
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.blue }, loading && styles.sendBtnDisabled]}
          onPress={sendArrival} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>Send Announcement</Text>}
        </TouchableOpacity>
      </PromoCard>

      {/* ─── Abandoned cart recovery ─────────────────────────────────────── */}
      <PromoCard
        icon="🛒"
        title="Abandoned Cart Recovery"
        color={Colors.accent}
        description="Re-engage customers who started an order but didn't finish it in the last 24 hours."
        customersCount={customers.length}
      >
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Finds customers who haven't completed an order in 24h and sends a nudge.
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

      {/* ─── Birthdays & occasions ──────────────────────────────────────── */}
      <View onLayout={e => { birthdayYRef.current = e.nativeEvent.layout.y; }}>
        <PromoCard
          icon="🎂"
          title="Birthdays & Occasions"
          color={Colors.accent}
          description="A birthday you already know about is the cheapest order you'll ever get. Send the offer before someone else does."
          customersCount={customers.length}
        >
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 This sends to a customer segment. For per-person reminders driven by
              saved birthdays, use the Occasions screen.
            </Text>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Target segment</Text>
          <SegmentSelector value={bdaySeg} onChange={setBdaySeg} />

          <MsgField
            label="Message"
            value={bdayMsg}
            onChange={setBdayMsg}
            placeholder="Write your birthday offer…"
            onTemplate={() => openTemplates("birthday", setBdayMsg)}
            topMargin
          />

          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: Colors.accent }, loading && styles.sendBtnDisabled]}
            onPress={sendBirthday}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.sendBtnText}>
                  Send to {SEGMENTS.find(s => s.key === bdaySeg)?.label} Customers →
                </Text>
            }
          </TouchableOpacity>
        </PromoCard>
      </View>

      {/* ─── Segment Broadcast ───────────────────────────────────────────── */}
      <PromoCard icon="🎯" title="Segment Broadcast" color={Colors.primary}
        description="Target specific customer groups — regulars, new customers, inactive, or repeat buyers."
        customersCount={customers.length}
      >
        <Text style={styles.fieldLabel}>Target Segment</Text>
        <SegmentSelector value={segment} onChange={setSegment} />

        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{itemWordC}es (optional)</Text>
        {segProds.length > 0 && (
          <Text style={styles.pickerNames} numberOfLines={1}>
            {products.filter(p => segProds.includes(p.id)).map(p => p.name).join(", ")}
          </Text>
        )}
        <TouchableOpacity style={styles.chooseBtn} onPress={() => setPickModal("segment")}>
          <Text style={styles.chooseBtnText}>
            {segProds.length > 0
              ? `${segProds.length} ${itemWord}(s) selected`
              : `Choose ${itemWord}es (optional)`}
          </Text>
        </TouchableOpacity>

        <MsgField
          label="Message"
          value={segMsg}
          onChange={setSegMsg}
          placeholder={`Write your message for ${segment} ${audience}...`}
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

      {/* ─── Image / Photo Blast ─────────────────────────────────────────── */}
      <PromoCard icon="📸" title="Photo Blast" color="#00BCD4"
        description="Send a photo of today's specials, the menu or an announcement to all or a segment of customers."
        customersCount={customers.length}
        audience={audience}
      >
        {/* Pick from device */}
        <TouchableOpacity style={styles.mediaPickBtn} onPress={pickImage} disabled={imageUploading}>
          {imageUploading
            ? <ActivityIndicator color="#00BCD4" />
            : <Text style={[styles.mediaPickBtnText, { color: "#00BCD4" }]}>
                {imageUri ? "📷 Change Photo" : "📷 Pick Photo from Gallery"}
              </Text>
          }
        </TouchableOpacity>

        {/* Image preview */}
        {imageUri ? (
          <View style={styles.mediaPreviewWrap}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
            {imageUrl
              ? <Text style={styles.uploadedBadge}>✅ Uploaded & ready to send</Text>
              : <Text style={styles.uploadingBadge}>⏳ Uploading…</Text>
            }
          </View>
        ) : (
          /* Fallback: paste URL directly */
          <>
            <Text style={[styles.orDivider]}>— or paste a public URL —</Text>
            <TextInput
              style={styles.msgInput}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://... (public image link)"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </>
        )}

        {/* Target Segment */}
        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Target</Text>
        <SegmentSelector value={imageSegment} onChange={setImageSegment} />

        {/* Caption */}
        <MsgField
          label="Caption"
          value={imageCaption}
          onChange={setImageCaption}
          placeholder="Write a caption…"
          onTemplate={() => openTemplates("image", setImageCaption)}
          topMargin
        />

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: "#00BCD4" }, (loading || imageUploading) && styles.sendBtnDisabled]}
          onPress={sendImage} disabled={loading || imageUploading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>
                Send Photo to {SEGMENTS.find(s => s.key === imageSegment)?.label} {audience.charAt(0).toUpperCase() + audience.slice(1)} →
              </Text>
          }
        </TouchableOpacity>
      </PromoCard>

      {/* ─── PDF / Notes Blast ───────────────────────────────────────────── */}
      <PromoCard icon="📄" title="PDF Blast" color="#FF7043"
        description="Send your menu card, price list or catering package as a PDF to all or a segment of customers."
        customersCount={customers.length}
        audience={audience}
      >
        {/* Pick from device */}
        <TouchableOpacity style={styles.mediaPickBtn} onPress={pickPdf} disabled={pdfUploading}>
          {pdfUploading
            ? <ActivityIndicator color="#FF7043" />
            : <Text style={[styles.mediaPickBtnText, { color: "#FF7043" }]}>
                📎 {pdfUri ? `Change PDF  (${pdfFilename})` : "Pick PDF from Device"}
              </Text>
          }
        </TouchableOpacity>

        {/* PDF selected indicator */}
        {pdfUri && (
          <View style={styles.pdfBadgeRow}>
            <Text style={styles.pdfIcon}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdfFilenameText} numberOfLines={1}>{pdfFilename}</Text>
              {pdfUrl
                ? <Text style={styles.uploadedBadge}>✅ Uploaded & ready to send</Text>
                : <Text style={styles.uploadingBadge}>⏳ Uploading…</Text>
              }
            </View>
          </View>
        )}

        {/* Fallback: paste URL */}
        {!pdfUri && (
          <>
            <Text style={styles.orDivider}>— or paste a public PDF URL —</Text>
            <TextInput
              style={styles.msgInput}
              value={pdfUrl}
              onChangeText={setPdfUrl}
              placeholder="https://... (public PDF or Google Drive link)"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </>
        )}

        {/* Filename the customer sees on the attachment */}
        <View style={[styles.fieldLabelRow, { marginTop: 10 }]}>
          <Text style={styles.fieldLabel}>Filename shown to receiver</Text>
        </View>
        <TextInput
          style={[styles.msgInput, { minHeight: 0, paddingVertical: 10 }]}
          value={pdfFilename}
          onChangeText={setPdfFilename}
          placeholder="e.g. Chapter 3 Notes.pdf"
          placeholderTextColor={Colors.textMuted}
        />

        {/* Target Segment */}
        <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Target</Text>
        <SegmentSelector value={pdfSegment} onChange={setPdfSegment} />

        {/* Caption */}
        <MsgField
          label="Description / Caption"
          value={pdfCaption}
          onChange={setPdfCaption}
          placeholder="Write a note about this document…"
          onTemplate={() => openTemplates("pdf", setPdfCaption)}
          topMargin
        />

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: "#FF7043" }, (loading || pdfUploading) && styles.sendBtnDisabled]}
          onPress={sendPdf} disabled={loading || pdfUploading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>
                Send PDF to {SEGMENTS.find(s => s.key === pdfSegment)?.label} {audience.charAt(0).toUpperCase() + audience.slice(1)} →
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
              <Text style={styles.modalTitle}>Pick {itemWord}es</Text>
              <TouchableOpacity onPress={() => setPickModal(null)}>
                <Text style={styles.closeBtn}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={products}
              keyExtractor={p => String(p.id)}
              renderItem={({ item }) => {
                const isSegMode     = pickModal === "segment";
                const isArrivalMode = pickModal === "arrival";
                const list    = isSegMode ? segProds : isArrivalMode ? arrivalProds : flashProds;
                const setList = isSegMode ? setSegProds : isArrivalMode ? setArrivalProds : setFlashProds;
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
              data={templates[templateType] || []}
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
function PromoCard({ icon, title, color, description, customersCount, initialOpen = false, children }) {
  const [open, setOpen] = useState(initialOpen);
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

  // Media picker (Image & PDF)
  mediaPickBtn    : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  mediaPickBtnText: { fontSize: 14, fontWeight: "700" },
  orDivider       : { textAlign: "center", color: Colors.textMuted, fontSize: 12, marginVertical: 8 },
  imagePreview    : { width: "100%", height: 180, borderRadius: 10, marginBottom: 6 },
  mediaPreviewWrap: { marginBottom: 10 },
  uploadedBadge   : { color: Colors.green,   fontSize: 12, fontWeight: "700" },
  uploadingBadge  : { color: Colors.yellow,  fontSize: 12, fontWeight: "700" },
  pdfBadgeRow     : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, marginBottom: 10, gap: 10 },
  pdfIcon         : { fontSize: 28 },
  pdfFilenameText : { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", marginBottom: 2 },

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
