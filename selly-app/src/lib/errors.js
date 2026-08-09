// ── Friendly error messages ───────────────────────────────────────────────────
// Turns raw technical errors ("Failed to fetch", "Network request failed",
// axios timeouts, Supabase session errors) into something a shop owner can
// actually act on. Use this anywhere an error is shown to the user.
//
//   import { friendlyError } from "../lib/errors";
//   catch (e) { Alert.alert("Error", friendlyError(e)); }
// ─────────────────────────────────────────────────────────────────────────────

const NETWORK_PATTERNS = [
  "failed to fetch",
  "network request failed",
  "network error",
  "err_network",
  "err_internet_disconnected",
  "fetch failed",
  "load failed",
];

const TIMEOUT_PATTERNS = ["timeout", "econnaborted", "etimedout"];

const SESSION_PATTERNS = [
  "session not ready",
  "not logged in",
  "jwt expired",
  "invalid claim",
  "no api key",
];

export function friendlyError(err, fallback = "Something went wrong. Please try again.") {
  const raw = (
    err?.response?.data?.error ||
    err?.response?.data?.msg ||
    err?.message ||
    (typeof err === "string" ? err : "")
  ).toString();

  const low = raw.toLowerCase();

  // No internet / server unreachable
  if (NETWORK_PATTERNS.some(p => low.includes(p))) {
    return "Can't reach our servers. Please check your internet connection and try again.";
  }

  // Slow server (Railway cold start can take ~45s)
  if (TIMEOUT_PATTERNS.some(p => low.includes(p))) {
    return "The server is taking longer than usual. Please try again in a moment.";
  }

  // Session expired / not signed in
  if (SESSION_PATTERNS.some(p => low.includes(p))) {
    return "Your session has expired. Please sign in again.";
  }

  // Server-side 5xx
  const status = err?.response?.status;
  if (status >= 500) {
    return "Our server ran into a problem. Please try again in a minute.";
  }
  if (status === 404) {
    return "That wasn't found. It may have been removed.";
  }

  // Supabase auth messages are already written for end users — pass them through
  if (raw && raw.length < 160 && !low.startsWith("typeerror") && !low.startsWith("[object")) {
    return raw;
  }

  return fallback;
}

// Short variant for inline/banner spots where space is tight
export function friendlyErrorShort(err) {
  const msg = friendlyError(err);
  return msg.length > 70 ? msg.split(".")[0] + "." : msg;
}
