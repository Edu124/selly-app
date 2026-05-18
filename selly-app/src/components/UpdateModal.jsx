// ── Force Update Modal ─────────────────────────────────────────────────────────
// Shown when the installed APK version is below the server's min_version.
// Blocking — user cannot dismiss without downloading the new APK.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { Colors } from "../constants/colors";

export default function UpdateModal({ visible, apkUrl, releaseNotes, latestVersion }) {
  async function handleDownload() {
    if (!apkUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(apkUrl);
      if (canOpen) {
        await Linking.openURL(apkUrl);
      }
    } catch (err) {
      console.warn("[UpdateModal] Could not open APK URL:", err.message);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      // Empty handler blocks Android hardware back button intentionally
      onRequestClose={() => {}}
    >
      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>🔄</Text>
        </View>

        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.subtitle}>
          Version {latestVersion} is now available
        </Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>What's new</Text>
        <Text style={styles.notes}>{releaseNotes}</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            This update includes changes that require a fresh install.{"\n"}
            Your data will not be affected.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={handleDownload}
          activeOpacity={0.85}
        >
          <Text style={styles.downloadBtnText}>⬇  Download Update</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Tap above to download the new APK, then open and install it.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex             : 1,
    backgroundColor  : Colors.bg,
    alignItems       : "center",
    justifyContent   : "center",
    paddingHorizontal: 28,
    paddingVertical  : 40,
  },
  badge: {
    width          : 80,
    height         : 80,
    borderRadius   : 40,
    backgroundColor: Colors.bgCard,
    borderWidth    : 1,
    borderColor    : Colors.primary,
    alignItems     : "center",
    justifyContent : "center",
    marginBottom   : 24,
  },
  badgeIcon: { fontSize: 36 },
  title: {
    fontSize    : 26,
    fontWeight  : "700",
    color       : Colors.textPrimary,
    textAlign   : "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize    : 15,
    color       : Colors.textSecondary,
    textAlign   : "center",
    marginBottom: 24,
  },
  divider: {
    width          : "100%",
    height         : 1,
    backgroundColor: Colors.border,
    marginBottom   : 24,
  },
  sectionLabel: {
    fontSize     : 12,
    fontWeight   : "600",
    color        : Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    alignSelf    : "flex-start",
    marginBottom : 8,
  },
  notes: {
    fontSize    : 15,
    color       : Colors.textPrimary,
    lineHeight  : 22,
    alignSelf   : "flex-start",
    marginBottom: 20,
  },
  infoBox: {
    width          : "100%",
    backgroundColor: Colors.bgCard,
    borderRadius   : 10,
    borderWidth    : 1,
    borderColor    : Colors.border,
    padding        : 14,
    marginBottom   : 32,
  },
  infoText: {
    fontSize : 13,
    color    : Colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
  },
  downloadBtn: {
    width          : "100%",
    backgroundColor: Colors.primary,
    borderRadius   : 12,
    paddingVertical: 16,
    alignItems     : "center",
    marginBottom   : 16,
  },
  downloadBtnText: {
    fontSize  : 17,
    fontWeight: "700",
    color     : "#ffffff",
  },
  hint: {
    fontSize  : 12,
    color     : Colors.textMuted,
    textAlign : "center",
    lineHeight: 18,
  },
});
