const { getAuth } = require("./firebaseAdmin");

function parseBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminUser(user) {
  if (!user || !user.email) {
    return false;
  }

  const adminEmails = getAdminEmails();
  return adminEmails.includes(String(user.email).toLowerCase());
}

async function optionalAuth(req, _res, next) {
  const token = parseBearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    req.user = null;
    return next();
  }
}

async function requireAuth(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid auth token" });
  }
}

function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!isAdminUser(user)) {
    return res.status(403).json({ error: "Admin email required" });
  }

  return next();
}

module.exports = {
  optionalAuth,
  requireAuth,
  requireAdmin,
  isAdminUser
};
