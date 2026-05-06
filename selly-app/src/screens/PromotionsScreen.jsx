import React, { useState, useCallback } from "react";
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
import {
  sendFlashSale, sendNewArrival, sendAbandonedCart,
  sendSegmentBroadcast, sendVideoBlast,
  sendImageBlast, sendPdfBlast, uploadMedia,
  fetchCatalog, fetchCustomers,
} from "../lib/api";

// ── Promo Message Templates ────────────────────────────────────────────────────
const TEMPLATES_PRODUCT = {
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
  ],
};

const TEMPLATES_EDUCATION = {
  flash: [
    { label: "🎓 Early Bird Discount",  text: "🎓 Early Bird Offer! Enroll before [date] and get a special fee discount. Limited seats — reply ENROLL to secure your spot now!" },
    { label: "⏳ Last Few Seats",       text: "⏳ HURRY! Only a few seats left in this batch. Once full, next batch starts only in [month]. Reply SEAT to enroll today!" },
    { label: "🎉 Festival Fee Offer",   text: "🎉 Festival Special! Flat discount on all course fees this week only. Celebrate and upskill — reply to enroll before offer ends!" },
    { label: "🌟 Scholarship Alert",    text: "🌟 Scholarship seats available! Limited spots with reduced fees for deserving students. Reply SCHOLARSHIP to apply now." },
    { label: "🆓 Free Demo Class",      text: "🆓 FREE Demo Class this weekend! Experience our teaching style before enrolling. Reply DEMO to register your spot — limited seats!" },
    { label: "🪔 Diwali Enrollment",    text: "🪔 Diwali Special! Enroll in any course this week and get special fee discount + free study material. Reply to grab this festive offer! 🎆" },
    { label: "🎒 New Batch Offer",      text: "🎒 New Batch Starting! Special introductory fees for the first 10 students. Don't wait — reply NOW to lock in the best price!" },
    { label: "📚 Combo Course Deal",    text: "📚 Combo Offer! Enroll in 2 courses and get a flat discount on the total fees. Limited time only — reply COMBO to know more!" },
  ],
  arrival: [
    { label: "📚 New Batch Starting",   text: "📚 New Batch Starting Soon! Limited seats available — enroll now and secure your spot. Reply ENROLL to know fees, schedule & get a free demo class!" },
    { label: "🆕 New Course Launched",  text: "🆕 Exciting New Course just launched! Designed for [subject/skill] learners. Early enrollment now open — reply COURSE for full details!" },
    { label: "👑 Advanced Batch Open",  text: "👑 Advanced Level Batch is now open! Take your skills to the next level. Limited premium seats — reply ADVANCED to enroll." },
    { label: "🌸 Weekend Batch",        text: "🌸 New Weekend Batch starting! Perfect for working professionals and students. Saturday & Sunday classes — reply WEEKEND to enroll!" },
  ],
};

const TEMPLATES_TOURISM = {
  flash: [
    { label: "✈️ Flash Booking Deal",   text: "✈️ FLASH DEAL! Limited slots at special prices for this package. Book in the next 24 hours to avail — reply BOOK to secure your spot!" },
    { label: "🏖️ Weekend Getaway",      text: "🏖️ Weekend Getaway Special! Short trip, big memories. Slots filling fast — reply TRIP to book now before it's full!" },
    { label: "🌟 Early Bird Travel",    text: "🌟 Early Bird Offer! Book your tour 30 days in advance and save big. Limited early slots — reply EARLY to reserve now!" },
  ],
  arrival: [
    { label: "✈️ New Tour Package",     text: "✈️ Exciting New Tour Package just launched! Handpicked destinations, amazing experiences, unbeatable prices. Reply TRAVEL to see full details!" },
    { label: "🌍 New Destination Added",text: "🌍 New Destination just added to our packages! Be among the first to explore — reply DEST to see the full itinerary and pricing." },
  ],
};

