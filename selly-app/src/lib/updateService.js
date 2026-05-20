// ── Selly Update Service ───────────────────────────────────────────────────────
// Layer 1: Expo OTA update check (JS-only changes, silent background download)
// Layer 2: Force-update gate  (native/APK changes, blocking modal)
// ─────────────────────────────────────────────────────────────────────────────

import * as Updates from "expo-updates";

const VERSION_CHECK_URL =
  "https://instagram-bot-production-b993.up.railway.app/api/app/version";

// Current APK version — keep in sync with app.json "version" field.
// Update this string every time you cut a new APK build.
export const CURRENT_VERSION = "1.0.0";

// ── Semver integer comparison ─────────────────────────────────────────────────
// "1.2.3" → 10203  |  "2.0.0" → 20000  — no external library needed
function semverToInt(versionString) {
  if (!versionString || typeof versionString !== "string") return 0;
  const parts = versionString.trim().split(".").map(Number);
  const [major = 0, minor = 0, patch = 0] = parts;
  return major * 10000 + minor * 100 + patch;
}

// ── Layer 1: OTA JS bundle update ─────────────────────────────────────────────
// Returns: { updated: boolean, error: string|null }
// If updated === true, caller should call Updates.reloadAsync() to apply it.
export async function checkOTAUpdate() {
  // expo-updates is disabled in Expo Go / expo start (dev mode)
  if (!Updates.isEnabled) {
    console.log("[OTA] expo-updates not enabled (dev mode) — skipping");
    return { updated: false, error: null };
  }

  try {
    const result = await Updates.checkForUpdateAsync();

    if (!result.isAvailable) {
      console.log("[OTA] No update available");
      return { updated: false, error: null };
    }

    console.log("[OTA] Update available — fetching…");
    await Updates.fetchUpdateAsync();
    console.log("[OTA] Bundle downloaded — ready to reload");
    return { updated: true, error: null };
  } catch (err) {
    // Network error, EAS CDN down, etc. — always fail-open
    console.warn("[OTA] Check failed:", err.message);
    return { updated: false, error: err.message };
  }
}

// ── Layer 2: Force-update version gate ────────────────────────────────────────
// Returns:
//   { required: false }                                        — app is current
//   { required: true, apkUrl, releaseNotes, latestVersion }   — must update APK
//   { required: false, error: string }                        — check failed (fail-open)
export async function checkForceUpdate() {
  try {
    // Hard 10s timeout — Railway cold start can take 45s, we must not block the
    // splash screen for that long. Fail-open if server doesn't respond in time.
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(VERSION_CHECK_URL, {
      method : "GET",
      headers: { "Content-Type": "application/json" },
      signal : controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("[ForceUpdate] Server returned", response.status, "— skipping gate");
      return { required: false };
    }

    const data = await response.json();
    const { min_version, apk_url, release_notes, latest_version } = data;

    if (!min_version) {
      // Endpoint exists but Railway env vars not configured yet — skip
      return { required: false };
    }

    const currentInt = semverToInt(CURRENT_VERSION);
    const minInt     = semverToInt(min_version);

    if (currentInt < minInt) {
      console.log(
        `[ForceUpdate] ${CURRENT_VERSION} (${currentInt}) < min ${min_version} (${minInt}) — update required`
      );
      return {
        required      : true,
        apkUrl        : apk_url        || "",
        releaseNotes  : release_notes  || "A critical update is required to continue using Selly.",
        latestVersion : latest_version || min_version,
      };
    }

    console.log("[ForceUpdate] App is up to date");
    return { required: false };
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("[ForceUpdate] Request timed out (10s) — skipping gate");
    } else {
      console.warn("[ForceUpdate] Check failed:", err.message);
    }
    // Never block the user because of a network failure
    return { required: false };
  }
}
