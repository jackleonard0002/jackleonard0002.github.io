const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");
const { z } = require("zod");
const { getProducts, saveProducts, getOrders, saveOrders, getUserProfile, saveUserProfile, getSiteSettings, saveSiteSettings } = require("../store");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const ASSETS_DIR = path.join(PROJECT_ROOT, "assets");
const UPLOAD_DIR = path.resolve(__dirname, "..", "..", "..", "assets", "images", "uploads");
const BACKUPS_DIR = path.join(PROJECT_ROOT, "backups");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const baseName = path.basename(file.originalname || "image", ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image";
    cb(null, baseName + "-" + Date.now() + ext);
  }
});

function uploadFilter(_req, file, cb) {
  const allowedMime = /^image\/(png|jpe?g|webp|gif)$/i.test(String(file.mimetype || ""));
  const allowedExt = /\.(png|jpe?g|webp|gif)$/i.test(String(file.originalname || ""));

  if (!allowedMime || !allowedExt) {
    cb(new Error("Only PNG, JPG, WEBP, and GIF images are allowed"));
    return;
  }

  cb(null, true);
}

const uploadImages = multer({
  storage: uploadStorage,
  fileFilter: uploadFilter,
  limits: {
    files: 8,
    fileSize: 6 * 1024 * 1024
  }
});

const uploadBundle = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 80 * 1024 * 1024
  }
});

const productSchema = z.object({
  id: z.string().trim().min(2),
  name: z.string().trim().min(2),
  category: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(["wand", "painting"])),
  price: z.coerce.number().nonnegative(),
  image: z.string().trim().optional(),
  images: z.array(z.string().trim().min(1)).optional(),
  description: z.string().trim().min(2),
  alt: z.string().trim().min(2)
}).superRefine((value, ctx) => {
  const hasImage = typeof value.image === "string" && value.image.trim().length > 0;
  const hasImages = Array.isArray(value.images) && value.images.length > 0;
  if (!hasImage && !hasImages) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["images"],
      message: "At least one product image is required"
    });
  }
});

function normalizeProductPayload(payload) {
  const images = Array.isArray(payload.images)
    ? payload.images.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const image = String(payload.image || "").trim();
  const normalizedImages = images.length ? images : (image ? [image] : []);

  return {
    ...payload,
    image: image || normalizedImages[0] || "",
    images: normalizedImages
  };
}

const orderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(2),
      quantity: z.number().int().positive()
    })
  ).min(1),
  shippingAddress: z.object({
    fullName: z.string().min(2),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().min(3).optional().or(z.literal("")),
    line1: z.string().min(3),
    line2: z.string().optional().or(z.literal("")),
    city: z.string().min(2),
    region: z.string().min(2),
    postalCode: z.string().min(2),
    country: z.string().min(2),
    deliveryNote: z.string().optional().or(z.literal(""))
  }).optional()
});

const addressSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(3).optional().or(z.literal("")),
  line1: z.string().min(3),
  line2: z.string().optional().or(z.literal("")),
  city: z.string().min(2),
  region: z.string().min(2),
  postalCode: z.string().min(2),
  country: z.string().min(2),
  deliveryNote: z.string().optional().or(z.literal(""))
});

const themeSchema = z.object({
  theme: z.enum(["midnight", "ember", "forest", "amethyst", "custom"]),
  customTheme: z.any().optional()
}).superRefine((value, ctx) => {
  if (value.theme === "custom" && !normalizeCustomThemePayload(value.customTheme)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customTheme"],
      message: "Custom theme colors are required"
    });
  }
});

const decorSchema = z.object({
  stars: z.boolean(),
  vines: z.boolean(),
  roses: z.boolean()
});

