/**
 * Shared rules for the investor demo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS A RESERVED NUMBER BAND
 *
 * start_sms_session returns the EXISTING token when it already knows a mobile.
 * That is exactly right for a returning customer texting in, and exactly wrong
 * for an endpoint anybody on the internet can POST to: hand it a real
 * customer's number and it hands back their session token, which reads their
 * name and delivery address straight out of session_context.
 *
 * So the demo refuses to touch anything that could be a real person. Indian
 * mobile numbers begin 6, 7, 8 or 9. Demo numbers begin 55 — not a valid mobile
 * prefix anywhere in India, so the set of demo numbers and the set of real
 * customers are provably disjoint. Not "unlikely to collide". Cannot.
 *
 * The residual risk is that one demo session can read another demo session.
 * That is acceptable: nothing in them is real, and this endpoint exists to be
 * shown on a projector.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A demo mobile: 55 followed by eight digits. Never a real Indian number. */
export const DEMO_BAND = /^55\d{8}$/;

export function newDemoMobile() {
  let n = "55";
  for (let i = 0; i < 8; i++) n += Math.floor(Math.random() * 10);
  return n;
}

/**
 * Normalise and vet a caller-supplied number.
 * Returns null for anything outside the band — callers must treat that as fatal.
 */
export function demoMobile(v) {
  const m = String(v || "").replace(/\D/g, "").slice(-10);
  return DEMO_BAND.test(m) ? m : null;
}

/**
 * The demo can be switched off once the pitch is over, without a deploy that
 * removes the files. Anything other than "off" leaves it on.
 */
export function demoIsOff() {
  return String(process.env.DEMO_MODE || "").toLowerCase() === "off";
}
