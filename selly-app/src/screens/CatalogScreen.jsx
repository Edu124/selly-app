import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, Image,
  Alert, Switch, Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "../constants/colors";
import { useAuth } from "../context/AuthContext";
import {
  fetchCatalog, addProduct, updateProduct, toggleStock, deleteProduct,
  uploadProductImage,
} from "../lib/api";

// ── Industry Configuration ────────────────────────────────────────────────────
const INDUSTRIES = {
  education: {
    icon: "🎓", label: "Education", color: "#3b82f6",
    itemLabel: "Course",
    categories: ["Programming","Design","Languages","Arts & Crafts","Science","Mathematics","Music","Fitness","Business","Other"],
    subCategories: {
      "Programming": ["Web Development","Mobile Apps","Data Science","AI/ML","Cybersecurity","Cloud Computing"],
      "Design":      ["UI/UX","Graphic Design","Animation","3D Modelling","Video Editing"],
      "Languages":   ["English","Hindi","French","Spanish","Japanese","Arabic","German"],
      "Music":       ["Guitar","Piano","Vocals","Tabla","Violin","Flute","DJ"],
      "Fitness":     ["Yoga","Zumba","Cricket","Football","Martial Arts","Swimming","Cycling"],
      "Business":    ["Digital Marketing","Finance","HR","Entrepreneurship","Sales","Accounting"],
      "Arts & Crafts":["Painting","Pottery","Jewellery Making","Photography","Embroidery"],
      "Science":     ["Physics","Chemistry","Biology","Astronomy"],
      "Mathematics": ["Algebra","Calculus","Statistics","Mental Maths"],
    },
  },
  product: {
    icon: "🛍️", label: "Products", color: "#6c47ff",
    itemLabel: "Product",
    categories: ["Clothing","Electronics","Food & Snacks","Accessories","Home Decor","Beauty & Skincare","Sports","Books & Stationery","Toys & Games","Other"],
    subCategories: {
      "Clothing":          ["Jeans","Pants","Cargo","Shorts","Shirts","T-Shirts","Tops","Kurtas","Sarees","Lehenga","Suits","Jackets","Dresses","Co-ord Sets","Hoodies","Sweaters"],
      "Electronics":       ["Smartphones","Laptops","Earphones","Speakers","Smart Watches","Cameras","Accessories","Chargers"],
      "Food & Snacks":     ["Snacks","Sweets","Pickles","Spices","Dry Fruits","Beverages","Bakery","Chocolates","Masalas","Namkeen"],
      "Accessories":       ["Bags","Wallets","Belts","Sunglasses","Caps & Hats","Scarves","Jewellery","Keychains"],
      "Home Decor":        ["Wall Art","Candles","Planters","Cushions","Table Decor","Lamps","Storage","Mirrors"],
      "Beauty & Skincare": ["Skincare","Haircare","Makeup","Fragrances","Nail Care","Grooming","Organic"],
      "Sports":            ["Cricket","Football","Badminton","Fitness Equipment","Yoga","Swimming","Cycling"],
    },
    sizes: {
      "Clothing": ["XS","S","M","L","XL","XXL","XXXL"],
      "default":  ["28","30","32","34","36","38","40","42","Free Size"],
    },
  },
  tourism: {
    icon: "✈️", label: "Tourism & Travel", color: "#22c55e",
    itemLabel: "Package",
    categories: ["Beach","Mountains","Cultural","Adventure","Wildlife","Pilgrimage","Honeymoon","Family","Corporate","International"],
    subCategories: {
      "Beach":        ["Goa","Andaman","Kerala","Maldives","Bali","Thailand","Sri Lanka","Lakshadweep"],
      "Mountains":    ["Himachal Pradesh","Uttarakhand","Kashmir","Ladakh","Sikkim","Nepal","Bhutan","Auli"],
      "Cultural":     ["Rajasthan","Tamil Nadu","Karnataka","Delhi NCR","Varanasi","Gujarat","Odisha"],
      "Adventure":    ["Trekking","River Rafting","Paragliding","Camping","Rock Climbing","Skiing","Bungee"],
      "Wildlife":     ["Jim Corbett","Ranthambore","Kaziranga","Bandhavgarh","Periyar","Sariska"],
      "Pilgrimage":   ["Char Dham","Vaishno Devi","Tirupati","Shirdi","Golden Temple","Rameshwaram"],
    },
  },
};

