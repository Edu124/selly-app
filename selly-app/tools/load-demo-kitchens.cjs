// ── Load the Pune demo kitchens ──────────────────────────────────────────────
//
// Puts 30 invented cloud kitchens across six Pune localities into Supabase, so
// discovery has something to find. Source data: tools/demo-kitchens.json,
// converted from the dummy spreadsheet.
//
//   node tools/load-demo-kitchens.cjs          load or refresh them
//   node tools/load-demo-kitchens.cjs --clear  remove every one of them
//
// Needs SUPABASE_SERVICE_KEY, read from .env.local at the repo root the same way
// dev-server.js does. That key bypasses row-level security, which is the only
// way to write rows that belong to no signed-in user.
//
// ── THESE ARE NOT REAL ───────────────────────────────────────────────────────
// Each one gets a real auth user with a demo+<name>@selly.test address, and
// that user's id is the kitchen's business_id. Not decoration: placing an order
// writes a customer_contacts row whose business_id is a uuid referencing
// auth.users, so a kitchen with a made-up text id can be browsed and can never
// be ordered from. The demo has to survive an actual order.
//
// Those addresses are also how the demo kitchens are identified later, which is
// why cleanup can find every one of them without keeping a list. They
// sit in the same tables as the real kitchen because the point is to see the
// real discovery, ordering and menu code working at a realistic size — a
// separate demo table would prove nothing.
//
// Run --clear before showing the product to a paying kitchen owner, or their
// customers will be offered thirty businesses that do not exist.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..");

// Same .env.local convention as dev-server.js — the key never lives in the repo.
(function loadEnv() {
  const f = path.join(ROOT, ".env.local");
  if (!fs.existsSync(f)) return;
  for (let line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!(k in process.env)) process.env[k] = v;
  }
})();

const URL = process.env.SUPABASE_URL || "https://ekughxkikjzkimadyyuk.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY;

if (!KEY) {
  console.error("No SUPABASE_SERVICE_KEY. Put it in .env.local at the repo root.");
  process.exit(1);
}

const H = {
  apikey: KEY, Authorization: "Bearer " + KEY,
  "Content-Type": "application/json",
};

async function send(method, pathAndQuery, body, prefer) {
  const r = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: Object.assign({}, H, prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${pathAndQuery} → ${r.status} ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return []; }
}

