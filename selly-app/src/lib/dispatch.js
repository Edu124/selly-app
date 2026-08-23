// ── Which drop first ──────────────────────────────────────────────────────────
//
// A rider leaves the kitchen holding two packets and has to pick one. Getting it
// wrong costs one customer a cold dinner, and they do not complain — they just
// stop ordering.
//
// WHAT THIS ACTUALLY IS, PLAINLY
//
// It is a scoring heuristic, not a routing engine and not a model. Saying
// otherwise would be a claim the code cannot support, and the difference matters
// the first time a kitchen asks why it chose what it chose.
//
// It ranks on two things it can actually know:
//
//   TIME PRESSURE   how close each order is to being late, from its promised or
//                   scheduled time. This is real data and it is the input that
//                   should dominate — a drop that is already overdue outranks a
//                   drop that is merely nearer.
//
//   AREA            whether two addresses name the same locality. Indian
//                   addresses almost always end with one ("… near D-Mart,
//                   Baner"), so matching it groups drops that are probably close
//                   without geocoding anything. Crude, free, and right often
//                   enough to beat picking at random.
//
// WHAT WOULD MAKE IT GENUINELY SMART, AND WHY IT IS NOT HERE
//
// Real distance and real drive time need coordinates, which needs a geocoding
// API and a paid key. Every order we hold is a line of text. So `haversine` and
// the whole distance branch sit here ready and unused: the moment orders carry
// lat/lng, `sequenceDrops` starts using them with no other change. Until then it
// is honest about ranking on time, not distance.
// ─────────────────────────────────────────────────────────────────────────────

const MIN = 60 * 1000;

/** Minutes a drop is expected to take once the rider is moving. */
export const DEFAULT_DROP_MINUTES = 12;

/**
 * Minutes as a rider would say them.
 *
 * "848 min late" is arithmetically true and useless — nobody reads it as
 * fourteen hours, and a number that large just looks like a bug.
 */