const COMMON_SIZES = ["XS","S","M","L","XL","XXL","28","30","32","34","36","38","Free Size"];

// ── Chip Row (horizontal scrollable chips) ────────────────────────────────────
function ChipRow({ items, selected, onSelect, color }) {
  const c = color || Colors.primary;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
        {items.map(item => {
          const active = Array.isArray(selected) ? selected.includes(item) : selected === item;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, active && { backgroundColor: c + "33", borderColor: c }]}
              onPress={() => onSelect(item)}
            >
              <Text style={[styles.chipText, active && { color: c, fontWeight: "700" }]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Multi-Photo Picker ────────────────────────────────────────────────────────
const MAX_IMAGES = 4;

function MultiPhotoPicker({ imageUrls = [], onAdd, onRemove, uploadingIdx }) {
  const slots = Array.from({ length: MAX_IMAGES }, (_, i) => imageUrls[i] || null);

  const pickForSlot = async (slotIndex, withCrop = false) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow access in device settings."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality      : 0.8,
      allowsEditing: withCrop,   // crop = free-form (no forced aspect ratio)
      mediaTypes   : ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets?.[0]?.uri) onAdd(result.assets[0].uri, slotIndex);
  };

  const fromCamera = async (slotIndex) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow access in device settings."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (!result.canceled && result.assets?.[0]?.uri) onAdd(result.assets[0].uri, slotIndex);
  };

  const promptSlot = (idx, hasImage) => {
    const nextEmpty = imageUrls.length;
    if (!hasImage) {
      Alert.alert("Add Photo", undefined, [
        { text: "📷 Camera",  onPress: () => fromCamera(nextEmpty) },
        { text: "🖼️ Gallery", onPress: () => pickForSlot(nextEmpty, false) },
        { text: "Cancel",     style: "cancel" },
      ]);
    } else {
      Alert.alert("Photo Options", undefined, [
        { text: "✂️ Crop / Replace",    onPress: () => pickForSlot(idx, true) },
        { text: "🖼️ Replace (no crop)", onPress: () => pickForSlot(idx, false) },
        { text: "🗑 Remove",   style: "destructive", onPress: () => onRemove(idx) },
        { text: "Cancel",      style: "cancel" },
      ]);
    }
  };

  return (
    <View>
      <View style={styles.imgGrid}>
        {slots.map((url, i) => {
          const isLoading = uploadingIdx === i;
          const canTap    = url || i === imageUrls.length; // only tap next empty slot
          return (
            <TouchableOpacity
              key={i}
              style={[styles.imgSlot, url ? styles.imgSlotFilled : styles.imgSlotEmpty, !canTap && { opacity: 0.3 }]}
              onPress={() => canTap && promptSlot(i, !!url)}
              activeOpacity={0.75}
              disabled={isLoading}
            >
              {url ? (
                <>
                  <Image source={{ uri: url }} style={styles.imgSlotImg} />
                  {i === 0 && <View style={styles.imgPrimaryBadge}><Text style={styles.imgPrimaryText}>Main</Text></View>}
                  {isLoading && <View style={styles.imgLoadOverlay}><ActivityIndicator color="#fff" /></View>}
                </>
              ) : (
                <View style={styles.imgSlotPlaceholder}>
                  {isLoading
                    ? <ActivityIndicator color={Colors.primary} />
                    : <Text style={styles.imgSlotPlus}>+</Text>
                  }
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 4, marginBottom: 8 }}>
        First photo = main image · Tap filled photo to crop or swap · Up to 4 photos
      </Text>
    </View>
  );
}


// ── Education Form ────────────────────────────────────────────────────────────
function EducationForm({ form, set }) {
  const cfg = INDUSTRIES.education;
  const subCats = cfg.subCategories[form.category] || [];

  return (
    <>
      <Text style={styles.fieldLabel}>Subject *</Text>
      <ChipRow items={cfg.categories} selected={form.category} onSelect={v => set("category", v)} color={cfg.color} />

      {subCats.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>Topic</Text>
          <ChipRow items={subCats} selected={form.subCategory} onSelect={v => set("subCategory", v)} color={cfg.color} />
        </>
      )}

      <Text style={styles.fieldLabel}>Course Name *</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={v => set("name", v)} placeholder="e.g. Full Stack Web Development" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Course Fees (₹) *</Text>
      <TextInput style={styles.input} value={String(form.price)} onChangeText={v => set("price", v)} keyboardType="numeric" placeholder="e.g. 4999" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Duration</Text>
      <TextInput style={styles.input} value={form.duration} onChangeText={v => set("duration", v)} placeholder="e.g. 3 months / 12 sessions" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Batch Timing</Text>
      <TextInput style={styles.input} value={form.batchTiming} onChangeText={v => set("batchTiming", v)} placeholder="e.g. Mon-Fri 6-7 PM" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Mode</Text>
      <ChipRow items={["Online","Offline","Hybrid"]} selected={form.mode} onSelect={v => set("mode", v)} color={cfg.color} />

      {(form.mode === "Online" || form.mode === "Hybrid") && (
        <>
          <Text style={styles.fieldLabel}>Online Class Link (Zoom / Meet / etc.)</Text>
          <TextInput style={styles.input} value={form.classLink} onChangeText={v => set("classLink", v)}
            placeholder="https://meet.google.com/..." placeholderTextColor={Colors.textMuted}
            autoCapitalize="none" keyboardType="url" />
        </>
      )}

      <Text style={styles.fieldLabel}>What's Included</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: "top" }]}
        value={form.whatIncluded} onChangeText={v => set("whatIncluded", v)}
        placeholder="e.g. Live sessions, recordings, certificate, doubt clearing…"
        placeholderTextColor={Colors.textMuted} multiline
      />

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={[styles.input, { height: 70, textAlignVertical: "top" }]}
        value={form.description} onChangeText={v => set("description", v)}
        placeholder="Short description of the course…"
        placeholderTextColor={Colors.textMuted} multiline
      />
    </>
  );
}

// ── Product Form ──────────────────────────────────────────────────────────────
// Categories that need size options and what sizes to show
const CATEGORY_SIZES = {
  "Clothing"         : ["XS","S","M","L","XL","XXL","XXXL"],
  // Waist-size subcategories within Clothing
  "_waist"           : ["28","30","32","34","36","38","40","42","Free Size"],
};
const WAIST_SUBCATS  = ["Jeans","Pants","Cargo","Shorts"];
// Categories that need a Material/Fabric field
const NEEDS_MATERIAL = new Set(["Clothing","Accessories","Home Decor","Sports"]);

function ProductItemForm({ form, set }) {
  const cfg     = INDUSTRIES.product;
  const subCats = cfg.subCategories[form.category] || [];

  // Only Clothing gets size chips; waist sub-cats get waist sizes
  const isClothing   = form.category === "Clothing";
  const isWaistSubCat = isClothing && WAIST_SUBCATS.includes(form.subCategory);
  const sizeOpts     = isClothing
    ? (isWaistSubCat ? CATEGORY_SIZES["_waist"] : CATEGORY_SIZES["Clothing"])
    : null; // null = hide size section

  const showMaterial = NEEDS_MATERIAL.has(form.category);

  const toggleSize = (s) => {
    const current = form.sizes || [];
    set("sizes", current.includes(s) ? current.filter(x => x !== s) : [...current, s]);
  };

  return (
    <>
      <Text style={styles.fieldLabel}>Category *</Text>
      <ChipRow items={cfg.categories} selected={form.category} onSelect={v => { set("category", v); set("subCategory", ""); }} color={cfg.color} />

      {subCats.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>Type *</Text>
          <ChipRow items={subCats} selected={form.subCategory} onSelect={v => set("subCategory", v)} color={cfg.color} />
        </>
      )}

      <Text style={styles.fieldLabel}>Product Name *</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={v => set("name", v)} placeholder={`e.g. ${form.subCategory || "Product"} name`} placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Price (₹) *</Text>
      <TextInput style={styles.input} value={String(form.price)} onChangeText={v => set("price", v)} keyboardType="numeric" placeholder="e.g. 1299" placeholderTextColor={Colors.textMuted} />

      {sizeOpts && (
        <>
          <Text style={styles.fieldLabel}>Available Sizes</Text>
          <ChipRow items={sizeOpts} selected={form.sizes || []} onSelect={toggleSize} color={cfg.color} />
        </>
      )}

      <Text style={styles.fieldLabel}>Colors (comma-separated)</Text>
      <TextInput style={styles.input} value={form.colors} onChangeText={v => set("colors", v)} placeholder="Red, Black, Navy Blue" placeholderTextColor={Colors.textMuted} />

      {showMaterial && (
        <>
          <Text style={styles.fieldLabel}>Material / Fabric</Text>
          <TextInput style={styles.input} value={form.material} onChangeText={v => set("material", v)} placeholder="e.g. Cotton, Silk, Denim" placeholderTextColor={Colors.textMuted} />
        </>
      )}

      <Text style={styles.fieldLabel}>Product Code / SKU</Text>
      <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 6, marginTop: -4 }}>
        Internal code visible only to you (e.g. BLU-JNS-32). Shown in orders.
      </Text>
      <TextInput style={styles.input} value={form.productNumber} onChangeText={v => set("productNumber", v)}
        placeholder="e.g. SHIRT-RED-L-001" placeholderTextColor={Colors.textMuted}
        autoCapitalize="characters" autoCorrect={false} />

      <Text style={styles.fieldLabel}>Stock Count</Text>
      <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 6, marginTop: -4 }}>
        How many units in stock? Leave blank to not track. Shows low-stock alert when ≤ 5.
      </Text>
      <TextInput style={styles.input} value={form.stockCount} onChangeText={v => set("stockCount", v)}
        placeholder="e.g. 50 (leave blank = unlimited)" placeholderTextColor={Colors.textMuted}
        keyboardType="numeric" />

      <Text style={styles.fieldLabel}>Product Video URL</Text>
      <Text style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 6, marginTop: -4 }}>
        Paste a YouTube, Instagram Reel, or direct video link. Shown on your shop page.
      </Text>
      <TextInput style={styles.input} value={form.videoUrl} onChangeText={v => set("videoUrl", v)}
        placeholder="https://youtube.com/..." placeholderTextColor={Colors.textMuted}
        autoCapitalize="none" autoCorrect={false} keyboardType="url" />

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={[styles.input, { height: 70, textAlignVertical: "top" }]}
        value={form.description} onChangeText={v => set("description", v)}
        placeholder="Short product description…"
        placeholderTextColor={Colors.textMuted} multiline
      />

      {/* Premium toggle */}
      <TouchableOpacity style={styles.premiumRow} onPress={() => set("isPremium", !form.isPremium)}>
        <View style={styles.premiumLeft}>
          <Text style={styles.premiumIcon}>👑</Text>
          <View>
            <Text style={styles.premiumLabel}>Premium Product</Text>
            <Text style={styles.premiumHint}>Shown first, highlighted in WhatsApp catalog</Text>
          </View>
        </View>
        <Switch
          value={!!form.isPremium}
          onValueChange={v => set("isPremium", v)}
          trackColor={{ false: Colors.border, true: "#f59e0b55" }}
          thumbColor={form.isPremium ? "#f59e0b" : Colors.textMuted}
        />
      </TouchableOpacity>
    </>
  );
}

