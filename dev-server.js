/**
 * Local Selly, with the API attached.
 *
 *     node dev-server.js
 *
 * `npx serve` hands out the built pages perfectly well, but it knows nothing
 * about /api, so the demo phone has nothing to text. This serves both: the
 * static export from selly-app/dist, and the same handler files Vercel runs,
 * behind a request/response shim thin enough that the handlers cannot tell the
 * difference.
 *
 * ── THE ONE THING YOU HAVE TO PROVIDE ────────────────────────────────────────
 *
 * Minting a session needs the Supabase service key, which bypasses every
 * security rule in the database. It is not in this repo and must never be:
 * pass it in the environment, from your own shell.
 *
 *     PowerShell   $env:SUPABASE_SERVICE_KEY="eyJ..."; node dev-server.js
 *     bash         SUPABASE_SERVICE_KEY=eyJ... node dev-server.js
 *
 * Without it the pages all work and the demo phone reports that the messaging
 * service is unavailable, which is the truth.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, "selly-app", "dist");
const API  = path.join(HERE, "api");
const PORT = Number(process.env.PORT || 4300);

// Sensible local defaults so only the secret has to be supplied by hand.
process.env.SUPABASE_URL     ||= "https://ekughxkikjzkimadyyuk.supabase.co";
process.env.PUBLIC_BASE_URL  ||= `http://localhost:${PORT}`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js"  : "text/javascript; charset=utf-8",
  ".css" : "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg" : "image/svg+xml",
  ".png" : "image/png",
  ".jpg" : "image/jpeg",
  ".ico" : "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf" : "font/ttf",
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
    });
  });
}

/** Just enough of Vercel's res for the handlers to work unmodified. */
function shimResponse(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (s) => { res.end(String(s)); return res; };
  return res;
}

async function handleApi(req, res, url) {
  const name = url.pathname.replace(/^\/api\//, "").replace(/[^a-zA-Z0-9_-]/g, "");
  const file = path.join(API, `${name}.js`);

  // Underscore files are shared helpers, not endpoints — same rule Vercel uses.
  if (name.startsWith("_") || !fs.existsSync(file)) {
    return shimResponse(res).status(404).json({ error: `No API route /api/${name}` });
  }

  try {
    // Cache-busted so an edit to a handler shows up without a restart.
    const mod = await import(`${pathToFileURL(file).href}?v=${Date.now()}`);
    req.query = Object.fromEntries(url.searchParams);
    req.body  = await readBody(req);
    await mod.default(req, shimResponse(res));
  } catch (e) {
    console.error(`[api/${name}]`, e);
    if (!res.headersSent) shimResponse(res).status(500).json({ error: e.message });
  }
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/" || rel.endsWith("/")) rel += "index.html";

  const file = path.join(DIST, rel);
  // Nothing outside dist, whatever the path claims to be.
  if (!file.startsWith(DIST)) { res.statusCode = 403; return res.end("no"); }

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // The app is a single-page export; unknown paths belong to its router.
    const spa = path.join(DIST, "index.html");
    res.setHeader("Content-Type", TYPES[".html"]);
    return res.end(fs.readFileSync(spa));
  }

  res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  res.end(fs.readFileSync(file));
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
    serveStatic(req, res, url);
  })
  .listen(PORT, () => {
    const keyed = !!process.env.SUPABASE_SERVICE_KEY;
    console.log(`\n  Selly running at http://localhost:${PORT}\n`);
    console.log(`    demo phone   http://localhost:${PORT}/demo.html`);
    console.log(`    order page   http://localhost:${PORT}/find.html`);
    console.log(`    kitchen app  http://localhost:${PORT}/\n`);
    console.log(keyed
      ? "  Service key found — the demo phone can text.\n"
      : "  No SUPABASE_SERVICE_KEY set. Pages work; the demo phone cannot text.\n");
  });
