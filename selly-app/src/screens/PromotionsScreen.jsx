import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Modal, FlatList,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { sendFlashSale, sendNewArrival, sendAbandonedCart, fetchCatalog, fetchCustomers } from "../lib/api";

export default function PromotionsScreen() {
  const [products, setProducts]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [flashMsg, setFlashMsg]     = useState("⚡ Flash Sale! Limited time offer on selected items.");
  const [arrivalMsg, setArrivalMsg] = useState("✨ New Arrivals are here! Check out our latest collection.");
  const [selectedProds, setSelectedProds] = useState([]);
  const [pickModal, setPickModal]   = useState(null); // "flash" | "arrival"

  const load = async () => {
    try {
      const [c, cu] = await Promise.all([fetchCatalog(), fetchCustomers()]);
      setProducts(c.products || []);
      setCustomers(cu.customers || []);
    } catch (e) {
      console.warn(e.message);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const show = (msg, ok = true) => setResult({ msg, ok });

  const sendFlash = async () => {
    if (selectedProds.length === 0) { show("Select at least one product.", false); return; }
    setLoading(true);
    try {
      const d = await sendFlashSale({ productIds: selectedProds, message: flashMsg });
      show(`✅ Flash sale sent to ${d.sent || 0} customers!`);
      setSelectedProds([]);
    } catch (e) {
      show("Error: " + e.message, false);
    } finally { setLoading(false); }
  };

  const sendArrival = async () => {
    if (selectedProds.length === 0) { show("Select at least one product.", false); return; }
    setLoading(true);
    try {
      const d = await sendNewArrival({ productIds: selectedProds, message: arrivalMsg });
      show(`✅ New arrival sent to ${d.sent || 0} customers!`);
      setSelectedProds([]);
    } catch (e) {
      show("Error: " + e.message, false);
    } finally { setLoading(false); }
  };

  const sendAbandoned = async () => {
    setLoading(true);
    try {
      const d = await sendAbandonedCart();
      show(`✅ Recovery DMs sent to ${d.sent || 0} customers with abandoned carts.`);
    } catch (e) {
      show("Error: " + e.message, false);
    } finally { setLoading(false); }
  };

  const toggleProduct = (id) => {
    setSelectedProds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectedNames = products
    .filter(p => selectedProds.includes(p.id))
    .map(p => p.name)
    .join(", ");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Promotions</Text>
      <Text style={styles.pageSubtitle}>
        Blast promotional DMs to your {customers.length} customers
      </Text>

      {/* Result banner */}
      {result && (
        <TouchableOpacity
          style={[styles.resultBanner, { backgroundColor: result.ok ? Colors.green + "22" : Colors.red + "22" }]}
          onPress={() => setResult(null)}
        >
          <Text style={[styles.resultText, { color: result.ok ? Colors.green : Colors.red }]}>
            {result.msg}
          </Text>
          <Text style={styles.dismissText}>tap to dismiss</Text>
        </TouchableOpacity>
      )}

      {/* Product picker */}
      <View style={styles.pickerBox}>
        <Text style={styles.pickerLabel}>Selected Products ({selectedProds.length})</Text>
        {selectedNames ? (
          <Text style={styles.pickerNames} numberOfLines={2}>{selectedNames}</Text>
        ) : (
          <Text style={styles.pickerEmpty}>No products selected — tap "Choose" below</Text>
        )}
        <TouchableOpacity style={styles.chooseBtn} onPress={() => setPickModal("choose")}>
          <Text style={styles.chooseBtnText}>Choose Products</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Flash Sale card ─────────────────────── */}
      <PromoCard
        icon="⚡"
        title="Flash Sale"
        color={Colors.yellow}
        description="Send an urgent limited-time DM to all customers. Marks orders with flash_sale attribution."
        customersCount={customers.length}
      >
        <Text style={styles.fieldLabel}>Message Preview</Text>
        <TextInput
          style={styles.msgInput}
          value={flashMsg}
          onChangeText={setFlashMsg}
          multiline
          numberOfLines={3}
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.yellow }, loading && styles.sendBtnDisabled]}
          onPress={sendFlash}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#000" />
            : <Text style={[styles.sendBtnText, { color: "#000" }]}>Send Flash Sale DMs</Text>
          }
        </TouchableOpacity>
      </PromoCard>

      {/* ─── New Arrival card ─────────────────────── */}
      <PromoCard
        icon="✨"
        title="New Arrival"
        color={Colors.blue}
        description="Announce new products to all customers. Marks orders with new_arrival attribution."
        customersCount={customers.length}
      >
        <Text style={styles.fieldLabel}>Message Preview</Text>
        <TextInput
          style={styles.msgInput}
          value={arrivalMsg}
          onChangeText={setArrivalMsg}
          multiline
          numberOfLines={3}
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.blue }, loading && styles.sendBtnDisabled]}
          onPress={sendArrival}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>Send New Arrival DMs</Text>
          }
        </TouchableOpacity>
      </PromoCard>

      {/* ─── Abandoned Cart Recovery card ─────────── */}
      <PromoCard
        icon="🛒"
        title="Abandoned Cart Recovery"
        color={Colors.accent}
        description="Re-engage customers who started a conversation but didn't complete an order in the last 24 hours."
        customersCount={customers.length}
      >
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>💡 This automatically finds customers who haven't ordered in 24h and sends a nudge DM.</Text>
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: Colors.accent }, loading && styles.sendBtnDisabled]}
          onPress={sendAbandoned}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>Recover Abandoned Carts</Text>
          }
        </TouchableOpacity>
      </PromoCard>

      {/* Commission note */}
      <View style={styles.commissionNote}>
        <Text style={styles.commissionTitle}>💳 Commission Reminder</Text>
        <Text style={styles.commissionText}>
          Orders placed via Flash Sale, New Arrival, Abandoned Cart, or Referral promotions where any item is priced above ₹1,000 will attract a 5% commission from Selly.
        </Text>
      </View>

      {/* Product picker modal */}
      <Modal visible={pickModal === "choose"} animationType="slide" transparent>
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
                const sel = selectedProds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.pickItem, sel && styles.pickItemActive]}
                    onPress={() => toggleProduct(item.id)}
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
    </ScrollView>
  );
}

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

  promoCard   : { backgroundColor: Colors.bgCard, borderRadius: 16, marginBottom: 16, borderWidth: 1, overflow: "hidden" },
  promoCardHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  promoIcon   : { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  promoIconText: { fontSize: 22 },
  promoCardMeta: { flex: 1 },
  promoTitle  : { fontSize: 16, fontWeight: "800" },
  promoAudience: { color: Colors.textMuted, fontSize: 12 },
  chevron     : { color: Colors.textMuted, fontSize: 14 },
  promoCardBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  promoDesc   : { color: Colors.textSecondary, fontSize: 13, marginTop: 10, marginBottom: 12, lineHeight: 18 },

  fieldLabel  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  msgInput    : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 13, borderWidth: 1, borderColor: Colors.border, textAlignVertical: "top" },
  sendBtn     : { borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText : { color: "#fff", fontWeight: "800", fontSize: 15 },

  infoBox     : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  infoText    : { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },

  commissionNote: { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.primary + "33", marginTop: 4 },
  commissionTitle: { color: Colors.primary, fontSize: 14, fontWeight: "800", marginBottom: 6 },
  commissionText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet  : { backgroundColor: Colors.bgModal, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: "80%" },
  modalHandle : { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  closeBtn    : { color: Colors.primary, fontSize: 16, fontWeight: "700" },
  pickItem    : { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickItemActive: { backgroundColor: Colors.primary + "15" },
  pickName    : { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: "600" },
  pickPrice   : { color: Colors.primary, fontSize: 14, fontWeight: "700", marginRight: 8 },
  pickCheck   : { color: Colors.green, fontSize: 16, fontWeight: "800" },
});