function normalizeThemeColor(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCustomThemePayload(customTheme) {
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

const backgroundImageSchema = z.object({
  backgroundImage: z.string().trim().max(300).refine((value) => {
    if (!value) {
      return true;
    }
    return /^assets\/images\/[a-z0-9._/-]+$/i.test(value);
  }, {
    message: "Background image must use an assets/images/... path"
  })
});

const overlayImagePathSchema = z.string().trim().max(300).refine((value) => {
  if (!value) {
    return true;
  }
  return /^assets\/images\/[a-z0-9._/-]+$/i.test(value);
}, {
  message: "Overlay image must use an assets/images/... path"
});

const overlayImagesSchema = z.object({
  headerOverlayImage: overlayImagePathSchema.optional(),
  footerOverlayImage: overlayImagePathSchema.optional()
});

const productImportSchema = z.object({
  products: z.array(productSchema)
});

function normalizeBundlePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function resolveAssetPath(assetRef) {
  const normalized = normalizeBundlePath(assetRef);
  if (!normalized.startsWith("assets/")) {
    return null;
  }

  const absolute = path.resolve(PROJECT_ROOT, normalized);
  const safePrefix = ASSETS_DIR.toLowerCase();
  if (!absolute.toLowerCase().startsWith(safePrefix)) {
    return null;
  }

  return {
    normalized,
    absolute
  };
}

function collectProductImageRefs(products) {
  const refs = new Set();

  (products || []).forEach((product) => {
    const images = Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image];

    images.forEach((imageRef) => {
      const clean = String(imageRef || "").trim();
      if (clean) {
        refs.add(clean);
      }
    });
  });

  return Array.from(refs.values());
}

function parseImportProductsPayload(payload) {
  const directProducts = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.products) ? payload.products : null);
  if (!directProducts) {
    return null;
  }

  const parsed = productImportSchema.safeParse({ products: directProducts });
  if (!parsed.success) {
    return {
      error: parsed.error.flatten()
    };
  }

  return {
    products: parsed.data.products.map(normalizeProductPayload)
  };
}

function dedupeProductsById(products) {
  const uniqueById = new Map();
  (products || []).forEach((item) => {
    uniqueById.set(item.id, item);
  });
  return Array.from(uniqueById.values());
}

function computeAnalytics(orders) {
  const salesByProduct = {};
  let totalRevenue = 0;

  orders.forEach((order) => {
    totalRevenue += Number(order.total || 0);
    (order.items || []).forEach((item) => {
      if (!salesByProduct[item.productId]) {
        salesByProduct[item.productId] = {
          productId: item.productId,
          name: item.name,
          unitsSold: 0,
          revenue: 0
        };
      }

      salesByProduct[item.productId].unitsSold += Number(item.quantity || 0);
      salesByProduct[item.productId].revenue += Number(item.lineTotal || 0);
    });
  });

  const productPerformance = Object.values(salesByProduct).sort((a, b) => b.unitsSold - a.unitsSold);

  return {
    totalOrders: orders.length,
    totalRevenue,
    topProduct: productPerformance[0] || null,
    productPerformance
  };
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "whimsical-wands-api" });
});

router.get("/products", async (_req, res, next) => {
  try {
    const products = await getProducts();
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

router.get("/theme", async (_req, res, next) => {
  try {
    const settings = await getSiteSettings();
    res.json({
      theme: settings.theme || "midnight",
      backgroundImage: settings.backgroundImage || "",
      headerOverlayImage: settings.headerOverlayImage || "",
      footerOverlayImage: settings.footerOverlayImage || "",
      customTheme: settings.customTheme || null
    });
  } catch (error) {
    next(error);
  }
});

router.get("/decor", async (_req, res, next) => {
  try {
    const settings = await getSiteSettings();
    res.json({ decor: settings.decor || { stars: false, vines: false, roses: false } });
  } catch (error) {
    next(error);
  }
});

router.post("/orders", requireAuth, async (req, res, next) => {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid order payload", details: parsed.error.flatten() });
    }

    const storedProfile = await getUserProfile(req.user.uid);
    const shippingAddress = parsed.data.shippingAddress || (storedProfile ? storedProfile.shippingAddress : null);

    if (!shippingAddress) {
      return res.status(400).json({ error: "Shipping address is required" });
    }

    const shippingAddressResult = addressSchema.safeParse(shippingAddress);
    if (!shippingAddressResult.success) {
      return res.status(400).json({ error: "Invalid shipping address", details: shippingAddressResult.error.flatten() });
    }

    const products = await getProducts();
    const productsById = new Map(products.map((product) => [product.id, product]));

    let total = 0;
    const items = parsed.data.items.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new Error("Unknown product: " + item.productId);
      }

      const unitPrice = Number(product.price || 0);
      const lineTotal = unitPrice * item.quantity;
      total += lineTotal;

      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        lineTotal
      };
    });

    const order = {
      id: "order-" + randomUUID(),
      createdAt: new Date().toISOString(),
      customer: {
        uid: req.user.uid,
        email: req.user.email || "",
        displayName: req.user.name || req.user.email || "Customer"
      },
      shippingAddress: shippingAddressResult.data,
      items,
      total
    };

    const orders = await getOrders();
    orders.unshift(order);
    await saveOrders(orders);

    return res.status(201).json({ order });
  } catch (error) {
    if (error.message && error.message.startsWith("Unknown product:")) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
});

