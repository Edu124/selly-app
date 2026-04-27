// ── Admin Screen ──────────────────────────────────────────────────────────────
// Visible ONLY to codeforeai.app@gmail.com
// Manage all client subscriptions + register WhatsApp numbers
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import {
  fetchAdminClients, adminActivate, adminExtend, adminExpire,
  adminRegisterNumber,
} from "../lib/api";

const STATUS_COLOR = { trial: "#F59E0B", active: "#10B981", expired: "#EF4444" };
const STATUS_LABEL = { trial: "TRIAL",   active: "PRO",     expired: "EXPIRED" };

export default function AdminScreen() {
  const [clients,    setClients]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId,   setActionId]   = useState(null);

  // ── Register number modal ─────────────────────────────────────────────────
  const [showModal,     setShowModal]     = useState(false);
  const [regBizId,      setRegBizId]      = useState("");
  const [regPhoneNumId, setRegPhoneNumId] = useState("");
  const [regPhone,      setRegPhone]      = useState("");
  const [regToken,      setRegToken]      = useState("");
  const [regSaving,     setRegSaving]     = useState(false);

  // ── Load clients ──────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await fetchAdminClients();
      setClients(data.clients || []);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Subscription actions ──────────────────────────────────────────────────
  async function doAction(action, businessId, label) {
    Alert.alert(label, `Apply "${label}" to ${businessId}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: action === "expire" ? "destructive" : "default",
        onPress: async () => {
          setActionId(businessId);
          try {
            if (action === "activate") await adminActivate(businessId);
            else if (action === "extend") await adminExtend(businessId);
            else if (action === "expire") await adminExpire(businessId);
            await load();
          } catch (e) { Alert.alert("Failed", e.message); }
          finally { setActionId(null); }
        },
      },
    ]);
  }

  // ── Register WhatsApp number ──────────────────────────────────────────────
  function openRegister(bizId = "") {
    setRegBizId(bizId);
    setRegPhoneNumId("");
    setRegPhone("");
    setRegToken("");
    setShowModal(true);
  }

  async function saveRegister() {
    if (!regBizId.trim() || !regPhoneNumId.trim()) {
      Alert.alert("Required", "Business ID and Phone Number ID are required.");
      return;
    }
    setRegSaving(true);
    try {
      await adminRegisterNumber({
        businessId    : regBizId.trim(),
        phoneNumberId : regPhoneNumId.trim(),
        phoneNumber   : regPhone.trim(),
        token         : regToken.trim(),
      });
      setShowModal(false);
      await load();
      Alert.alert("✅ Registered", `Number linked to ${regBizId}`);
    } catch (e) {
      Alert.alert("Failed", e.message);
    } finally {
      setRegSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading clients…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
      >
        <Text style={styles.pageTitle}>🔐 Admin Panel</Text>
        <Text style={styles.subtitle}>{clients.length} client{clients.length !== 1 ? "s" : ""} registered</Text>

        {/* Add new number button */}
        <TouchableOpacity style={styles.addBtn} onPress={() => openRegister()}>
          <Text style={styles.addBtnText}>+ Register WhatsApp Number</Text>
        </TouchableOpacity>

        {clients.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No clients yet.</Text>
          </View>
        )}

        {clients.map(c => {
          const color    = STATUS_COLOR[c.status] || Colors.textMuted;
          const isBusy   = actionId === c.businessId;
          const isActive = c.status === "active";
          const isTrial  = c.status === "trial";
          const isExpired= c.status === "expired";

          return (
            <View key={c.businessId} style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bizId}>{c.businessId}</Text>
                  <Text style={styles.bizMeta}>
                    Created {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "—"}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color }]}>
                  <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[c.status] || c.status.toUpperCase()}</Text>
                </View>
              </View>

              {/* Days remaining */}
              <View style={styles.daysRow}>
                <Text style={styles.daysLabel}>
                  {isActive ? "Days remaining (paid)" : isTrial ? "Trial days left" : "Status"}
                </Text>
                <Text style={[styles.daysValue, { color: isExpired ? "#EF4444" : Colors.textPrimary }]}>
                  {isExpired ? "Access cut off" : `${c.daysRemaining ?? "?"} day${c.daysRemaining !== 1 ? "s" : ""}`}
                </Text>
              </View>

              {/* WhatsApp number status */}
              <View style={styles.waRow}>
                <Text style={styles.waLabel}>WhatsApp Bot</Text>
                {c.botActive && c.phoneNumber ? (
                  <Text style={styles.waActive}>✅ {c.phoneNumber}</Text>
                ) : (
                  <TouchableOpacity onPress={() => openRegister(c.businessId)}>
                    <Text style={styles.waSetup}>⚠️ Not linked — tap to setup</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Expiry dates */}
              {(c.trialEnds || c.paidUntil) && (
                <View style={styles.datesRow}>
                  {c.trialEnds && (
                    <Text style={styles.dateChip}>Trial ends: {new Date(c.trialEnds).toLocaleDateString("en-IN")}</Text>
                  )}
                  {c.paidUntil && (
                    <Text style={[styles.dateChip, { color: Colors.primary }]}>
                      Paid until: {new Date(c.paidUntil).toLocaleDateString("en-IN")}
                    </Text>
                  )}
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionsRow}>
                {(isTrial || isExpired) && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#10B98122", borderColor: "#10B981" }, isBusy && styles.btnDisabled]}
                    onPress={() => doAction("activate", c.businessId, "Activate (30 days)")}
                    disabled={isBusy}
                  >
                    {isBusy ? <ActivityIndicator color="#10B981" size="small" />
                             : <Text style={[styles.actionBtnText, { color: "#10B981" }]}>✓ Activate</Text>}
                  </TouchableOpacity>
                )}
                {isActive && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.primary + "22", borderColor: Colors.primary }, isBusy && styles.btnDisabled]}
                    onPress={() => doAction("extend", c.businessId, "Extend +30 days")}
                    disabled={isBusy}
                  >
                    {isBusy ? <ActivityIndicator color={Colors.primary} size="small" />
                             : <Text style={[styles.actionBtnText, { color: Colors.primary }]}>+30d Extend</Text>}
                  </TouchableOpacity>
                )}
                {!isExpired && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#EF444422", borderColor: "#EF4444" }, isBusy && styles.btnDisabled]}
                    onPress={() => doAction("expire", c.businessId, "Expire access")}
                    disabled={isBusy}
                  >
                    {isBusy ? <ActivityIndicator color="#EF4444" size="small" />
                             : <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>✕ Expire</Text>}
                  </TouchableOpacity>
                )}
                {isExpired && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#10B98122", borderColor: "#10B981" }, isBusy && styles.btnDisabled]}
                    onPress={() => doAction("activate", c.businessId, "Reactivate (30 days)")}
                    disabled={isBusy}
                  >
                    {isBusy ? <ActivityIndicator color="#10B981" size="small" />
                             : <Text style={[styles.actionBtnText, { color: "#10B981" }]}>↺ Reactivate</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Register Number Modal ─────────────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>📱 Register WhatsApp Number</Text>
            <Text style={styles.modalDesc}>
              After adding a client's number in Meta, paste the phone_number_id here to link it to their account.
            </Text>

            <Text style={styles.fieldLabel}>Business ID *</Text>
            <TextInput
              style={styles.input}
              value={regBizId}
              onChangeText={setRegBizId}
              placeholder="e.g. ABC123"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Phone Number ID * (from Meta)</Text>
            <TextInput
              style={styles.input}
              value={regPhoneNumId}
              onChangeText={setRegPhoneNumId}
              placeholder="e.g. 123456789012345"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Phone Number (for display)</Text>
            <TextInput
              style={styles.input}
              value={regPhone}
              onChangeText={setRegPhone}
              placeholder="+919876543210"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>WhatsApp Token (optional — uses env token if blank)</Text>
            <TextInput
              style={styles.input}
              value={regToken}
              onChangeText={setRegToken}
              placeholder="EAABxxx..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, regSaving && { opacity: 0.6 }]}
                onPress={saveRegister}
                disabled={regSaving}
              >
                {regSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Register</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container   : { flex: 1, backgroundColor: Colors.bg },
  content     : { padding: 16, paddingBottom: 40 },
  center      : { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  loadingText : { color: Colors.textSecondary, marginTop: 12, fontSize: 14 },

  pageTitle   : { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", marginBottom: 4 },
  subtitle    : { color: Colors.textSecondary, fontSize: 13, marginBottom: 12 },

  addBtn      : { backgroundColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 16 },
  addBtnText  : { color: "#fff", fontWeight: "800", fontSize: 14 },

  empty       : { alignItems: "center", paddingVertical: 40 },
  emptyText   : { color: Colors.textMuted, fontSize: 15 },

  card        : { backgroundColor: Colors.bgCard, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  cardHeader  : { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  bizId       : { color: Colors.textPrimary, fontSize: 15, fontWeight: "800" },
  bizMeta     : { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  badge       : { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  badgeText   : { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  daysRow     : { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  daysLabel   : { color: Colors.textSecondary, fontSize: 13 },
  daysValue   : { color: Colors.textPrimary, fontSize: 13, fontWeight: "700" },

  waRow       : { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  waLabel     : { color: Colors.textSecondary, fontSize: 13 },
  waActive    : { color: "#10B981", fontSize: 12, fontWeight: "700" },
  waSetup     : { color: "#F59E0B", fontSize: 12, fontWeight: "600" },

  datesRow    : { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  dateChip    : { color: Colors.textMuted, fontSize: 12, backgroundColor: Colors.bgInput, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },

  actionsRow  : { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionBtn   : { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, alignItems: "center", minWidth: 100 },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  btnDisabled : { opacity: 0.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalBox    : { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle  : { color: Colors.textPrimary, fontSize: 18, fontWeight: "900", marginBottom: 6 },
  modalDesc   : { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  fieldLabel  : { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input       : { backgroundColor: Colors.bgInput, borderRadius: 10, padding: 12, color: Colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  modalBtns   : { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn   : { flex: 1, backgroundColor: Colors.bgInput, borderRadius: 10, padding: 13, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "700" },
  saveBtn     : { flex: 1, backgroundColor: Colors.primary, borderRadius: 10, padding: 13, alignItems: "center" },
  saveBtnText : { color: "#fff", fontWeight: "700" },
});