// ── Tourism Form ──────────────────────────────────────────────────────────────
function TourismForm({ form, set }) {
  const cfg     = INDUSTRIES.tourism;
  const subCats = cfg.subCategories[form.category] || [];

  return (
    <>
      <Text style={styles.fieldLabel}>Package Type *</Text>
      <ChipRow items={cfg.categories} selected={form.category} onSelect={v => { set("category", v); set("subCategory", ""); }} color={cfg.color} />

      {subCats.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>Destination</Text>
          <ChipRow items={subCats} selected={form.subCategory} onSelect={v => set("subCategory", v)} color={cfg.color} />
        </>
      )}

      <Text style={styles.fieldLabel}>Package Name *</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={v => set("name", v)} placeholder="e.g. Goa Weekend Getaway 3D/2N" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Price Per Person (₹) *</Text>
      <TextInput style={styles.input} value={String(form.price)} onChangeText={v => set("price", v)} keyboardType="numeric" placeholder="e.g. 8999" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Duration</Text>
      <TextInput style={styles.input} value={form.duration} onChangeText={v => set("duration", v)} placeholder="e.g. 3 Days / 2 Nights" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Min Group Size</Text>
      <TextInput style={styles.input} value={form.groupSize} onChangeText={v => set("groupSize", v)} keyboardType="numeric" placeholder="e.g. 2" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>What's Included</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: "top" }]}
        value={form.inclusions} onChangeText={v => set("inclusions", v)}
        placeholder="e.g. Hotel (3 star), Breakfast, Airport pickup, Sightseeing…"
        placeholderTextColor={Colors.textMuted} multiline
      />

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput
        style={[styles.input, { height: 70, textAlignVertical: "top" }]}
        value={form.description} onChangeText={v => set("description", v)}
        placeholder="Short description of the package…"
        placeholderTextColor={Colors.textMuted} multiline
      />
    </>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
const BLANK = {
  name:"", price:"", category:"", subCategory:"", description:"",
  imageUrl:"", imageUrls:[],
  sizes:[], colors:"", material:"", isPremium:false, inStock:true,
  duration:"", batchTiming:"", mode:"Online", whatIncluded:"", classLink:"",
  destination:"", groupSize:"", inclusions:"",
  productNumber:"",
  stockCount: "",
  videoUrl: "",
};

function toForm(p) {
  const ef = p.extraFields || {};
  return {
    name:         p.name        || "",
    price:        String(p.price || ""),
    category:     p.category    || "",
    subCategory:  p.subCategory || "",
    description:  p.description || "",
    imageUrl:     p.imageUrl    || "",
    imageUrls:    p.imageUrls   || (p.imageUrl ? [p.imageUrl] : []),
    sizes:        p.sizes       || [],
    colors:       (p.colors || []).join(", "),
    material:     p.material    || "",
    isPremium:    p.isPremium   || false,
    inStock:      p.inStock !== false,
    duration:     ef.duration    || "",
    batchTiming:  ef.batchTiming || "",
    mode:         ef.mode        || "Online",
    whatIncluded: ef.whatIncluded|| "",
    classLink:    ef.classLink   || "",
    destination:   ef.destination || p.subCategory || "",
    groupSize:     String(ef.groupSize || ""),
    inclusions:    ef.inclusions  || "",
    productNumber: p.productNumber || "",
    stockCount:   p.stockCount != null && p.stockCount >= 0 ? String(p.stockCount) : "",
    videoUrl:     p.videoUrl     || "",
  };
}

function AddEditModal({ visible, industry, product, onClose, onDone }) {
  const isEdit  = !!product;
  const [form, setForm]         = useState(product ? toForm(product) : { ...BLANK });
  const [saving, setSaving]     = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(-1);

  React.useEffect(() => {
    setForm(product ? toForm(product) : { ...BLANK });
  }, [product?.id, visible]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const cfg = INDUSTRIES[industry] || INDUSTRIES.product;

  // Add or replace image at slot index
  const handlePhotoAdd = async (localUri, slotIndex) => {
    setUploadingIdx(slotIndex);
    try {
      const tmpId = product?.id || Date.now().toString();
      const url   = await uploadProductImage(localUri, tmpId, slotIndex);
      setForm(f => {
        const newUrls = [...(f.imageUrls || [])];
        newUrls[slotIndex] = url;
        return { ...f, imageUrls: newUrls, imageUrl: newUrls[0] || "" };
      });
    } catch (e) {
      Alert.alert("Upload failed", e.message);
    } finally {
      setUploadingIdx(-1);
    }
  };

  // Remove image at index
  const handlePhotoRemove = (slotIndex) => {
    setForm(f => {
      const newUrls = (f.imageUrls || []).filter((_, i) => i !== slotIndex);
      return { ...f, imageUrls: newUrls, imageUrl: newUrls[0] || "" };
    });
  };

  const buildPayload = () => {
    const extraFields = {};
    if (industry === "education") {
      if (form.duration)     extraFields.duration     = form.duration;
      if (form.batchTiming)  extraFields.batchTiming  = form.batchTiming;
      if (form.mode)         extraFields.mode         = form.mode;
      if (form.whatIncluded) extraFields.whatIncluded = form.whatIncluded;
      if (form.classLink)    extraFields.classLink    = form.classLink;
    }
    if (industry === "tourism") {
      if (form.subCategory) extraFields.destination  = form.subCategory;
      if (form.duration)    extraFields.duration     = form.duration;
      if (form.groupSize)   extraFields.groupSize    = form.groupSize;
      if (form.inclusions)  extraFields.inclusions   = form.inclusions;
    }
    const imageUrls = form.imageUrls && form.imageUrls.length > 0
      ? form.imageUrls
      : (form.imageUrl ? [form.imageUrl] : []);
    return {
      name        : form.name.trim(),
      price       : Number(form.price) || 0,
      category    : form.category  || cfg.categories[0] || "general",
      subCategory : form.subCategory || null,
      description : form.description.trim(),
      imageUrl    : imageUrls[0] || "",
      imageUrls,
      sizes       : Array.isArray(form.sizes) ? form.sizes : [],
      colors      : form.colors ? form.colors.split(",").map(c => c.trim()).filter(Boolean) : [],
      material    : form.material.trim(),
      isPremium     : !!form.isPremium,
      extraFields,
      inStock       : form.inStock,
      productNumber : (form.productNumber || "").trim().toUpperCase(),
      stockCount    : form.stockCount !== "" && !isNaN(Number(form.stockCount)) ? Number(form.stockCount) : -1,
      videoUrl      : (form.videoUrl || "").trim(),
    };
  };

  // Industry-aware validation labels
  const nameLbl  = industry === "education" ? "course name" : industry === "tourism" ? "package name" : "product name";
  const priceLbl = industry === "education" ? "course fees" : industry === "tourism" ? "package price" : "price";

  const submit = async () => {
    if (!form.name.trim()) { Alert.alert("Required", `Please enter a ${nameLbl}.`); return; }
    if (!form.price || isNaN(Number(form.price))) { Alert.alert("Required", `Please enter valid ${priceLbl}.`); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        const d = await updateProduct(product.id, payload);
        onDone(d.product || { ...product, ...payload });
      } else {
        const d = await addProduct({ ...payload, inStock: true });
        onDone(d.product || payload);
      }
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? `Edit ${cfg.itemLabel}` : `Add ${cfg.itemLabel}`}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Multi-photo picker */}
            <Text style={styles.fieldLabel}>Photos (up to 4)</Text>
            <MultiPhotoPicker
              imageUrls={form.imageUrls || []}
              onAdd={handlePhotoAdd}
              onRemove={handlePhotoRemove}
              uploadingIdx={uploadingIdx}
            />

            {/* Industry-specific form */}
            {industry === "education" && <EducationForm form={form} set={set} />}
            {industry === "product"   && <ProductItemForm form={form} set={set} />}
            {industry === "tourism"   && <TourismForm form={form} set={set} />}

            {/* Stock toggle (edit only) */}
            {isEdit && (
              <>
                <Text style={styles.fieldLabel}>Stock Status</Text>
                <View style={styles.stockRow}>
                  <TouchableOpacity style={[styles.stockToggle, form.inStock && styles.stockToggleActive]} onPress={() => set("inStock", true)}>
                    <Text style={[styles.stockToggleText, form.inStock && { color: Colors.green, fontWeight: "800" }]}>✓ In Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.stockToggle, !form.inStock && styles.stockToggleInactive]} onPress={() => set("inStock", false)}>
                    <Text style={[styles.stockToggleText, !form.inStock && { color: Colors.red, fontWeight: "800" }]}>✗ Out of Stock</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity style={[styles.submitBtn, (saving || uploadingIdx >= 0) && styles.submitBtnDisabled]} onPress={submit} disabled={saving || uploadingIdx >= 0}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{isEdit ? "Save Changes" : `Add ${cfg.itemLabel}`}</Text>}
            </TouchableOpacity>
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product: p, industry, onToggle, onDelete, onEdit }) {
  const cfg = INDUSTRIES[industry] || INDUSTRIES.product;
  const ef  = p.extraFields || {};
  const inStock = p.inStock;

  return (
    <View style={[styles.card, p.isPremium && styles.cardPremium]}>
      {p.imageUrl ? (
        <Image source={{ uri: p.imageUrl }} style={styles.productImage} />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Text style={{ fontSize: 28 }}>{cfg.icon}</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {p.isPremium && <Text style={styles.premiumBadge}>👑 Premium</Text>}
            </View>
            <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
          </View>
          <Text style={styles.productPrice}>₹{(p.price || 0).toLocaleString("en-IN")}</Text>
        </View>

        {/* Industry-specific info line */}
        {industry === "education" && (
          <Text style={styles.productMeta} numberOfLines={1}>
            {[p.category, p.subCategory].filter(Boolean).join(" › ")}
            {ef.duration ? `  ·  ⏱ ${ef.duration}` : ""}
            {ef.mode     ? `  ·  ${ef.mode}` : ""}
          </Text>
        )}
        {industry === "product" && (
          <>
            <Text style={styles.productMeta} numberOfLines={1}>
              {[p.category, p.subCategory].filter(Boolean).join(" › ")}
              {p.sizes?.length ? `  ·  📏 ${p.sizes.slice(0,4).join(", ")}` : ""}
            </Text>
            {p.productNumber ? (
              <Text style={styles.productCode}>🏷 {p.productNumber}</Text>
            ) : null}
          </>
        )}
        {industry === "tourism" && (
          <Text style={styles.productMeta} numberOfLines={1}>
            {[p.category, p.subCategory || ef.destination].filter(Boolean).join(" › ")}
            {ef.duration ? `  ·  ⏱ ${ef.duration}` : ""}
          </Text>
        )}

        {/* Stock count badge */}
        {p.stockCount != null && p.stockCount >= 0 && (
          <View style={[styles.stockCountBadge, p.stockCount <= 5 ? styles.stockLow : styles.stockOk]}>
            <Text style={[styles.stockCountText, { color: p.stockCount <= 5 ? Colors.red : Colors.green }]}>
              {p.stockCount <= 5 ? "⚠️" : "📦"} {p.stockCount} in stock
            </Text>
          </View>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.stockBtn, { backgroundColor: inStock ? Colors.green + "22" : Colors.red + "22" }]}
            onPress={onToggle}
          >
            <Text style={[styles.stockText, { color: inStock ? Colors.green : Colors.red }]}>
              {inStock ? "✓ In Stock" : "✗ Out of Stock"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
            <Text style={styles.editBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CatalogScreen() {
  const { industry } = useAuth();   // industry is set during onboarding

  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [search,      setSearch]      = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const catalogData = await fetchCatalog();
      setProducts(catalogData.products || []);
    } catch (e) {
      console.warn("[Catalog] load error:", e.message);
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const toggle = async (id, current) => {
    try {
      await toggleStock(id, !current);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, inStock: !current } : p));
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const del = (id, name) => {
    Alert.alert("Delete", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteProduct(id);
          setProducts(prev => prev.filter(p => p.id !== id));
        } catch (e) { Alert.alert("Error", e.message); }
      }},
    ]);
  };

  const cfg      = INDUSTRIES[industry] || INDUSTRIES.product;
  const filtered = search.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category    || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.subCategory || "").toLowerCase().includes(search.toLowerCase())
      )
    : products;

  // Sort: premium first, then by creation date
  const sorted = [...filtered].sort((a, b) => {
    if (a.isPremium && !b.isPremium) return -1;
    if (!a.isPremium && b.isPremium) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Text>🔍 </Text>
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${cfg.itemLabel.toLowerCase()}s…`}
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Industry badge (read-only — change via Settings) */}
      <View style={styles.industryBar}>
        <Text style={[styles.industryBadge, { color: cfg.color }]}>{cfg.icon} {cfg.label}</Text>
      </View>

      <Text style={styles.countLabel}>{filtered.length} {cfg.itemLabel.toLowerCase()}s</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorMsg}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={p => String(p.id)}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              industry={industry}
              onToggle={() => toggle(item.id, item.inStock)}
              onDelete={() => del(item.id, item.name)}
              onEdit={() => setEditProduct(item)}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>{cfg.icon}</Text>
              <Text style={styles.emptyText}>No {cfg.itemLabel.toLowerCase()}s yet</Text>
              <Text style={styles.emptyHint}>Tap "+ Add" to add your first {cfg.itemLabel.toLowerCase()}</Text>
            </View>
          }
        />
      )}

      {/* Add modal */}
      <AddEditModal
        visible={showAdd}
        industry={industry}
        product={null}
        onClose={() => setShowAdd(false)}
        onDone={(p) => { setProducts(prev => [p, ...prev]); setShowAdd(false); }}
      />

      {/* Edit modal */}
      {editProduct && (
        <AddEditModal
          visible={!!editProduct}
          industry={industry}
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onDone={(updated) => {
            setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditProduct(null);
          }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container  : { flex: 1, backgroundColor: Colors.bg },
  center     : { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  topBar     : { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  searchWrap : { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, color: Colors.textPrimary, paddingVertical: 10, fontSize: 14 },
  addBtn     : { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  addBtnText : { color: "#fff", fontWeight: "800", fontSize: 14 },

  industryBar        : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 4 },
  industryBadge      : { fontSize: 13, fontWeight: "700" },

  countLabel : { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  list       : { padding: 16, gap: 12, paddingBottom: 40 },
  empty      : { alignItems: "center", paddingTop: 60 },
  emptyText  : { color: Colors.textMuted, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptyHint  : { color: Colors.textMuted, fontSize: 13 },

  // Product card
  card              : { backgroundColor: Colors.bgCard, borderRadius: 14, flexDirection: "row", overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  cardPremium       : { borderColor: "#f59e0b55", backgroundColor: "#1a1508" },
  productImage      : { width: 90, height: 90 },
  productImagePlaceholder: { width: 90, height: 90, backgroundColor: Colors.bgInput, alignItems: "center", justifyContent: "center" },
  cardBody          : { flex: 1, padding: 10 },
  cardTop           : { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 },
  productName       : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  productPrice      : { color: Colors.primary, fontSize: 14, fontWeight: "800" },
  productMeta       : { color: Colors.textSecondary, fontSize: 11, marginBottom: 2 },
  productCode       : { color: Colors.textMuted, fontSize: 10, fontFamily: "monospace", marginBottom: 6, letterSpacing: 0.5 },
  premiumBadge      : { color: "#f59e0b", fontSize: 10, fontWeight: "800", marginBottom: 2 },
  cardActions       : { flexDirection: "row", alignItems: "center", gap: 8 },
  stockCountBadge   : { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6, borderWidth: 1 },
  stockLow          : { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)" },
  stockOk           : { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)" },
  stockCountText    : { fontSize: 11, fontWeight: "700" },
  stockBtn          : { flex: 1, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8, alignItems: "center" },
  stockText         : { fontSize: 11, fontWeight: "700" },
  editBtn           : { padding: 6, backgroundColor: Colors.primary + "15", borderRadius: 8 },
  editBtnText       : { fontSize: 15 },
  deleteBtn         : { padding: 6 },
  deleteBtnText     : { fontSize: 18 },

  // Chip
  chip     : { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  chipText : { color: Colors.textSecondary, fontSize: 12 },

  // Multi-image grid
  imgGrid         : { flexDirection: "row", gap: 8, marginBottom: 4 },
  imgSlot         : { flex: 1, aspectRatio: 1, borderRadius: 10, overflow: "hidden" },
  imgSlotFilled   : { borderWidth: 0 },
  imgSlotEmpty    : { borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed", backgroundColor: Colors.bgInput },
  imgSlotImg      : { width: "100%", height: "100%" },
  imgSlotPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  imgSlotPlus     : { fontSize: 28, color: Colors.textMuted, fontWeight: "300" },
  imgPrimaryBadge : { position: "absolute", top: 4, left: 4, backgroundColor: Colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  imgPrimaryText  : { color: "#fff", fontSize: 9, fontWeight: "700" },
  imgLoadOverlay  : { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },


  // Premium toggle
  premiumRow  : { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1a1508", borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 1, borderColor: "#f59e0b33" },
  premiumLeft : { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  premiumIcon : { fontSize: 22 },
  premiumLabel: { color: "#f59e0b", fontSize: 14, fontWeight: "700" },
  premiumHint : { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },

  // Stock row (edit modal)
  stockRow           : { flexDirection: "row", gap: 10, marginBottom: 4 },
  stockToggle        : { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border },
  stockToggleActive  : { backgroundColor: Colors.green + "22", borderColor: Colors.green },
  stockToggleInactive: { backgroundColor: Colors.red + "22",   borderColor: Colors.red },
  stockToggleText    : { fontSize: 13, color: Colors.textSecondary },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet  : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "96%" },
  modalHandle : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle  : { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  closeBtn    : { color: Colors.textSecondary, fontSize: 20, padding: 4 },
  fieldLabel  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input       : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  submitBtn         : { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  submitBtnDisabled : { opacity: 0.6 },
  submitText        : { color: "#fff", fontWeight: "800", fontSize: 16 },

  // Error
  errorIcon: { fontSize: 36, marginBottom: 10 },
  errorMsg : { color: Colors.textSecondary, fontSize: 13, textAlign: "center", marginHorizontal: 30, marginBottom: 16 },
  retryBtn : { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