router.get("/orders/me", requireAuth, async (req, res, next) => {
  try {
    const orders = await getOrders();
    const ownOrders = orders.filter((order) => order.customer && order.customer.uid === req.user.uid);
    res.json({ orders: ownOrders });
  } catch (error) {
    next(error);
  }
});

router.get("/me/address", requireAuth, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.user.uid);
    res.json({ shippingAddress: profile ? profile.shippingAddress || null : null });
  } catch (error) {
    next(error);
  }
});

router.put("/me/address", requireAuth, async (req, res, next) => {
  try {
    const parsed = addressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid shipping address", details: parsed.error.flatten() });
    }

    const nextProfile = {
      shippingAddress: parsed.data,
      updatedAt: new Date().toISOString()
    };

    await saveUserProfile(req.user.uid, nextProfile);
    res.json({ shippingAddress: parsed.data });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/products", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const products = await getProducts();
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/products/export", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    // Purge backups older than 1 hour so the folder doesn't fill up.
    try {
      const now = Date.now();
      fs.readdirSync(BACKUPS_DIR).forEach(function (name) {
        const fullPath = path.join(BACKUPS_DIR, name);
        try {
          const mtime = fs.statSync(fullPath).mtimeMs;
          if (now - mtime > 60 * 60 * 1000) {
            fs.unlinkSync(fullPath);
          }
        } catch (_e) {}
      });
    } catch (_e) {}

    const products = await getProducts();
    const exportedAt = new Date().toISOString();
    const exportPayload = { exportedAt, products };

    const zip = new AdmZip();
    zip.addFile("products.json", Buffer.from(JSON.stringify(exportPayload, null, 2), "utf8"));

    const imageRefs = collectProductImageRefs(products);
    imageRefs.forEach((imageRef) => {
      const resolved = resolveAssetPath(imageRef);
      if (!resolved) return;
      if (!fs.existsSync(resolved.absolute)) return;
      try {
        const stat = fs.statSync(resolved.absolute);
        if (!stat.isFile()) return;
        zip.addFile(resolved.normalized, fs.readFileSync(resolved.absolute));
      } catch (_e) {}
    });

    const stamp = exportedAt.slice(0, 19).replace(/[:T]/g, "-");
    const fileName = "whimsical-products-" + stamp + "-" + randomUUID().slice(0, 8) + ".zip";
    const outPath = path.join(BACKUPS_DIR, fileName);
    zip.writeZip(outPath);

    const stat = fs.statSync(outPath);
    if (!stat.isFile() || stat.size < 10) {
      return res.status(500).json({ error: "Export failed: ZIP file could not be written" });
    }

    return res.json({ fileName, size: stat.size });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/access", requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true, role: "admin" });
});

router.put("/admin/theme", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const parsed = themeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid theme payload", details: parsed.error.flatten() });
    }

    const nextSettings = { theme: parsed.data.theme };
    if (parsed.data.theme === "custom") {
      nextSettings.customTheme = normalizeCustomThemePayload(parsed.data.customTheme);
    }

    await saveSiteSettings(nextSettings);
    return res.json(nextSettings);
  } catch (error) {
    next(error);
  }
});

router.put("/admin/background", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const parsed = backgroundImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid background payload", details: parsed.error.flatten() });
    }

    await saveSiteSettings({ backgroundImage: parsed.data.backgroundImage || "" });
    return res.json({ backgroundImage: parsed.data.backgroundImage || "" });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/theme-images", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const parsed = overlayImagesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid theme image payload", details: parsed.error.flatten() });
    }

    const nextSettings = {};
    if (Object.prototype.hasOwnProperty.call(parsed.data, "headerOverlayImage")) {
      nextSettings.headerOverlayImage = parsed.data.headerOverlayImage || "";
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "footerOverlayImage")) {
      nextSettings.footerOverlayImage = parsed.data.footerOverlayImage || "";
    }

    await saveSiteSettings(nextSettings);
    return res.json(nextSettings);
  } catch (error) {
    next(error);
  }
});