// ── Where the localities are ────────────────────────────────────────────────
// Approximate centres, good to a few hundred metres — enough for "2.4 km away"
// to look right on a demo, and not pretending to be a survey. Each kitchen is
// nudged off the centre deterministically so a list does not show six kitchens
// at an identical distance, which is the tell that data is fake.
const AREA = {
  "Baner":       [18.5590, 73.7760],
  "Kothrud":     [18.5070, 73.8070],
  "Wakad":       [18.5980, 73.7620],
  "Viman Nagar": [18.5670, 73.9140],
  "Kharadi":     [18.5510, 73.9470],
  "Hadapsar":    [18.5090, 73.9260],
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const EMAIL = (s) => `demo+${slug(s)}@selly.test`;
const IS_DEMO = /^demo\+.*@selly\.test$/;
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex");

/** Deterministic small offset, so re-running does not move a kitchen. */
function jitter(seed, i) {
  const n = parseInt(hash(seed).slice(i * 4, i * 4 + 4), 16) / 0xffff; // 0..1
  return (n - 0.5) * 0.022;                                           // ±~1.2 km
}

const OPEN_ALL_DAY = { open: "09:00", close: "23:30" };

// ── The users behind the kitchens ───────────────────────────────────────────

async function auth(method, p, body) {
  const r = await fetch(`${URL}/auth/v1/${p}`, {
    method, headers: H, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: r.ok, status: r.status, json, text };
}

/** Every demo user currently in the project, keyed by email. */
async function demoUsers() {
  const found = {};
  for (let page = 1; page <= 20; page++) {
    const r = await auth("GET", `admin/users?page=${page}&per_page=200`);
    if (!r.ok) throw new Error("could not list users: " + r.text.slice(0, 200));
    const users = (r.json && r.json.users) || [];
    users.forEach((u) => { if (u.email && IS_DEMO.test(u.email)) found[u.email] = u.id; });
    if (users.length < 200) break;
  }
  return found;
}

async function main() {
  const clear = process.argv.includes("--clear");

  if (clear) {
    const users = await demoUsers();
    const ids = Object.values(users);
    if (!ids.length) { console.log("no demo kitchens found"); return; }

    const list = "(" + ids.join(",") + ")";
    const a = await send("DELETE", "catalog?business_id=in." + list, null, "return=representation");
    const b = await send("DELETE", "business_settings?business_id=in." + list, null, "return=representation");
    // Orders and contacts belonging to a demo kitchen go too, or the next
    // kitchen to be given that uuid would inherit somebody else's history.
    const o = await send("DELETE", "orders?business_id=in." + list, null, "return=representation");
    for (const id of ids) await auth("DELETE", "admin/users/" + id);

    console.log(`removed ${b.length} kitchens, ${a.length} dishes, ${o.length} orders, ${ids.length} users`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "demo-kitchens.json"), "utf8"));

  // One auth user per kitchen. Re-running reuses the ones already there, so ids
  // stay stable and a refresh does not orphan the orders placed against them.
  const existing = await demoUsers();
  const idOf = {};
  for (const k of data) {
    const email = EMAIL(k.name);
    if (existing[email]) { idOf[k.name] = existing[email]; continue; }
    const r = await auth("POST", "admin/users", { email, email_confirm: true });
    if (!r.ok || !r.json || !r.json.id) {
      throw new Error(`could not create ${email}: ${r.status} ${r.text.slice(0, 200)}`);
    }
    idOf[k.name] = r.json.id;
  }
  console.log(`${Object.keys(idOf).length} kitchen accounts ready`);

  const settings = [];
  const dishes   = [];

  data.forEach((k) => {
    const id = idOf[k.name];
    const seed = slug(k.name);            // stable across user recreation
    const centre = AREA[k.area] || AREA["Baner"];

    settings.push({
      business_id  : id,
      business_name: k.name,
      industry     : "cloudkitchen",
      city         : k.city,
      area         : k.area,
      cuisine      : k.cuisine,
      // A short code because it goes in a link somebody may read aloud.
      public_code  : hash(seed).slice(0, 8),
      listed       : true,
      lat          : +(centre[0] + jitter(seed, 0)).toFixed(6),
      lng          : +(centre[1] + jitter(seed, 1)).toFixed(6),
      delivery_radius_km: 5,
      // Varied, because a list where every kitchen charges the same reads as
      // seeded data. Deterministic from the name so it does not shuffle.
      delivery_charge: [0, 0, 20, 25, 30][parseInt(hash(seed).slice(8, 10), 16) % 5],
      free_above     : [299, 399, 499, 999][parseInt(hash(seed).slice(10, 12), 16) % 4],
      store_config: {
        acceptingOrders: true,
        deliveryRadiusKm: 5,
        defaultPrepMinutes: 30,
        closedMessage: "",
        schedule: {},
        hours: [0, 1, 2, 3, 4, 5, 6].map(() => OPEN_ALL_DAY),
      },
      updated_at: new Date().toISOString(),
    });

    k.items.forEach((it, i) => {
      dishes.push({
        id          : seed + "-" + String(i + 1).padStart(2, "0"),
        business_id : id,
        name        : it.name,
        price       : it.price,
        category    : it.category,
        description : "",
        in_stock    : true,
        sizes       : [],
        extra_fields: { diet: it.veg ? "Veg" : "Non-veg" },
        created_at  : new Date().toISOString(),
      });
    });
  });

  // Upsert on the primary key, so re-running refreshes rather than duplicating.
  await send("POST", "business_settings?on_conflict=business_id", settings,
             "resolution=merge-duplicates,return=minimal");
  console.log(`loaded ${settings.length} kitchens`);

  for (let i = 0; i < dishes.length; i += 100) {
    await send("POST", "catalog?on_conflict=id", dishes.slice(i, i + 100),
               "resolution=merge-duplicates,return=minimal");
  }
  console.log(`loaded ${dishes.length} dishes`);

  const areas = {};
  data.forEach((k) => { areas[k.area] = (areas[k.area] || 0) + 1; });
  console.log("\nby area:");
  Object.keys(areas).sort().forEach((a) => console.log(`  ${a.padEnd(14)} ${areas[a]}`));
  console.log("\nRemove them again with:  node tools/load-demo-kitchens.cjs --clear");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
