import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator, Image,
  Alert, Switch, Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Colors } from "../constants/colors";
import {
  fetchCatalog, addProduct, updateProduct, toggleStock, deleteProduct,
  uploadProductImage, fetchBusinessSettings, saveBusinessSettings,
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

// ── Photo Picker Button ───────────────────────────────────────────────────────
function PhotoPickerButton({ imageUrl, onPicked, uploading }) {
  const pick = async (source) => {
    const perm = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow access in device settings."); return; }

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1], mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (!result.canceled && result.assets?.[0]?.uri) {
      onPicked(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.photoPickerWrap}>
      {imageUrl ? (
        <View style={styles.photoPreviewWrap}>
          <Image source={{ uri: imageUrl }} style={styles.photoPreview} />
          <TouchableOpacity style={styles.photoChangeBtn} onPress={() => pick("gallery")}>
            <Text style={styles.photoChangeBtnText}>✏️ Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoEmpty}>
          {uploading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pick("camera")}>
                <Text style={styles.photoBtnIcon}>📷</Text>
                <Text style={styles.photoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pick("gallery")}>
                <Text style={styles.photoBtnIcon}>🖼️</Text>
                <Text style={styles.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ── Industry Picker Modal ─────────────────────────────────────────────────────
function IndustryPickerModal({ visible, onSelect }) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.fullOverlay}>
        <View style={styles.industrySheet}>
          <Text style={styles.industryTitle}>What kind of business are you?</Text>
          <Text style={styles.industrySubtitle}>We'll customize your catalog form for you.</Text>

          {Object.entries(INDUSTRIES).map(([key, cfg]) => (
            <TouchableOpacity key={key} style={[styles.industryCard, { borderColor: cfg.color + "55" }]} onPress={() => onSelect(key)}>
              <Text style={styles.industryCardIcon}>{cfg.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.industryCardLabel, { color: cfg.color }]}>{cfg.label}</Text>
                <Text style={styles.industryCardDesc}>
                  {key === "education" && "Courses, coaching, tutoring, workshops"}
                  {key === "product"   && "Clothing, electronics, food, accessories"}
                  {key === "tourism"   && "Travel packages, tours, itineraries"}
                </Text>
              </View>
              <Text style={{ color: cfg.color, fontSize: 20 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
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
function ProductItemForm({ form, set }) {
  const cfg     = INDUSTRIES.product;
  const subCats = cfg.subCategories[form.category] || [];
  const sizeOpts = form.category === "Clothing" ? cfg.sizes["Clothing"] : cfg.sizes["default"];

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

      <Text style={styles.fieldLabel}>Available Sizes</Text>
      <ChipRow items={sizeOpts} selected={form.sizes || []} onSelect={toggleSize} color={cfg.color} />

      <Text style={styles.fieldLabel}>Colors (comma-separated)</Text>
      <TextInput style={styles.input} value={form.colors} onChangeText={v => set("colors", v)} placeholder="Red, Black, Navy Blue" placeholderTextColor={Colors.textMuted} />

      <Text style={styles.fieldLabel}>Material / Fabric</Text>
      <TextInput style={styles.input} value={form.material} onChangeText={v => set("material", v)} placeholder="e.g. Cotton, Silk, Denim" placeholderTextColor={Colors.textMuted} />

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
  name:"", price:"", category:"", subCategory:"", description:"", imageUrl:"",
  sizes:[], colors:"", material:"", isPremium:false, inStock:true,
  duration:"", batchTiming:"", mode:"Online", whatIncluded:"",
  destination:"", groupSize:"", inclusions:"",
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
    sizes:        p.sizes       || [],
    colors:       (p.colors || []).join(", "),
    material:     p.material    || "",
    isPremium:    p.isPremium   || false,
    inStock:      p.inStock !== false,
    duration:     ef.duration    || "",
    batchTiming:  ef.batchTiming || "",
    mode:         ef.mode        || "Online",
    whatIncluded: ef.whatIncluded|| "",
    destination:  ef.destination || p.subCategory || "",
    groupSize:    String(ef.groupSize || ""),
    inclusions:   ef.inclusions  || "",
  };
}

function AddEditModal({ visible, industry, product, onClose, onDone }) {
  const isEdit  = !!product;
  const [form, setForm]       = useState(product ? toForm(product) : { ...BLANK });
  const [saving, setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    setForm(product ? toForm(product) : { ...BLANK });
  }, [product?.id, visible]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const cfg = INDUSTRIES[industry] || INDUSTRIES.product;

  const handlePhoto = async (localUri) => {
    setUploading(true);
    try {
      const tmpId = Date.now().toString();
      const url = await uploadProductImage(localUri, product?.id || tmpId);
      set("imageUrl", url);
    } catch (e) {
      Alert.alert("Upload failed", e.message);
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = () => {
    const extraFields = {};
    if (industry === "education") {
      if (form.duration)     extraFields.duration     = form.duration;
      if (form.batchTiming)  extraFields.batchTiming  = form.batchTiming;
      if (form.mode)         extraFields.mode         = form.mode;
      if (form.whatIncluded) extraFields.whatIncluded = form.whatIncluded;
    }
    if (industry === "tourism") {
      if (form.subCategory) extraFields.destination  = form.subCategory;
      if (form.duration)    extraFields.duration     = form.duration;
      if (form.groupSize)   extraFields.groupSize    = form.groupSize;
      if (form.inclusions)  extraFields.inclusions   = form.inclusions;
    }
    return {
      name        : form.name.trim(),
      price       : Number(form.price) || 0,
      category    : form.category  || cfg.categories[0] || "general",
      subCategory : form.subCategory || null,
      description : form.description.trim(),
      imageUrl    : form.imageUrl.trim(),
      sizes       : Array.isArray(form.sizes) ? form.sizes : [],
      colors      : form.colors ? form.colors.split(",").map(c => c.trim()).filter(Boolean) : [],
      material    : form.material.trim(),
      isPremium   : !!form.isPremium,
      extraFields,
      inStock     : form.inStock,
    };
  };

  const submit = async () => {
    if (!form.name.trim()) { Alert.alert("Required", "Please enter a name."); return; }
    if (!form.price || isNaN(Number(form.price))) { Alert.alert("Required", "Please enter a valid price."); return; }
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
            {/* Photo picker */}
            <Text style={styles.fieldLabel}>Photo</Text>
            <PhotoPickerButton imageUrl={form.imageUrl} onPicked={handlePhoto} uploading={uploading} />

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

            <TouchableOpacity style={[styles.submitBtn, (saving || uploading) && styles.submitBtnDisabled]} onPress={submit} disabled={saving || uploading}>
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
          <Text style={styles.productMeta} numberOfLines={1}>
            {[p.category, p.subCategory].filter(Boolean).join(" › ")}
            {p.sizes?.length ? `  ·  📏 ${p.sizes.slice(0,4).join(", ")}` : ""}
          </Text>
        )}
        {industry === "tourism" && (
          <Text style={styles.productMeta} numberOfLines={1}>
            {[p.category, p.subCategory || ef.destination].filter(Boolean).join(" › ")}
            {ef.duration ? `  ·  ⏱ ${ef.duration}` : ""}
          </Text>
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
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(null);
  const [industry,    setIndustry]    = useState(null);   // null = not loaded yet
  const [showPicker,  setShowPicker]  = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [search,      setSearch]      = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catalogData, settingsData] = await Promise.all([
        fetchCatalog(),
        fetchBusinessSettings(),
      ]);
      setProducts(catalogData.products || []);
      const ind = settingsData.settings?.industry || null;
      setIndustry(ind);
      if (!ind) setShowPicker(true);
    } catch (e) {
      console.warn("[Catalog] load error:", e.message);
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const selectIndustry = async (ind) => {
    setShowPicker(false);
    setIndustry(ind);
    try { await saveBusinessSettings({ industry: ind }); }
    catch (e) { console.warn("Failed to save industry:", e.message); }
  };

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
      {/* Industry picker (first-time) */}
      <IndustryPickerModal visible={showPicker} onSelect={selectIndustry} />

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

      {/* Industry badge + change */}
      {industry && (
        <View style={styles.industryBar}>
          <Text style={[styles.industryBadge, { color: cfg.color }]}>{cfg.icon} {cfg.label}</Text>
          <TouchableOpacity onPress={() => setShowPicker(true)}>
            <Text style={styles.changeIndustryBtn}>Change</Text>
          </TouchableOpacity>
        </View>
      )}

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
              industry={industry || "product"}
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
        industry={industry || "product"}
        product={null}
        onClose={() => setShowAdd(false)}
        onDone={(p) => { setProducts(prev => [p, ...prev]); setShowAdd(false); }}
      />

      {/* Edit modal */}
      {editProduct && (
        <AddEditModal
          visible={!!editProduct}
          industry={industry || "product"}
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
  changeIndustryBtn  : { color: Colors.textSecondary, fontSize: 12, textDecorationLine: "underline" },

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
  productMeta       : { color: Colors.textSecondary, fontSize: 11, marginBottom: 6 },
  premiumBadge      : { color: "#f59e0b", fontSize: 10, fontWeight: "800", marginBottom: 2 },
  cardActions       : { flexDirection: "row", alignItems: "center", gap: 8 },
  stockBtn          : { flex: 1, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8, alignItems: "center" },
  stockText         : { fontSize: 11, fontWeight: "700" },
  editBtn           : { padding: 6, backgroundColor: Colors.primary + "15", borderRadius: 8 },
  editBtnText       : { fontSize: 15 },
  deleteBtn         : { padding: 6 },
  deleteBtnText     : { fontSize: 18 },

  // Chip
  chip     : { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  chipText : { color: Colors.textSecondary, fontSize: 12 },

  // Photo picker
  photoPickerWrap : { borderRadius: 12, overflow: "hidden", marginBottom: 8 },
  photoEmpty      : { flexDirection: "row", gap: 10, marginBottom: 4 },
  photoBtn        : { flex: 1, backgroundColor: Colors.bgInput, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  photoBtnIcon    : { fontSize: 26, marginBottom: 4 },
  photoBtnText    : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  photoPreviewWrap: { position: "relative" },
  photoPreview    : { width: "100%", height: 180, borderRadius: 12 },
  photoChangeBtn  : { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  photoChangeBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // Industry picker
  fullOverlay       : { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 20 },
  industrySheet     : { backgroundColor: Colors.bgCard, borderRadius: 20, padding: 24, gap: 12 },
  industryTitle     : { color: Colors.textPrimary, fontSize: 20, fontWeight: "900", marginBottom: 2 },
  industrySubtitle  : { color: Colors.textSecondary, fontSize: 13, marginBottom: 8 },
  industryCard      : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgInput, borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  industryCardIcon  : { fontSize: 28 },
  industryCardLabel : { fontSize: 15, fontWeight: "800" },
  industryCardDesc  : { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

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
