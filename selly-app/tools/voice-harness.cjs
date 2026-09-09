// ── A fake microphone, for testing the voice ordering by hand ────────────────
//
// The voice assistant broke once in a way no unit test would have caught: the
// browser ends a speech session constantly, and the first version treated every
// ending as "stop", so it went deaf after one sentence. That is only visible by
// driving a real conversation.
//
// This writes dist/_voicetest.html — a copy of the ordering page with a stub
// SpeechRecognition in front of it, so the conversation can be driven from the
// console without saying anything out loud.
//
//   node tools/voice-harness.cjs
//   open  http://localhost:4300/_voicetest.html?k=<kitchen code>
//
//   __hear("two thali")     pretend the customer said that
//   __hear("yes")           agree to what was read back
//   __said                  everything the assistant tried to say
//
// Not shipped: the file is written into dist, which is rebuilt from scratch.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const src  = path.join(dist, "order.html");
const out  = path.join(dist, "_voicetest.html");

if (!fs.existsSync(src)) {
  console.error("No dist/order.html — run `npx expo export --platform web` first.");
  process.exit(1);
}

const MOCK = `<script>
/* test harness only */
window.__said = [];
window.SpeechRecognition = function () {
  var self = this;
  window.__rec = self;
  this.start = function () { window.__rec = self; setTimeout(function(){ self.onstart && self.onstart(); }, 5); };
  this.stop  = function () { setTimeout(function(){ self.onend && self.onend(); }, 5); };
  this.abort = function () { };
};
window.__hear = function (text) {
  var r = window.__rec;
  if (!r || !r.onresult) return "no live recogniser — is it listening?";
  var res = [[{ transcript: text }]]; res[0].isFinal = true;
  r.onresult({ results: res });
  return "heard: " + text;
};
/* speechSynthesis is a read-only accessor on window and cannot be replaced, so
   the real one is used. It stays silent in a headless pane, and the assistant's
   own onend timeout carries the conversation forward regardless — which is
   itself worth having under test. */
</script>
`;

const html = fs.readFileSync(src, "utf8");
// Tolerant of CRLF and of whitespace changes — this only has to find the page's
// own inline script, and being brittle about newlines would make it fail for a
// reason that has nothing to do with what it tests.
const m = /<script>\s*\(function\s*\(\)\s*\{/.exec(html);
if (!m) { console.error("Could not find the page script to inject before."); process.exit(1); }
const at = m.index;

fs.writeFileSync(out, html.slice(0, at) + MOCK + html.slice(at));
console.log("wrote " + path.relative(process.cwd(), out));