const TEMPLATES_SEGMENT_PRODUCT = [
  { label: "⭐ VIP Exclusive Reward",    text: "Hey! 🌟 As one of our VIP customers, you get EARLY ACCESS to our new collection + an extra 10% discount. This offer is only for you — reply to claim it!" },
  { label: "💤 Win-Back (We Miss You)",  text: "Hey! 👋 It's been a while and we miss you! We've got exciting new products waiting for you + a special comeback offer. Reply to see what's new! 🎁" },
  { label: "🌱 New Customer Welcome",    text: "Welcome to the family! 🎉 As a new member, here's a special offer just for you. Reply to explore our bestsellers and claim your first-time discount!" },
  { label: "🔄 Loyal Shopper Thanks",    text: "Thank you for coming back! 💙 You're one of our most loyal customers and we truly appreciate it. Here's a special thank-you offer — reply to redeem!" },
  { label: "🎯 Personalised Deal",       text: "Hey! 🎯 We've curated a special offer just based on your past purchases. This personalised deal is valid for 48 hours only — reply to claim!" },
  { label: "😴 Inactive Nudge",          text: "Hey, we noticed you haven't been around for a while 😊 We'd love to have you back! Here's a special returning-customer deal — just reply and we'll sort you out!" },
];

const TEMPLATES_SEGMENT_EDUCATION = [
  { label: "⭐ Top Student Reward",      text: "Hey! 🌟 As one of our top-performing students, here's an exclusive offer — advanced batch access + a special fee discount. Reply to claim it!" },
  { label: "💤 Win-Back (Miss You)",     text: "Hey! 👋 We noticed you haven't been active for a while. We'd love to have you back! Here's a special re-enroll offer + free demo session. Reply to know more 🎁" },
  { label: "🌱 New Student Welcome",     text: "Welcome to the family! 🎉 As a new student, here's a special offer just for you. Reply to explore our courses and claim your first-time discount!" },
  { label: "🔄 Loyal Student Thanks",    text: "Thank you for being with us! 💙 You've been one of our most dedicated students and we truly appreciate it. Here's a special thank-you offer — reply to redeem!" },
  { label: "🎯 Personalised Offer",      text: "Hey! 🎯 Based on your learning journey, we've picked a perfect next course for you. Special price valid 48 hours only — reply to know more!" },
  { label: "😴 Inactive Student Nudge",  text: "Hey, we noticed you haven't been around for a while 😊 Your learning journey isn't over! Come back with a special re-enrollment offer — just reply and we'll help you out!" },
];

const TEMPLATES_SEGMENT_TOURISM = [
  { label: "⭐ Premium Traveller Reward",text: "Hey! 🌟 As one of our premium travellers, you get FIRST ACCESS to our new tour package + a special early-bird discount. Reply to claim it!" },
  { label: "💤 Win-Back (Miss You)",     text: "Hey! 👋 It's been a while! We have exciting new destinations and packages waiting for you + a special returning traveller offer. Reply to see what's new! 🎁" },
  { label: "🌱 New Traveller Welcome",   text: "Welcome aboard! 🎉 As a new traveller with us, here's a special first-trip offer just for you. Reply to explore our packages and claim your discount!" },
  { label: "🔄 Repeat Traveller Thanks", text: "Thank you for travelling with us again! 💙 You're one of our most loyal travellers and we truly appreciate it. Here's a special thank-you offer — reply to redeem!" },
  { label: "🎯 Personalised Package",    text: "Hey! 🎯 Based on your past trips, we've handpicked a perfect new destination for you. This personalised offer is valid 48 hours only — reply to claim!" },
  { label: "😴 Inactive Traveller Nudge",text: "Hey, it's been a while since your last adventure 😊 We'd love to plan your next trip! Here's a special welcome-back deal — just reply and we'll sort you out!" },
];