export function lateness(mins) {
  const m = Math.abs(Math.round(mins));
  if (m < 90) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr`;
  return `${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"}`;
}

// ── Time pressure ────────────────────────────────────────────────────────────

/**
 * When this order was promised to the customer.
 *
 * A scheduled order has an explicit time and that always wins. Everything else
 * gets prep time plus a delivery allowance from when it was placed, which is
 * what the customer was actually told.
 */
export function promisedAt(order, { prepMinutes = 25, deliveryMinutes = 20 } = {}) {
  if (!order) return null;
  const scheduled = order.scheduled_for || order.scheduledFor;
  if (scheduled) return new Date(scheduled);

  const placed = Number(order.createdAt) || Date.parse(order.created_at) || Date.now();
  return new Date(placed + (prepMinutes + deliveryMinutes) * MIN);
}

/** Negative means already late. */
export function minutesOfSlack(order, opts = {}, now = new Date()) {
  const due = promisedAt(order, opts);
  if (!due) return 999;
  return Math.round((due.getTime() - now.getTime()) / MIN);
}

// ── Area matching ────────────────────────────────────────────────────────────

// Words that appear in every address and therefore distinguish nothing.
const NOISE = new Set([
  "flat", "no", "near", "opp", "opposite", "behind", "road", "rd", "lane",
  "society", "apartment", "apartments", "building", "wing", "floor", "block",
  "sector", "phase", "plot", "house", "villa", "tower", "residency", "park",
  "cross", "main", "st", "street", "nagar",
]);

// A component opening with one of these is a landmark, not a locality.
// "…, Baner Road, near D-Mart" ends in a supermarket; the area is Baner, and
// taking the last component literally would put two Baner drops in different
// buckets purely because they cited different shops.
const LANDMARK_LEAD = /^(near|opp|opposite|behind|beside|next to|above|below|in front of)\b/;

/**
 * The locality, guessed from the tail of the address.
 *
 * Indian addresses run specific-to-general, so the last meaningful component is
 * usually the area. Not clever, but it is right far more often than it is wrong,
 * and being wrong only costs the ordering of two drops.
 */
export function areaOf(address) {
  const parts = String(address || "")
    .split(",")
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return "";

  for (let i = parts.length - 1; i >= 0; i--) {
    if (LANDMARK_LEAD.test(parts[i])) continue;
    const words = parts[i].split(/\s+/).filter(w => w.length > 2 && !NOISE.has(w) && !/^\d+$/.test(w));
    if (words.length) return words.join(" ");
  }
  return parts[parts.length - 1];
}

export function sameArea(a, b) {
  const x = areaOf(a), y = areaOf(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

// ── Distance, for when coordinates exist ─────────────────────────────────────

export function haversineKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

const coordsOf = (o) =>
  (o && o.lat != null && o.lng != null) ? { lat: Number(o.lat), lng: Number(o.lng) } : null;

// ── The sequence ─────────────────────────────────────────────────────────────

/**
 * Order the drops a rider is carrying, with a reason for each.
 *
 * Greedy nearest-in-time rather than a full optimisation: a rider holding two or
 * three packets does not need an optimal tour, they need an answer before the
 * food cools. The reason strings matter as much as the order — a rider who is
 * told "already 6 min late" will follow it, one handed a bare list will not.
 */
export function sequenceDrops(orders, opts = {}) {
  const { prepMinutes = 25, deliveryMinutes = 20, dropMinutes = DEFAULT_DROP_MINUTES,
          kitchen = null, now = new Date() } = opts;

  const pool = (orders || []).filter(Boolean).map(o => ({
    order: o,
    slack: minutesOfSlack(o, { prepMinutes, deliveryMinutes }, now),
    area : areaOf(o.address),
    coord: coordsOf(o),
  }));

  if (pool.length <= 1) {
    return pool.map((p, i) => ({
      ...p, seq: i + 1, reason: "Only drop in hand.", etaMinutes: dropMinutes,
    }));
  }

  const out  = [];
  let   from = kitchen ? coordsOf(kitchen) : null;
  let   prev = null;
  let   clock = 0;

  while (pool.length) {
    let best = 0, bestScore = -Infinity, bestWhy = "";

    pool.forEach((p, i) => {
      // Slack after allowing for the drops already queued ahead of this one.
      const slackThen = p.slack - clock;

      // Lateness dominates. The curve is deliberately steep below zero so an
      // overdue drop is never traded away for a convenient one.
      let score = slackThen < 0 ? 1000 + (-slackThen) * 10
                                : Math.max(0, 200 - slackThen * 3);
      let why   = slackThen < 0 ? `already ${lateness(-slackThen)} late`
                                : `due in ${lateness(slackThen)}`;

      // Nearby-and-not-urgent is worth a nudge, never an override.
      const km = from && p.coord ? haversineKm(from, p.coord) : null;
      if (km != null) {
        score += Math.max(0, 40 - km * 8);
        why += ` · ${km} km away`;
      } else if (prev && sameArea(prev.order.address, p.order.address)) {
        score += 30;
        why += " · same area as the last drop";
      }

      if (score > bestScore) { bestScore = score; best = i; bestWhy = why; }
    });

    const picked = pool.splice(best, 1)[0];
    clock += dropMinutes;

    out.push({
      ...picked,
      seq       : out.length + 1,
      reason    : bestWhy,
      etaMinutes: clock,
      late      : picked.slack < 0,
    });

    prev = picked;
    from = picked.coord || from;
  }

  return out;
}

/** One line the rider can act on without reading the whole list. */
export function headline(sequence) {
  if (!sequence || !sequence.length) return "Nothing to deliver.";
  const late = sequence.filter(s => s.late).length;
  const first = sequence[0];
  if (late > 1) return `${late} drops are already late — start with #${first.order.token || first.seq}.`;
  if (late === 1) return `#${first.order.token || first.seq} is already late. Go there first.`;
  return `Start with #${first.order.token || first.seq} — ${first.reason}.`;
}

/** Google Maps directions for an address, which is all a rider wants. */
export function mapsLink(address) {
  if (!address) return null;
  return "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(address);
}

/** Multi-stop directions in the sequence this module chose. */
export function routeLink(sequence) {
  const stops = (sequence || []).map(s => s.order.address).filter(Boolean);
  if (!stops.length) return null;
  const dest = encodeURIComponent(stops[stops.length - 1]);
  const way  = stops.slice(0, -1).map(encodeURIComponent).join("%7C");
  return "https://www.google.com/maps/dir/?api=1&destination=" + dest +
         (way ? "&waypoints=" + way : "");
}
