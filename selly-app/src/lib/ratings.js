// ── Ratings ───────────────────────────────────────────────────────────────────
//
// One tap on a face, then a few words to say why. Nothing typed unless they
// want to.
//
// WHY KEYWORDS DEPEND ON THE FACE THEY PICKED
//
// A fixed keyword list makes people answer the wrong question. Offer "great
// taste" to someone who just got a cold, late order and they either ignore the
// chips entirely or tap something inaccurate to get out of the screen. The words
// have to already agree with the face — then tapping is easier than typing, and
// what you get back is usable.
//
// So the chips are per rating, and they are written as things a person would
// actually say: "arrived cold", not "temperature dissatisfaction".
//
// WHY A LOW RATING IS NOT JUST A NUMBER
//
// One and two stars are a complaint whether or not anyone files one. Burying
// that in an average loses the one customer who was about to stop ordering, so
// the flow offers to raise it as a complaint there and then — and the kitchen
// sees it in the same place as every other complaint.
// ─────────────────────────────────────────────────────────────────────────────

export const RATINGS = [
  {
    score: 5,
    emoji: "😍",
    label: "Loved it",
    tone : "great",
    keywords: [
      "Great taste", "Fresh", "Hot on arrival", "Good quantity",
      "Well packed", "On time", "Worth the price",
    ],
  },
  {
    score: 4,
    emoji: "🙂",
    label: "Good",
    tone : "good",
    keywords: [
      "Tasty", "Fresh", "Good portion", "On time", "Well packed", "Fair price",
    ],
  },
  {
    score: 3,
    emoji: "😐",
    label: "It was okay",
    tone : "okay",
    keywords: [
      "Taste was average", "Portion could be bigger", "Arrived warm, not hot",
      "A bit late", "Nothing special",
    ],
  },
  {
    score: 2,
    emoji: "🙁",
    label: "Not great",
    tone : "poor",
    keywords: [
      "Bland", "Too oily", "Too spicy", "Small portion",
      "Arrived cold", "Late", "Packaging leaked",
    ],
  },
  {
    score: 1,
    emoji: "😞",
    label: "Bad",
    tone : "bad",
    keywords: [
      "Tasted stale", "Wrong item", "Item missing", "Very late",
      "Spilled in transit", "Made me unwell",
    ],
  },
];

/** Ratings at or below this are treated as a complaint, not just a score. */
export const COMPLAINT_THRESHOLD = 2;

export function ratingFor(score) {
  return RATINGS.find(r => r.score === Number(score)) || null;
}

export function keywordsFor(score) {
  const r = ratingFor(score);
  return r ? r.keywords : [];
}

export function isComplaint(score) {
  return Number(score) > 0 && Number(score) <= COMPLAINT_THRESHOLD;
}

/**
 * What the kitchen should read at a glance.
 *
 * "made me unwell" is not the same class of problem as "a bit late", and an
 * average hides that completely — so a rating carries a severity of its own.
 */
export const SERIOUS_KEYWORDS = ["Made me unwell", "Tasted stale", "Item missing", "Wrong item"];

export function severityOf(rating) {
  if (!rating) return "none";
  const words = rating.keywords || [];
  if (words.some(w => SERIOUS_KEYWORDS.includes(w))) return "urgent";
  if (isComplaint(rating.score)) return "high";
  if (Number(rating.score) === 3)  return "watch";
  return "fine";
}

/** Rolling summary for the kitchen's own screen. */
export function summarise(ratings = []) {
  const rows = ratings.filter(r => Number(r.score) > 0);
  if (!rows.length) {
    return { count: 0, average: 0, breakdown: [], topWords: [], needsReply: 0 };
  }

  const total = rows.reduce((s, r) => s + Number(r.score), 0);

  const breakdown = RATINGS.map(def => ({
    ...def,
    count: rows.filter(r => Number(r.score) === def.score).length,
  })).map(b => ({ ...b, share: rows.length ? b.count / rows.length : 0 }));

  // What people actually keep saying, which is more useful than the average.
  const freq = new Map();
  rows.forEach(r => (r.keywords || []).forEach(w => freq.set(w, (freq.get(w) || 0) + 1)));
  const topWords = [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    count    : rows.length,
    average  : Math.round((total / rows.length) * 10) / 10,
    breakdown,
    topWords,
    needsReply: rows.filter(r => isComplaint(r.score) && !r.replied_at).length,
  };
}

/** The words a kitchen can reuse when replying to a bad rating. */
export function replyStarter(rating, kitchenName = "us") {
  if (!rating) return "";
  const words = (rating.keywords || []).join(", ").toLowerCase();
  if (isComplaint(rating.score)) {
    return (
      `Hi${rating.name ? " " + rating.name : ""}, sorry about order #${String(rating.order_id || "").slice(-5)}` +
      `${words ? ` — you mentioned ${words}` : ""}. That isn't the standard we cook to. ` +
      `Tell us what would put it right and we'll sort it out.`
    );
  }
  return (
    `Hi${rating.name ? " " + rating.name : ""}, thank you for rating order ` +
    `#${String(rating.order_id || "").slice(-5)} — really glad you enjoyed it. ` +
    `We'll be here whenever you're hungry again.`
  );
}