// ── Returns the right template set based on industry ─────────────────────────
function getTemplates(industry) {
  const ind = (industry || "").toLowerCase();
  const isEdu  = ind === "education";
  const isTour = ind === "tourism" || ind === "travel";
  return {
    flash  : isEdu ? TEMPLATES_EDUCATION.flash : isTour ? TEMPLATES_TOURISM.flash : TEMPLATES_PRODUCT.flash,
    arrival: isEdu ? TEMPLATES_EDUCATION.arrival : isTour ? TEMPLATES_TOURISM.arrival : TEMPLATES_PRODUCT.arrival,
    segment: isEdu ? TEMPLATES_SEGMENT_EDUCATION : isTour ? TEMPLATES_SEGMENT_TOURISM : TEMPLATES_SEGMENT_PRODUCT,
    video  : TEMPLATES_VIDEO,
    image  : TEMPLATES_IMAGE,
    pdf    : TEMPLATES_PDF,
  };
}

const TEMPLATES_VIDEO = [
  { label: "🎬 Product Showcase",     text: "🎬 Check out our latest collection in action! Watch the full video and let us know what you love. Reply to order or for more details! 😍" },
  { label: "🔥 Sale Announcement",    text: "🔥 BIG SALE happening RIGHT NOW! Watch this video to see today's hottest deals. Limited stock — reply YES to grab yours before it's gone!" },
  { label: "📖 Tutorial / How-to",    text: "Hey! Here's a quick how-to video for you 📖 Watch till the end — it's super helpful! Reply if you have any questions or want to place an order." },
  { label: "🌟 Customer Story",       text: "🌟 See what our happy customers are saying! Real experiences, real results. Watch this and then reply to place your own order today!" },
  { label: "✈️ Tour Package Preview", text: "✈️ Take a sneak peek at our exclusive travel package! Watch the video and picture yourself there. Reply BOOK to get full details and pricing." },
  { label: "📚 Course Demo",          text: "📚 Watch a free demo of our course! See exactly what you'll learn and how it can transform your career. Reply DEMO to enroll or ask anything." },
  { label: "👑 New Product Launch",   text: "👑 Big reveal! Our most exciting new product is finally here. Watch to see it in action and reply to be among the first to own it! 🚀" },
];

const TEMPLATES_IMAGE = [
  { label: "📸 Class Notes (Whiteboard)", text: "📸 Notes from today's class! Save this image and revise before the next session. Reply if you have any doubts 🎓" },
  { label: "📢 Important Announcement",   text: "📢 Important notice — please read carefully and note the details. Reply to confirm you've seen this!" },
  { label: "🗓️ Schedule / Timetable",     text: "🗓️ Here's the updated schedule! Save this for reference. Reply if you have any questions." },
  { label: "🎉 Result / Achievement",     text: "🎉 Congratulations to all! Check out this result image and keep up the great work! 🏆" },
  { label: "📦 New Product Photo",        text: "📸 Fresh arrivals just in! Check out this photo and reply to order or know more 😍" },
  { label: "🌟 Event Highlight",          text: "🌟 Highlights from our recent event! Great moments captured — reply if you want more info." },
];

