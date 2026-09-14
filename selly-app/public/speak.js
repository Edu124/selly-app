/* ── Selly's voice ────────────────────────────────────────────────────────────
 *
 * One place that decides how Selly sounds and which language it speaks, shared
 * by the chat and the ordering page so the two never disagree.
 *
 * WHERE THE VOICE COMES FROM, BEST FIRST
 *   cloud    A neural voice rendered on our server (/api/tts) — Azure or
 *            Google. Sounds human, and sounds the same on every phone.
 *            Needs a key in the server's environment.
 *   natural  The browser's own neural voices. Microsoft Edge ships them free
 *            ("Swara Online (Natural)" for Hindi). Good, but only in Edge.
 *   device   Whatever else the operating system has. Works everywhere, sounds
 *            like a machine.
 *
 * If a cloud voice fails for any reason, the reply is still spoken with the
 * best device voice. A customer should never get silence.
 *
 * LANGUAGE HELPERS
 *   Hindi speech recognition returns Devanagari — "मुझे डोसा चाहिए" — while the
 *   menus are written in Latin script. toLatin() maps common dish words across
 *   so "डोसा" finds "Masala Dosa".
 * ─────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var KEY = "selly_voice_v1";
  var DEFAULTS = { lang: "en-IN", voice: "" };
  var listeners = [];

  function get() {
    var v = {};
    try { v = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
    return { lang: v.lang === "hi-IN" ? "hi-IN" : "en-IN", voice: v.voice || "" };
  }

  function set(patch) {
    var cur = get();
    if (patch.lang && patch.lang !== cur.lang && patch.voice == null) cur.voice = "";  // a voice belongs to a language
    Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
    listeners.forEach(function (fn) { try { fn(cur); } catch (e) {} });
    return cur;
  }

  function onChange(fn) { listeners.push(fn); }
  // The chat and the ordering page run in different frames; keep them in step.
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) listeners.forEach(function (fn) { try { fn(get()); } catch (x) {} });
  });

  // ── the server's voices, if it has any ────────────────────────────────────
  var info = null;
  function serverInfo() {
    if (!info) {
      info = fetch("/api/tts")
        .then(function (r) { return r.ok ? r.json() : { configured: false, voices: [] }; })
        .catch(function () { return { configured: false, voices: [] }; });
    }
    return info;
  }

  // ── the browser's voices ──────────────────────────────────────────────────
  function deviceVoices() {
    var S = window.speechSynthesis;
    if (!S) return Promise.resolve([]);
    return new Promise(function (res) {
      var v = S.getVoices();
      if (v.length) return res(v);
      var done = false, fin = function () { if (!done) { done = true; res(S.getVoices()); } };
      S.addEventListener ? S.addEventListener("voiceschanged", fin, { once: true }) : (S.onvoiceschanged = fin);
      setTimeout(fin, 1500);
    });
  }
  var langOf = function (v) { return String(v.lang || "").replace("_", "-"); };
  var isNatural = function (v) { return /natural|neural|online/i.test(v.name); };
  function rank(v) { return isNatural(v) ? 0 : /google/i.test(v.name) ? 1 : 2; }
  function niceName(v) {
    return v.name.replace(/^Microsoft\s+/, "").replace(/\s+Online.*$/, "").replace(/\s+-\s+.*$/, "") +
           (isNatural(v) ? " · Natural" : "");
  }

  /** Every voice that can speak this language, best first, grouped by source. */
  function voices(lang) {
    var two = lang.slice(0, 2);
    return Promise.all([serverInfo(), deviceVoices()]).then(function (r) {
      var out = [];
      (r[0].voices || []).filter(function (x) { return x.lang === lang; }).forEach(function (x) {
        out.push({ id: "cloud:" + x.id, label: x.label, group: "Natural — " + r[0].provider });
      });
      r[1].filter(function (v) { return langOf(v).toLowerCase().indexOf(two) === 0; })
        .sort(function (a, b) {
          return rank(a) - rank(b) || (langOf(a) === lang ? -1 : 0) - (langOf(b) === lang ? -1 : 0);
        })
        .forEach(function (v) {
          out.push({ id: "device:" + v.name, label: niceName(v),
                     group: isNatural(v) ? "Natural — this browser" : "This device" });
        });
      return out;
    });
  }

  // ── speaking ──────────────────────────────────────────────────────────────
  var playing = null;
  function stop() {
    if (playing) { try { playing.pause(); } catch (e) {} playing = null; }
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  }

  function clean(text, lang) {
    return String(text || "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/₹\s?(\d[\d,]*)/g, lang === "hi-IN" ? "$1 रुपये" : "$1 rupees")
      .trim();
  }

  function onDevice(text, lang, name) {
    return new Promise(function (res) {
      var S = window.speechSynthesis;
      if (!S || !text) return res();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = lang === "hi-IN" ? 0.95 : 1;
      var all = S.getVoices();
      var v = name ? all.filter(function (x) { return x.name === name; })[0] : null;
      if (!v) v = all.filter(function (x) { return langOf(x) === lang; }).sort(function (a, b) { return rank(a) - rank(b); })[0];
      if (v) u.voice = v;
      var done = false, fin = function () { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, Math.min(2000 + text.length * 95, 16000));   // a silent engine must not stall the conversation
      try { S.speak(u); } catch (e) { fin(); }
    });
  }

  function inCloud(text, lang, id) {
    return fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, voice: id, lang: lang }),
    }).then(function (r) {
      if (!r.ok) throw new Error("tts " + r.status);
      return r.blob();
    }).then(function (blob) {
      return new Promise(function (res) {
        var a = new Audio(URL.createObjectURL(blob));
        playing = a;
        var done = false, fin = function () { if (!done) { done = true; res(); } };
        a.onended = fin; a.onerror = fin;
        a.play().catch(fin);
      });
    });
  }

  /** Say something. Resolves when it has finished, or given up. */
  function speak(text, opts) {
    opts = opts || {};
    stop();
    var s = get();
    var lang = opts.lang || s.lang;
    var said = clean(text, lang);
    if (!said) return Promise.resolve();

    var pick = s.voice
      ? Promise.resolve(s.voice)
      : serverInfo().then(function (i) {       // nothing chosen: the best there is
          var c = (i.voices || []).filter(function (x) { return x.lang === lang; })[0];
          return c ? "cloud:" + c.id : "";
        });

    return pick.then(function (id) {
      if (id.indexOf("cloud:") === 0) {
        return inCloud(said, lang, id.slice(6)).catch(function () { return onDevice(said, lang, ""); });
      }
      return onDevice(said, lang, id.indexOf("device:") === 0 ? id.slice(7) : "");
    });
  }

  // ── language ──────────────────────────────────────────────────────────────
  var DISH = {
    "डोसा": "dosa", "दोसा": "dosa", "डोसे": "dosa", "इडली": "idli", "इडलीयाँ": "idli", "वडा": "vada", "वड़ा": "vada",
    "उत्तपम": "uttapam", "उत्तपा": "uttapam", "पनीर": "paneer", "बिरयानी": "biryani", "थाली": "thali",
    "दाल": "dal", "रोटी": "roti", "नान": "naan", "पराठा": "paratha", "परांठा": "paratha", "समोसा": "samosa",
    "पोहा": "poha", "खीर": "kheer", "हलवा": "halwa", "गुलाब": "gulab", "जामुन": "jamun", "छोले": "chole",
    "भटूरे": "bhature", "राजमा": "rajma", "चावल": "rice", "राइस": "rice", "पुलाव": "pulao", "खिचड़ी": "khichdi",
    "मसाला": "masala", "कोफ्ता": "kofta", "मलाई": "malai", "पायसम": "payasam", "रसमलाई": "rasmalai",
    "जीरा": "jeera", "आलू": "aloo", "पाव": "pav", "भाजी": "bhaji", "मिसल": "misal", "पूरी": "puri",
    "भेल": "bhel", "लस्सी": "lassi", "नूडल्स": "noodle", "मंचूरियन": "manchurian", "टिक्का": "tikka",
    "कबाब": "kabab", "चिकन": "chicken", "मटन": "mutton", "अंडा": "egg", "सांभर": "sambar", "सांबर": "sambar",
    "कढ़ी": "kadhi", "पकोड़ा": "pakora", "पकोड़े": "pakora", "कचौरी": "kachori", "ढोकला": "dhokla",
  };
  function tokens(text) {
    // keeps Devanagari letters, drops the danda "।" and other punctuation
    return String(text || "").toLowerCase()
      .replace(/[^a-z0-9ऀ-ॣ०-ॿ\s]/g, " ")
      .split(/\s+/).filter(Boolean);
  }
  function toLatin(w) { return DISH[w] || w; }
  function T(en, hi) { return get().lang === "hi-IN" ? hi : en; }

  window.SellyVoice = {
    get: get, set: set, onChange: onChange, serverInfo: serverInfo,
    voices: voices, speak: speak, stop: stop,
    tokens: tokens, toLatin: toLatin, T: T,
  };
})();
