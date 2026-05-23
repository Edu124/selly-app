// ── Scan & Sell Screen ────────────────────────────────────────────────────────
// Quick bill / inventory lookup via barcode or manual entry
// Uses manual barcode input + catalog lookup (no camera dependency needed)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, FlatList,
} from "react-native";
import { Colors } from "../constants/colors";
import { fetchCatalog } from "../lib/api";

// ── Cart Item Row ─────────────────────────────────────────────────────────────
function CartItemRow({ item, onQtyChange, onRemove }) {
  return (
    <View style={styles.cartRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cartBarcode}>{item.barcode || item.product_number || "—"}</Text>
      </View>
      <View style={styles.qtyControls}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onQtyChange(item.id, item.qty - 1)}>
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qtyVal}>{item.qty}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => onQtyChange(item.id, item.qty + 1)}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={styles.cartAmt}>₹{(item.price * item.qty).toLocaleString("en-IN")}</Text>
        <TouchableOpacity onPress={() => onRemove(item.id)}>
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Product Match Card ────────────────────────────────────────────────────────
function ProductMatchCard({ product, onAddToCart }) {
  return (
    <View style={styles.matchCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.matchName}>{product.name}</Text>
        {product.product_number && (
          <Text style={styles.matchCode}>SKU: {product.product_number}</Text>
        )}
        <Text style={styles.matchStock}>{product.in_stock ? "✅ In Stock" : "⛔ Out of Stock"}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 8 }}>
        <Text style={styles.matchPrice}>₹{Number(product.price || 0).toLocaleString("en-IN")}</Text>
        <TouchableOpacity
          style={[styles.addToCartBtn, !product.in_stock && { opacity: 0.5 }]}
          onPress={() => onAddToCart(product)}
          disabled={!product.in_stock}
        >
          <Text style={styles.addToCartBtnText}>Add to Bill</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ScanAndSellScreen() {
  const [catalog,    setCatalog]    = useState([]);
  const [searchText, setSearchText] = useState("");
  const [matches,    setMatches]    = useState([]);
  const [cart,       setCart]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [billDone,   setBillDone]   = useState(false);

  // Load catalog once
  React.useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    try {
      const data = await fetchCatalog();
      setCatalog(data?.products || []);
    } catch (_) {}
  }

  function search() {
    if (!searchText.trim()) return;
    setLoading(true);
    setSearched(true);
    const q = searchText.trim().toLowerCase();
    const results = catalog.filter(p =>
      (p.product_number && p.product_number.toLowerCase() === q) ||
      (p.barcode && p.barcode.toLowerCase() === q) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase() === q)
    );
    setMatches(results);
    setLoading(false);
  }

  function addToCart(product) {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setSearchText("");
    setMatches([]);
    setSearched(false);
  }

  function changeQty(id, qty) {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.id !== id));
    } else {
      setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
    }
  }

  function removeFromCart(id) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  function generateBill() {
    if (cart.length === 0) return Alert.alert("Cart is empty", "Add products to generate a bill.");
    setBillDone(true);
    Alert.alert(
      "Bill Generated!",
      `${customerName ? customerName + " — " : ""}${totalItems} items · ₹${subtotal.toLocaleString("en-IN")}`,
      [{ text: "New Sale", onPress: clearBill }]
    );
  }

  function clearBill() {
    setCart([]);
    setCustomerName("");
    setBillDone(false);
    setSearchText("");
    setMatches([]);
    setSearched(false);
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Type barcode, SKU or product name..."
          placeholderTextColor={Colors.textMuted}
          value={searchText}
          onChangeText={t => { setSearchText(t); if (!t.trim()) { setMatches([]); setSearched(false); } }}
          onSubmitEditing={search}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={search} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">

        {/* Search results */}
        {loading && (
          <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} /></View>
        )}
        {searched && !loading && matches.length === 0 && (
          <View style={styles.noMatchBox}>
            <Text style={styles.noMatchIcon}>🔍</Text>
            <Text style={styles.noMatchText}>No product found</Text>
            <Text style={styles.noMatchHint}>Try a different barcode or name</Text>
          </View>
        )}
        {matches.length > 0 && (
          <View style={styles.matchesSection}>
            <Text style={styles.matchesLabel}>{matches.length} product{matches.length !== 1 ? "s" : ""} found</Text>
            {matches.map(p => (
              <ProductMatchCard key={p.id} product={p} onAddToCart={addToCart} />
            ))}
          </View>
        )}

        {/* Hints when nothing searched */}
        {!searched && cart.length === 0 && (
          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>📷 How to use Scan & Sell</Text>
            <Text style={styles.hintStep}>1️⃣  Type the product barcode or SKU above</Text>
            <Text style={styles.hintStep}>2️⃣  Select product → "Add to Bill"</Text>
            <Text style={styles.hintStep}>3️⃣  Adjust quantities as needed</Text>
            <Text style={styles.hintStep}>4️⃣  Hit "Generate Bill" to complete the sale</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 }}>
              💡 Add barcodes to products in the Catalog/Inventory tab (SKU/Product Number field)
            </Text>
          </View>
        )}

        {/* Cart section */}
        {cart.length > 0 && (
          <View style={styles.cartSection}>
            <Text style={styles.cartTitle}>🛒 Bill ({totalItems} items)</Text>

            {/* Customer name */}
            <TextInput
              style={styles.customerInput}
              placeholder="Customer name (optional)"
              placeholderTextColor={Colors.textMuted}
              value={customerName}
              onChangeText={setCustomerName}
            />

            {cart.map(item => (
              <CartItemRow
                key={item.id}
                item={item}
                onQtyChange={changeQty}
                onRemove={removeFromCart}
              />
            ))}

            {/* Totals */}
            <View style={styles.totalsCard}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsKey}>Subtotal ({totalItems} items)</Text>
                <Text style={styles.totalsVal}>₹{subtotal.toLocaleString("en-IN")}</Text>
              </View>
              <View style={[styles.totalsRow, { paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border }]}>
                <Text style={[styles.totalsKey, { fontWeight: "900", fontSize: 16 }]}>Total</Text>
                <Text style={[styles.totalsVal, { fontWeight: "900", fontSize: 20, color: Colors.primary }]}>₹{subtotal.toLocaleString("en-IN")}</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.clearBtn} onPress={clearBill}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.billBtn} onPress={generateBill}>
                <Text style={styles.billBtnText}>Generate Bill ›</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Search
  searchBar    : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchIcon   : { fontSize: 18 },
  searchInput  : { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 6 },
  searchBtn    : { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  searchBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  // Results
  loadingBox  : { alignItems: "center", padding: 20 },
  noMatchBox  : { alignItems: "center", padding: 32, gap: 6 },
  noMatchIcon : { fontSize: 36 },
  noMatchText : { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  noMatchHint : { color: Colors.textMuted, fontSize: 12 },

  matchesSection: { padding: 12, gap: 8 },
  matchesLabel  : { color: Colors.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 4 },

  matchCard      : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  matchName      : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800" },
  matchCode      : { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  matchStock     : { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  matchPrice     : { color: Colors.textPrimary, fontSize: 16, fontWeight: "900" },
  addToCartBtn   : { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  addToCartBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  // Hints
  hintBox  : { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 20, margin: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  hintTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  hintStep : { color: Colors.textSecondary, fontSize: 13, lineHeight: 22 },

  // Cart
  cartSection    : { padding: 12, gap: 8 },
  cartTitle      : { color: Colors.textPrimary, fontSize: 15, fontWeight: "900" },
  customerInput  : { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, color: Colors.textPrimary, fontSize: 13 },

  cartRow    : { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cartName   : { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },
  cartBarcode: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  cartAmt    : { color: Colors.textPrimary, fontSize: 15, fontWeight: "900" },
  removeText : { color: "#ef4444", fontSize: 11, fontWeight: "700" },

  qtyControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn     : { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  qtyBtnText : { color: Colors.textPrimary, fontSize: 16, fontWeight: "800", lineHeight: 20 },
  qtyVal     : { color: Colors.textPrimary, fontSize: 14, fontWeight: "800", minWidth: 24, textAlign: "center" },

  totalsCard  : { backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border },
  totalsRow   : { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalsKey   : { color: Colors.textSecondary, fontSize: 13 },
  totalsVal   : { color: Colors.textPrimary, fontSize: 14, fontWeight: "700" },

  actionRow  : { flexDirection: "row", gap: 10 },
  clearBtn   : { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 13, alignItems: "center" },
  clearBtnText: { color: Colors.textMuted, fontWeight: "700", fontSize: 14 },
  billBtn    : { flex: 2, backgroundColor: Colors.primary, borderRadius: 12, padding: 13, alignItems: "center" },
  billBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