const TEMPLATES_PDF = [
  { label: "📄 Study Notes",           text: "📄 Study notes for this week's topics attached! Read carefully and prepare for the next class 🎓 Reply if you have doubts." },
  { label: "📝 Assignment / Homework", text: "📝 Homework attached! Complete it before the next class. Reply to submit or ask questions 📚" },
  { label: "📋 Syllabus / Timetable",  text: "📋 Full syllabus and timetable attached. Save it for reference and plan your studies accordingly 🗓️" },
  { label: "📊 Result Sheet",          text: "📊 Your result sheet is attached. Review it and contact us for any queries. Keep working hard! 💪" },
  { label: "📃 Product Brochure",      text: "📃 Our latest catalogue is attached! Browse through and reply with what catches your eye 😍" },
  { label: "📑 Fee / Invoice",         text: "📑 Fee invoice attached for your reference. Please make the payment by the due date. Reply for any queries." },
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

// ── Industry label helpers ─────────────────────────────────────────────────────
const AUDIENCE_LABEL = { education: "students", tourism: "travelers", default: "customers" };
const audienceOf = (ind) => AUDIENCE_LABEL[ind] || AUDIENCE_LABEL.default;

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PromotionsScreen() {
  const { industry } = useAuth();
  const audience     = audienceOf(industry);
  const isEdu        = industry === "education";
  const templates    = getTemplates(industry);

  const [products, setProducts]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);

  // Flash Sale
  const [flashMsg, setFlashMsg]     = useState(
    isEdu ? "🎓 Early Bird Offer! Enroll before seats fill up and get a special fee discount. Reply ENROLL to secure your spot!"
          : "⚡ Flash Sale! Limited time offer on selected items."
  );
  const [selectedProds, setSelectedProds] = useState([]);

  // New Arrival
  const [arrivalMsg, setArrivalMsg] = useState(
    isEdu ? "📚 New Batch Starting Soon! Limited seats available — reply ENROLL to know fees, schedule & get a free demo class!"
          : "✨ New Arrivals are here! Check out our latest collection."
  );

  // Segment Broadcast
  const [segMsg, setSegMsg]         = useState("");
  const [segment, setSegment]       = useState("all");
  const [segProds, setSegProds]     = useState([]);

  // Video Blast
  const [videoUrl, setVideoUrl]     = useState("");
  const [videoCaption, setVideoCaption] = useState(
    isEdu ? "📹 Watch this class recording — let us know if you have any questions! 🎓"
          : "🎬 Check out our latest collection in action! Reply to order or know more 😍"
  );
  const [videoSegment, setVideoSegment] = useState("all");

  // ── Image Blast (new) ────────────────────────────────────────────────────────
  const [imageUri,     setImageUri]     = useState(null);   // local preview URI
  const [imageUrl,     setImageUrl]     = useState("");      // hosted URL after upload
  const [imageCaption, setImageCaption] = useState(
    isEdu ? "📸 Notes from today's class. Save and revise! 📚"
          : "📸 Check out our latest photos! Reply for more info 😍"
  );
  const [imageSegment, setImageSegment] = useState("all");
  const [imageUploading, setImageUploading] = useState(false);

  // ── PDF / Notes Blast (new) ──────────────────────────────────────────────────
  const [pdfUri,      setPdfUri]      = useState(null);
  const [pdfUrl,      setPdfUrl]      = useState("");
  const [pdfFilename, setPdfFilename] = useState("Notes.pdf");
  const [pdfCaption,  setPdfCaption]  = useState(
    isEdu ? "📄 Study notes attached! Read carefully before the next class 🎓"
          : "📄 Document attached — please read and let us know your questions!"
  );
  const [pdfSegment,  setPdfSegment]  = useState("all");
  const [pdfUploading, setPdfUploading] = useState(false);

  // Modals
  const [pickModal, setPickModal]   = useState(null);
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

      {/* Shared product/course picker box (for Flash + New Arrival) */}
      <View style={styles.pickerBox}>
        <Text style={styles.pickerLabel}>
          {isEdu ? `Selected Courses (${selectedProds.length})` : `Selected Products (${selectedProds.length})`}
        </Text>
        {selectedNames
          ? <Text style={styles.pickerNames} numberOfLines={2}>{selectedNames}</Text>
          : <Text style={styles.pickerEmpty}>
              {isEdu ? 'No courses selected — tap "Choose" below' : 'No products selected — tap "Choose" below'}
            </Text>
        }
        <TouchableOpacity style={styles.chooseBtn} onPress={() => setPickModal("flash")}>
          <Text style={styles.chooseBtnText}>{isEdu ? "Choose Courses" : "Choose Products"}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Flash Sale / Early Bird ─────────────────────────────────────── */}
      <PromoCard
        icon={isEdu ? "🎓" : "⚡"}
        title={isEdu ? "Early Bird / Flash Offer" : "Flash Sale"}
        color={Colors.yellow}
        description={
          isEdu
            ? "Send an urgent limited-time enrollment offer to all students. Marks enrollments with flash_sale attribution."
            : "Send an urgent limited-time DM to all customers. Marks orders with flash_sale attribution."
        }
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
            : <Text style={[styles.sendBtnText, { color: "#000" }]}>
                {isEdu ? "Send Enrollment Offer DMs" : "Send Flash Sale DMs"}
              </Text>}
        </TouchableOpacity>
      </PromoCard>

      {/* ─── New Arrival / New Batch ─────────────────────────────────────── */}
      <PromoCard
        icon={isEdu ? "📚" : "✨"}
        title={isEdu ? "New Batch / Course Launch" : "New Arrival"}
        color={Colors.blue}
        description={
          isEdu
            ? "Announce a new batch or course to all students. Marks enrollments with new_arrival attribution."
            : "Announce new products to all customers. Marks orders with new_arrival attribution."
        }
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
            : <Text style={styles.sendBtnText}>
                {isEdu ? "Send New Batch DMs" : "Send New Arrival DMs"}
              </Text>}
        </TouchableOpacity>
      </PromoCard>

      {/* ─── Abandoned Cart / Abandoned Inquiry Recovery ─────────────────── */}
      <PromoCard
        icon="🛒"
        title={isEdu ? "Abandoned Inquiry Recovery" : "Abandoned Cart Recovery"}
        color={Colors.accent}
        description={
          isEdu
            ? "Re-engage students who enquired about a course but didn't complete enrollment in the last 24 hours."
            : "Re-engage customers who started a conversation but didn't complete an order in the last 24 hours."
        }
        customersCount={customers.length}
      >
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {isEdu
              ? "💡 Automatically finds students who enquired but haven't enrolled in 24h and sends a follow-up DM."
              : "💡 Automatically finds customers who haven't ordered in 24h and sends a nudge DM."
            }
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.accent }, loading && styles.sendBtnDisabled]}
          onPress={sendAbandoned} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>
                {isEdu ? "Recover Abandoned Inquiries" : "Recover Abandoned Carts"}
              </Text>}
        </TouchableOpacity>
      </PromoCard>

      {/* ─── Segment Broadcast ───────────────────────────────────────────── */}
      <PromoCard icon="🎯" title="Segment Broadcast" color={Colors.primary}
        description={
          isEdu
            ? "Target specific student groups — top performers, new students, inactive, or repeat enrollers."
            : "Target specific customer groups — VIPs, new customers, inactive buyers, or repeat shoppers."
        }
        customersCount={customers.length}
      >
        <Text style={styles.fieldLabel}>Target Segment</Text>
        <SegmentSelector value={segment} onChange={setSegment} />

        {/* Optional product/course picker */}
        <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{isEdu ? "Courses (optional)" : "Products (optional)"}</Text>
        {segProds.length > 0 && (
          <Text style={styles.pickerNames} numberOfLines={1}>
            {products.filter(p => segProds.includes(p.id)).map(p => p.name).join(", ")}
          </Text>
        )}
        <TouchableOpacity style={styles.chooseBtn} onPress={() => setPickModal("segment")}>
          <Text style={styles.chooseBtnText}>
            {segProds.length > 0
              ? `${segProds.length} ${isEdu ? "course(s)" : "product(s)"} selected`
              : isEdu ? "Choose Courses (optional)" : "Choose Products (optional)"}
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
      <PromoCard icon="📸" title={isEdu ? "Share Photo / Image" : "Photo Blast"} color="#00BCD4"
        description={isEdu
          ? "Send a photo (whiteboard, notes, announcement) to all or a group of students instantly."
          : "Send a product photo or announcement image to all or a segment of customers."}
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
      <PromoCard icon="📄" title={isEdu ? "Share Notes / PDF" : "PDF Blast"} color="#FF7043"
        description={isEdu
          ? "Send study notes, worksheets, or documents as a PDF to all or a group of students on WhatsApp."
          : "Send a PDF document or brochure to all or a segment of customers."}
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

        {/* Filename shown to students */}
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
              <Text style={styles.modalTitle}>{isEdu ? "Pick Courses" : "Pick Products"}</Text>
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
