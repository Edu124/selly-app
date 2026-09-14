/**
 * /api/tts — a human-sounding voice for Selly's replies.
 *
 *   GET   → { configured, provider, voices: [{ id, label, lang }] }
 *   POST  { text, voice, lang } → audio/mpeg
 *
 * Browser speech engines range from good (Edge's "Natural" voices) to flat, and
 * a customer on a cheap phone gets the flat one. Rendering the voice here means
 * every customer hears the same natural voice, in English or Hindi.
 *
 * ── SETUP (.env.local, or Vercel environment variables) ────────────────────
 *   TTS_PROVIDER   azure | google
 *   TTS_KEY        the provider's key
 *   TTS_REGION     azure only, e.g. centralindia
 *
 * Without them this answers GET with configured:false and the pages fall back
 * to the browser's own voices, so nothing breaks — it just sounds worse.
 *
 * The key never reaches a browser. Text is capped at 500 characters so the
 * endpoint cannot be used to synthesise audiobooks on our bill, and rendered
 * phrases are cached, because the assistant says the same sentences often.
 * ────────────────────────────────────────────────────────────────────────── */

const PROVIDER = String(process.env.TTS_PROVIDER || "").toLowerCase();
const KEY      = process.env.TTS_KEY;
const REGION   = process.env.TTS_REGION || "centralindia";

// Neural voices with Indian accents. One female and one male per language
// keeps the picker short enough to actually choose from.
const VOICES = {
  azure: [
    { id: "hi-IN-SwaraNeural",   label: "Swara (female)",   lang: "hi-IN" },
    { id: "hi-IN-MadhurNeural",  label: "Madhur (male)",    lang: "hi-IN" },
    { id: "en-IN-NeerjaNeural",  label: "Neerja (female)",  lang: "en-IN" },
    { id: "en-IN-PrabhatNeural", label: "Prabhat (male)",   lang: "en-IN" },
  ],
  google: [
    { id: "hi-IN-Neural2-A", label: "Hindi A (female)",   lang: "hi-IN" },
    { id: "hi-IN-Neural2-B", label: "Hindi B (male)",     lang: "hi-IN" },
    { id: "en-IN-Neural2-A", label: "English A (female)", lang: "en-IN" },
    { id: "en-IN-Neural2-B", label: "English B (male)",   lang: "en-IN" },
  ],
};

const cache = new Map();

const xml = (s) => s.replace(/[<>&'"]/g, (c) =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

async function azure(text, v) {
  const r = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "selly",
    },
    body: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.lang}">` +
          `<voice name="${v.id}">${xml(text)}</voice></speak>`,
  });
  if (!r.ok) throw new Error(`azure ${r.status} ${(await r.text()).slice(0, 160)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function google(text, v) {
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: v.lang, name: v.id },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || !d.audioContent) {
    throw new Error(`google ${r.status} ${JSON.stringify(d || {}).slice(0, 160)}`);
  }
  return Buffer.from(d.audioContent, "base64");
}

export default async function handler(req, res) {
  const list = VOICES[PROVIDER] || [];
  const configured = !!(KEY && list.length);

  if (req.method === "GET") {
    return res.status(200).json({
      configured,
      provider: configured ? PROVIDER : null,
      voices: configured ? list : [],
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "GET or POST" });
  if (!configured) return res.status(501).json({ error: "TTS_NOT_CONFIGURED" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { body = {}; } }
  body = body || {};

  const text = String(body.text || "").trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "no text" });
  const v = list.find((x) => x.id === body.voice) || list.find((x) => x.lang === body.lang) || list[0];

  const key = v.id + "|" + text;
  try {
    let audio = cache.get(key);
    if (!audio) {
      audio = PROVIDER === "azure" ? await azure(text, v) : await google(text, v);
      cache.set(key, audio);
      if (cache.size > 300) cache.delete(cache.keys().next().value);
    }
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.statusCode = 200;
    return res.end(audio);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
