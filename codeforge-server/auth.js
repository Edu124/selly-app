const jwt    = require("jsonwebtoken");
const jwksRsa = require("jwks-rsa");

// Clerk JWKS endpoint — verifies JWTs issued by Clerk
const CLERK_JWKS_URL = `https://${process.env.CLERK_DOMAIN}/.well-known/jwks.json`;

const jwksClient = jwksRsa({
  jwksUri: CLERK_JWKS_URL,
  cache:   true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

function getKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// ── Verify Clerk JWT and extract userId ───────────────────────────────────────
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

// ── Express middleware ────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await verifyToken(token);
    req.userId = decoded.sub;           // Clerk user ID  (e.g. "user_2abc...")
    req.userEmail = decoded.email || decoded.primary_email_address_id || "";
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth, verifyToken };
