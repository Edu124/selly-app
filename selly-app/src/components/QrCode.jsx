// ── QrCode ────────────────────────────────────────────────────────────────────
// Renders a QR code with no native dependency.
//
// WHY NOT react-native-svg: it was tried in this codebase and failed at runtime
// ("Unable to resolve module ./xml"). The sales chart on HomeScreen is hand-rolled
// Views for the same reason. Native modules also can't ship over OTA — they need
// a fresh EAS build — so a pure-JS approach keeps `expo-updates` useful.
//
// HOW: qrcode-generator (pure JS, zero deps, ~5 KB) produces the module matrix.
// We render each horizontal run of dark modules as one absolutely-positioned
// View instead of one View per module, which roughly halves the node count.
// A typical table QR is 29x29 → ~217 Views, which renders fine on web and native.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import qrcode from "qrcode-generator";
import { Colors } from "../constants/colors";

/**
 * @param value  the string to encode
 * @param size   rendered edge length in px (default 200)
 * @param dark   module colour (default black — keep it black for scannability)
 * @param light  quiet-zone / background colour (default white)
 * @param ec     error correction: "L" | "M" | "Q" | "H". "M" is right for a
 *               printed card that will get handled and stained.
 * @param quiet  quiet-zone width in modules. The spec says 4; anything less
 *               and some scanners refuse the code.
 */
export default function QrCode({
  value,
  size  = 200,
  dark  = "#000000",
  light = "#ffffff",
  ec    = "M",
  quiet = 4,
  style,
}) {
  const model = useMemo(() => {
    if (!value) return null;
    try {
      // typeNumber 0 = pick the smallest version that fits the data.
      const qr = qrcode(0, ec);
      qr.addData(String(value));
      qr.make();

      const count = qr.getModuleCount();
      const runs  = [];

      // Collapse each row into horizontal runs of dark modules.
      for (let row = 0; row < count; row++) {
        let start = -1;
        for (let col = 0; col < count; col++) {
          const isDark = qr.isDark(row, col);
          if (isDark && start === -1) start = col;
          if (!isDark && start !== -1) {
            runs.push({ row, col: start, len: col - start });
            start = -1;
          }
        }
        if (start !== -1) runs.push({ row, col: start, len: count - start });
      }

      return { count, runs };
    } catch (e) {
      // Over-long input is the only realistic failure (QR caps out around 2 KB).
      return null;
    }
  }, [value, ec]);

  if (!model) {
    return (
      <View style={[styles.fallback, { width: size, height: size }, style]}>
        <Text style={styles.fallbackText}>
          {value ? "Can't encode this link" : "No link yet"}
        </Text>
      </View>
    );
  }

  const { count, runs } = model;
  // The quiet zone is part of the code, so it has to come out of `size`.
  const total  = count + quiet * 2;
  const module = size / total;
  const offset = quiet * module;

  return (
    <View
      style={[{ width: size, height: size, backgroundColor: light }, style]}
      // Screen readers get the payload rather than a wall of nothing.
      accessible
      accessibilityRole="image"
      accessibilityLabel={`QR code for ${value}`}
    >
      {runs.map(({ row, col, len }) => (
        <View
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            // +0.5 on width/height closes the hairline seams that appear
            // between adjacent runs when module lands on a fractional pixel.
            top   : offset + row * module,
            left  : offset + col * module,
            width : len * module + 0.5,
            height: module + 0.5,
            backgroundColor: dark,
          }}
        />
      ))}
    </View>
  );
}

// ── Link builders ─────────────────────────────────────────────────────────────
// Kept here so the QR payload and the "copy link" button can never disagree.

/**
 * Click-to-chat link for a table.
 *
 * The prefilled text carries the table number and nothing else: each merchant
 * has their own WhatsApp number, so the number the message arrives on already
 * identifies the business. Dropping the business name shrinks the matrix from
 * 37x37 to 29x29 — a visibly chunkier, easier-to-scan code at the same print size.
 *
 * The bot parses "Table <n>" out of the first inbound message to bind the
 * thread to the table (see SERVER_CONTRACT.md).
 */
export function tableWhatsappLink(waNumber, tableNo) {
  const digits = String(waNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Table ${tableNo}`)}`;
}

/** Guest menu page for a table. */
export function tableMenuLink(slug, tableNo, base = "https://selly.codeforgeai.app") {
  if (!slug) return null;
  return `${base}/m/${slug}?t=${tableNo}`;
}

/** Guest Fun Zone page for a table. */
export function tableFunLink(slug, tableNo, base = "https://selly.codeforgeai.app") {
  if (!slug) return null;
  return `${base}/fun/${slug}?t=${tableNo}`;
}

const styles = StyleSheet.create({
  fallback: {
    alignItems     : "center",
    justifyContent : "center",
    backgroundColor: Colors.bgElevated,
    borderRadius   : 10,
    borderWidth    : 1,
    borderColor    : Colors.border,
    borderStyle    : "dashed",
    padding        : 12,
  },
  fallbackText: {
    color    : Colors.textMuted,
    fontSize : 11,
    textAlign: "center",
  },
});
