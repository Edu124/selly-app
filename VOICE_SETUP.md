# Selly's voice

Selly speaks its replies — in the voice-note chat and on the voice ordering
page — in **English or Hindi**. Pick the language and voice in the demo's
presenter panel under **Selly's voice**. The choice is remembered on that
browser and shared by both pages.

## Where the voice comes from

| Source | Sounds | Setup |
|---|---|---|
| **Cloud voice** (Azure or Google) | Human, studio quality, identical on every phone | A key in `.env.local` / Vercel |
| **Microsoft Edge's built-in "Natural" voices** | Very close to human | None — open the demo in Edge |
| Other browsers' built-in voices | Robotic | None |

With nothing configured, Selly uses the best voice the browser has. If a cloud
voice ever fails, it falls back to that instead of going silent.

**Fastest way to hear a natural voice today:** open
`http://localhost:4300/demo.html` in **Microsoft Edge** and choose a voice
marked *Natural* (Swara for Hindi, Neerja for English).

**For real customers**, use a cloud voice. A customer's cheap phone has only
the robotic voice; the cloud voice sounds the same everywhere.

## Cloud voice — Azure (recommended to start)

Azure's free tier covers about 500,000 characters of speech a month, which is
thousands of conversations.

1. Create a **Speech** resource in the Azure portal. Choose the *Free F0* tier
   and region **Central India**.
2. Copy **Key 1** from the resource's *Keys and Endpoint* page.
3. Add to `.env.local` at the repo root (and to Vercel's environment variables):

   ```
   TTS_PROVIDER=azure
   TTS_KEY=<key 1>
   TTS_REGION=centralindia
   ```

4. Restart `node dev-server.js`. The picker will show **Swara**, **Madhur**
   (Hindi) and **Neerja**, **Prabhat** (English) under *Natural*.

## Cloud voice — Google

1. In Google Cloud, enable the **Text-to-Speech API** (billing must be on; the
   first million characters of Neural2 voices a month are free).
2. Create an **API key** restricted to the Text-to-Speech API.
3. Add:

   ```
   TTS_PROVIDER=google
   TTS_KEY=<api key>
   ```

## Worth evaluating later

**Sarvam AI (Bulbul)** is built in India for Indian languages and handles
Hinglish and ten regional languages. Not wired in yet; `api/tts.js` is the one
file to extend.

## Notes

- The key stays on the server. `/api/tts` caps text at 500 characters and
  caches repeated phrases.
- Hindi **understanding** runs on the browser's speech recognition set to
  Hindi. Common dish names said in Hindi — डोसा, इडली, बिरयानी — are matched to
  the English names on the menus.
