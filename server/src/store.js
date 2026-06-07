const fs = require("node:fs/promises");
const path = require("node:path");

const STORE_PATH = path.resolve(__dirname, "..", "data", "store.json");

function normalizeThemeColor(value) {
  const next = String(value || "").trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(next)) {
    return "";
  }

  if (next.length === 4) {
    return "#" + next.slice(1).split("").map((part) => part + part).join("");
  }

  return next.toLowerCase();
}

function normalizeCustomTheme(customTheme) {
  if (!customTheme || typeof customTheme !== "object") {
    return null;
  }

  const base = normalizeThemeColor(customTheme.base || customTheme.bg);
  const surface = normalizeThemeColor(customTheme.surface);
  const accent = normalizeThemeColor(customTheme.accent);

  if (!base || !surface || !accent) {
    return null;
  }

  return { base, surface, accent };
}

function normalizeProduct(product) {
  const imagesFromArray = Array.isArray(product && product.images)
    ? product.images.filter((item) => typeof item === "string" && item.trim())
    : [];
  const primaryImage = typeof (product && product.image) === "string" && product.image.trim()
    ? product.image.trim()
    : "";
  const images = imagesFromArray.length
    ? imagesFromArray
    : (primaryImage ? [primaryImage] : []);

  return {
    ...product,
    image: primaryImage || images[0] || "",
    images
  };
}

async function readStore() {
  const raw = await fs.readFile(STORE_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeStore(nextStore) {
  await fs.writeFile(STORE_PATH, JSON.stringify(nextStore, null, 2), "utf8");
}

async function getProducts() {
  const store = await readStore();
  const products = Array.isArray(store.products) ? store.products : [];
  return products.map(normalizeProduct);
}

async function saveProducts(products) {
  const store = await readStore();
  store.products = (Array.isArray(products) ? products : []).map(normalizeProduct);
  await writeStore(store);
}

async function getOrders() {
  const store = await readStore();
  return Array.isArray(store.orders) ? store.orders : [];
}

async function saveOrders(orders) {
  const store = await readStore();
  store.orders = orders;
  await writeStore(store);
}

async function getUserProfile(uid) {
  const store = await readStore();
  const profiles = store.userProfiles || {};
  return profiles[uid] || null;
}

async function saveUserProfile(uid, profile) {
  const store = await readStore();
  store.userProfiles = store.userProfiles || {};
  store.userProfiles[uid] = profile;
  await writeStore(store);
}

async function getSiteSettings() {
  const store = await readStore();
  const settings = store.siteSettings && typeof store.siteSettings === "object"
    ? store.siteSettings
    : {};

  const decor = settings.decor && typeof settings.decor === "object"
    ? settings.decor
    : {};

  return {
    theme: typeof settings.theme === "string" ? settings.theme : "midnight",
    backgroundImage: typeof settings.backgroundImage === "string" ? settings.backgroundImage : "",
    headerOverlayImage: typeof settings.headerOverlayImage === "string" ? settings.headerOverlayImage : "",
    footerOverlayImage: typeof settings.footerOverlayImage === "string" ? settings.footerOverlayImage : "",
    customTheme: normalizeCustomTheme(settings.customTheme),
    decor: {
      stars: Boolean(decor.stars),
      vines: Boolean(decor.vines),
      roses: Boolean(decor.roses)
    }
  };
}

async function saveSiteSettings(nextSettings) {
  const store = await readStore();
  const current = store.siteSettings && typeof store.siteSettings === "object"
    ? store.siteSettings
    : {};

  store.siteSettings = {
    ...current,
    ...nextSettings
  };

  await writeStore(store);
}

module.exports = {
  getProducts,
  saveProducts,
  getOrders,
  saveOrders,
  getUserProfile,
  saveUserProfile,
  getSiteSettings,
  saveSiteSettings
};