router.put("/admin/decor", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const parsed = decorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid decor payload", details: parsed.error.flatten() });
    }

    await saveSiteSettings({ decor: parsed.data });
    return res.json({ decor: parsed.data });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/uploads", requireAuth, requireAdmin, (req, res, next) => {
  uploadImages.array("images", 8)(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || "Image upload failed" });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ error: "No images uploaded" });
    }

    const images = files.map((file) => {
      return "assets/images/uploads/" + file.filename;
    });

    return res.status(201).json({ images });
  });
});

router.post("/admin/products", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid product payload", details: parsed.error.flatten() });
    }

    const nextProduct = normalizeProductPayload(parsed.data);

    const products = await getProducts();
    if (products.some((item) => item.id === nextProduct.id)) {
      return res.status(409).json({ error: "Product ID already exists" });
    }

    const nextProducts = products.concat(nextProduct);
    await saveProducts(nextProducts);

    return res.status(201).json({ product: nextProduct });
  } catch (error) {
    next(error);
  }
});

router.put("/admin/products/import", requireAuth, requireAdmin, (req, res, next) => {
  uploadBundle.single("bundle")(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({ error: uploadError.message || "Import upload failed" });
    }

    try {
      if (req.file) {
        const zip = new AdmZip(req.file.buffer);
        const entries = zip.getEntries();

        const productsEntry = entries.find((entry) => {
          const name = normalizeBundlePath(entry.entryName).toLowerCase();
          return !entry.isDirectory && (name === "products.json" || name.endsWith("/products.json"));
        });

        if (!productsEntry) {
          return res.status(400).json({ error: "Zip file must include products.json" });
        }

        let payload;
        try {
          payload = JSON.parse(productsEntry.getData().toString("utf8"));
        } catch (_error) {
          return res.status(400).json({ error: "products.json is not valid JSON" });
        }

        const parsedPayload = parseImportProductsPayload(payload);
        if (!parsedPayload) {
          return res.status(400).json({ error: "products.json must contain a products array" });
        }

        if (parsedPayload.error) {
          return res.status(400).json({ error: "Invalid import payload", details: parsedPayload.error });
        }

        let restoredAssets = 0;
        entries.forEach((entry) => {
          if (entry.isDirectory) {
            return;
          }

          const name = normalizeBundlePath(entry.entryName);
          if (!name.startsWith("assets/")) {
            return;
          }

          const resolved = resolveAssetPath(name);
          if (!resolved) {
            return;
          }

          fs.mkdirSync(path.dirname(resolved.absolute), { recursive: true });
          fs.writeFileSync(resolved.absolute, entry.getData());
          restoredAssets += 1;
        });

        const dedupedProducts = dedupeProductsById(parsedPayload.products);
        await saveProducts(dedupedProducts);

        return res.json({
          imported: dedupedProducts.length,
          restoredAssets,
          products: dedupedProducts
        });
      }

      const parsedPayload = parseImportProductsPayload(req.body);
      if (!parsedPayload) {
        return res.status(400).json({ error: "Import payload must be a products array, products object, or zip bundle" });
      }

      if (parsedPayload.error) {
        return res.status(400).json({ error: "Invalid import payload", details: parsedPayload.error });
      }

      const dedupedProducts = dedupeProductsById(parsedPayload.products);
      await saveProducts(dedupedProducts);

      return res.json({
        imported: dedupedProducts.length,
        restoredAssets: 0,
        products: dedupedProducts
      });
    } catch (error) {
      next(error);
    }
  });
});

router.put("/admin/products/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid product payload", details: parsed.error.flatten() });
    }

    const nextProduct = normalizeProductPayload(parsed.data);

    if (req.params.id !== nextProduct.id) {
      return res.status(400).json({ error: "Path ID and body ID must match" });
    }

    const products = await getProducts();
    const exists = products.some((item) => item.id === req.params.id);
    if (!exists) {
      return res.status(404).json({ error: "Product not found" });
    }

    const nextProducts = products.map((item) => (item.id === req.params.id ? nextProduct : item));
    await saveProducts(nextProducts);

    return res.json({ product: nextProduct });
  } catch (error) {
    next(error);
  }
});

router.delete("/admin/products/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const products = await getProducts();
    const nextProducts = products.filter((item) => item.id !== req.params.id);

    if (nextProducts.length === products.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    await saveProducts(nextProducts);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/admin/orders", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const orders = await getOrders();
    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/analytics", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const orders = await getOrders();
    res.json({ analytics: computeAnalytics(orders) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
