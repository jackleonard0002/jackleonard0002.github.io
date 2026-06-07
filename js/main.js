(function () {
    const CART_COUNT_KEY = "ww_cart_count";
    const CART_GUEST_KEY = "ww_cart_items_guest";
    const CART_USER_PREFIX = "ww_cart_items_user_";
    const AUTH_USER_KEY = "ww_auth_user";
    const AUTH_TOKEN_KEY = "ww_auth_token";
    const THEME_KEY = "ww_theme";
    const BACKGROUND_IMAGE_KEY = "ww_background_image";
    const HEADER_OVERLAY_IMAGE_KEY = "ww_header_overlay_image";
    const FOOTER_OVERLAY_IMAGE_KEY = "ww_footer_overlay_image";
    const DECOR_STARS_KEY = "ww_decor_stars";
    const DECOR_VINES_KEY = "ww_decor_vines";
    const DECOR_ROSES_KEY = "ww_decor_roses";
    const CUSTOM_THEME_KEY = "ww_theme_custom";
    const API_BASE = window.WW_API_BASE || (function () {
        const hasLocation = !!(window.location && window.location.hostname);
        const hostname = hasLocation ? window.location.hostname : "";
        const protocol = hasLocation ? window.location.protocol : "http:";

        if (/github\.io$/i.test(hostname)) {
            return "https://tangy-zoos-repair.loca.lt";
        }

        return hasLocation
            ? protocol + "//" + hostname + ":8787"
            : "http://localhost:8787";
    })();
    let loadedProducts = null;
    let cartCountFallback = 0;
    let currentFilter = "all";
    let areFilterHandlersBound = false;
    const THEME_OPTIONS = ["midnight", "ember", "forest", "amethyst", "custom"];
    const THEME_PRESETS = {
        midnight: { bg: "#0E131A", surface: "#151C26", accent: "#C87544" },
        ember: { bg: "#1A0F0F", surface: "#261616", accent: "#E27A3F" },
        forest: { bg: "#0D1713", surface: "#16231D", accent: "#B7894D" },
        amethyst: { bg: "#140F1D", surface: "#20182D", accent: "#D17BBB" }
    };
    const THEME_VAR_NAMES = ["--bg", "--bg-deep", "--surface", "--ink", "--muted", "--accent", "--accent-2", "--line"];

    function readStorageItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStorageItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            // Ignore storage failures so UI behavior still works on restricted file pages.
        }
    }

    function normalizeTheme(theme) {
        const value = String(theme || "").toLowerCase();
        return THEME_OPTIONS.includes(value) ? value : "midnight";
    }

    function normalizeHexColor(value) {
        const raw = String(value || "").trim();
        if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
            return "";
        }

        const hex = raw.slice(1);
        if (hex.length === 3) {
            return "#" + hex.split("").map(function (chunk) {
                return chunk + chunk;
            }).join("").toUpperCase();
        }

        return "#" + hex.toUpperCase();
    }

    function hexToRgb(hex) {
        const safe = normalizeHexColor(hex);
        if (!safe) {
            return null;
        }

        const value = safe.slice(1);
        return {
            r: Number.parseInt(value.slice(0, 2), 16),
            g: Number.parseInt(value.slice(2, 4), 16),
            b: Number.parseInt(value.slice(4, 6), 16)
        };
    }

    function rgbToHex(rgb) {
        const clamp = function (component) {
            return Math.max(0, Math.min(255, Math.round(component)));
        };

        return "#" + [rgb.r, rgb.g, rgb.b].map(function (component) {
            return clamp(component).toString(16).padStart(2, "0");
        }).join("").toUpperCase();
    }

    function mixColors(first, second, weight) {
        const from = hexToRgb(first);
        const to = hexToRgb(second);
        const safeWeight = Math.max(0, Math.min(1, Number(weight) || 0));
        if (!from || !to) {
            return normalizeHexColor(first) || normalizeHexColor(second) || "#000000";
        }

        return rgbToHex({
            r: from.r * (1 - safeWeight) + to.r * safeWeight,
            g: from.g * (1 - safeWeight) + to.g * safeWeight,
            b: from.b * (1 - safeWeight) + to.b * safeWeight
        });
    }

    function luminance(hex) {
        const rgb = hexToRgb(hex);
        if (!rgb) {
            return 0;
        }

        const normalized = [rgb.r, rgb.g, rgb.b].map(function (component) {
            const value = component / 255;
            return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        });

        return normalized[0] * 0.2126 + normalized[1] * 0.7152 + normalized[2] * 0.0722;
    }

    function getReadableInk(hex) {
        return luminance(hex) > 0.45 ? "#10131A" : "#F6F8FB";
    }

    function normalizeThemeColors(colors) {
        const preset = THEME_PRESETS.midnight;
        const source = colors && typeof colors === "object" ? colors : {};
        return {
            base: normalizeHexColor(source.base || source.bg) || preset.bg,
            surface: normalizeHexColor(source.surface) || preset.surface,
            accent: normalizeHexColor(source.accent) || preset.accent
        };
    }

    function getThemePreset(theme) {
        return THEME_PRESETS[normalizeTheme(theme)] || THEME_PRESETS.midnight;
    }

    function getStoredCustomTheme() {
        const raw = readStorageItem(CUSTOM_THEME_KEY);
        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw);
            return normalizeThemeColors(parsed);
        } catch (error) {
            return null;
        }
    }

    function getThemeColors(theme, customTheme) {
        const safeTheme = normalizeTheme(theme);
        if (safeTheme === "custom") {
            return normalizeThemeColors(customTheme || getStoredCustomTheme() || THEME_PRESETS.midnight);
        }

        return normalizeThemeColors(getThemePreset(safeTheme));
    }

    function buildDerivedThemeVars(themeColors) {
        const colors = normalizeThemeColors(themeColors);
        const bgDeep = mixColors(colors.base, "#000000", 0.28);
        const accent2 = mixColors(colors.accent, colors.surface, 0.42);
        const line = mixColors(colors.surface, colors.base, 0.58);
        const ink = getReadableInk(colors.base);
        const muted = mixColors(ink, colors.base, 0.42);

        return {
            bg: colors.base,
            bgDeep,
            surface: colors.surface,
            ink,
            muted,
            accent: colors.accent,
            accent2,
            line
        };
    }

    function applyInlineThemeVars(themeVars) {
        THEME_VAR_NAMES.forEach(function (name) {
            document.documentElement.style.removeProperty(name);
        });

        if (!themeVars) {
            return;
        }

        Object.keys(themeVars).forEach(function (key) {
            document.documentElement.style.setProperty("--" + key.replace(/[A-Z]/g, function (letter) {
                return "-" + letter.toLowerCase();
            }), themeVars[key]);
        });
    }

    function getThemeConfiguration() {
        return {
            theme: getStoredTheme(),
            customTheme: getStoredCustomTheme()
        };
    }

    function getStoredTheme() {
        return normalizeTheme(readStorageItem(THEME_KEY));
    }

    function applyTheme(theme, persist) {
        const incoming = typeof theme === "object" && theme !== null ? theme : { theme };
        const safeTheme = normalizeTheme(incoming.theme);
        const customTheme = safeTheme === "custom"
            ? normalizeThemeColors(incoming.customTheme || incoming.colors || getStoredCustomTheme())
            : null;
        const themeVars = buildDerivedThemeVars(safeTheme === "custom" ? customTheme : getThemePreset(safeTheme));

        document.documentElement.setAttribute("data-theme", safeTheme);
        if (safeTheme === "custom") {
            applyInlineThemeVars(themeVars);
        } else {
            applyInlineThemeVars(null);
        }

        if (persist !== false) {
            writeStorageItem(THEME_KEY, safeTheme);
            if (safeTheme === "custom" && customTheme) {
                writeStorageItem(CUSTOM_THEME_KEY, JSON.stringify(customTheme));
            }
        }

        window.dispatchEvent(new CustomEvent("ww-theme-changed", {
            detail: {
                theme: safeTheme,
                colors: safeTheme === "custom" ? customTheme : getThemeColors(safeTheme),
                derived: themeVars
            }
        }));
        return safeTheme;
    }

    function initTheme() {
        applyTheme(getThemeConfiguration(), false);
        applyBackgroundImage(getStoredBackgroundImage(), false);
        applyHeaderOverlayImage(getStoredHeaderOverlayImage(), false);
        applyFooterOverlayImage(getStoredFooterOverlayImage(), false);
        syncThemeFromServer();
    }

    function sanitizeBackgroundImagePath(value) {
        const next = String(value || "").trim();
        if (!next) {
            return "";
        }

        if (!/^assets\/images\/[a-z0-9._/-]+$/i.test(next)) {
            return "";
        }

        return next;
    }

    function getStoredBackgroundImage() {
        return sanitizeBackgroundImagePath(readStorageItem(BACKGROUND_IMAGE_KEY));
    }

    function getStoredHeaderOverlayImage() {
        return sanitizeBackgroundImagePath(readStorageItem(HEADER_OVERLAY_IMAGE_KEY));
    }

    function getStoredFooterOverlayImage() {
        return sanitizeBackgroundImagePath(readStorageItem(FOOTER_OVERLAY_IMAGE_KEY));
    }

    function applyBackgroundImage(imagePath, persist) {
        const safePath = sanitizeBackgroundImagePath(imagePath);
        if (safePath) {
            const escaped = ("/" + safePath).replace(/"/g, "%22");
            document.documentElement.style.setProperty("--site-bg-image", "url(\"" + escaped + "\")");
        } else {
            document.documentElement.style.removeProperty("--site-bg-image");
        }

        if (persist !== false) {
            writeStorageItem(BACKGROUND_IMAGE_KEY, safePath);
        }

        window.dispatchEvent(new CustomEvent("ww-background-changed", { detail: safePath }));
        return safePath;
    }

    function applyHeaderOverlayImage(imagePath, persist) {
        const safePath = sanitizeBackgroundImagePath(imagePath);
        if (safePath) {
            const escaped = ("/" + safePath).replace(/"/g, "%22");
            document.documentElement.style.setProperty("--header-overlay-image", "url(\"" + escaped + "\")");
        } else {
            document.documentElement.style.removeProperty("--header-overlay-image");
        }

        if (persist !== false) {
            writeStorageItem(HEADER_OVERLAY_IMAGE_KEY, safePath);
        }

        window.dispatchEvent(new CustomEvent("ww-header-overlay-changed", { detail: safePath }));
        return safePath;
    }

    function applyFooterOverlayImage(imagePath, persist) {
        const safePath = sanitizeBackgroundImagePath(imagePath);
        if (safePath) {
            const escaped = ("/" + safePath).replace(/"/g, "%22");
            document.documentElement.style.setProperty("--footer-overlay-image", "url(\"" + escaped + "\")");
        } else {
            document.documentElement.style.removeProperty("--footer-overlay-image");
        }

        if (persist !== false) {
            writeStorageItem(FOOTER_OVERLAY_IMAGE_KEY, safePath);
        }

        window.dispatchEvent(new CustomEvent("ww-footer-overlay-changed", { detail: safePath }));
        return safePath;
    }

    async function syncThemeFromServer() {
        try {
            const response = await fetch(API_BASE + "/api/theme");
            if (!response.ok) {
                return;
            }

            const body = await response.json();
            if (body && typeof body.theme === "string") {
                applyTheme({
                    theme: body.theme,
                    customTheme: body.customTheme
                }, true);
            }
            if (body && typeof body.backgroundImage === "string") {
                applyBackgroundImage(body.backgroundImage, true);
            }
            if (body && typeof body.headerOverlayImage === "string") {
                applyHeaderOverlayImage(body.headerOverlayImage, true);
            }
            if (body && typeof body.footerOverlayImage === "string") {
                applyFooterOverlayImage(body.footerOverlayImage, true);
            }
        } catch (error) {
            // If backend is unavailable, keep local fallback theme.
        }
    }

    function parseStoredBool(value) {
        return String(value || "").toLowerCase() === "true";
    }

    function getStoredDecorations() {
        return {
            stars: parseStoredBool(readStorageItem(DECOR_STARS_KEY)),
            vines: parseStoredBool(readStorageItem(DECOR_VINES_KEY)),
            roses: parseStoredBool(readStorageItem(DECOR_ROSES_KEY))
        };
    }

    function applyDecorations(nextDecor, persist) {
        const current = getStoredDecorations();
        const stars = Boolean(nextDecor && typeof nextDecor.stars !== "undefined" ? nextDecor.stars : current.stars);
        const vines = Boolean(nextDecor && typeof nextDecor.vines !== "undefined" ? nextDecor.vines : current.vines);
        const roses = Boolean(nextDecor && typeof nextDecor.roses !== "undefined" ? nextDecor.roses : current.roses);

        document.documentElement.setAttribute("data-decor-stars", stars ? "on" : "off");
        document.documentElement.setAttribute("data-decor-vines", vines ? "on" : "off");
        document.documentElement.setAttribute("data-decor-roses", roses ? "on" : "off");

        if (persist !== false) {
            writeStorageItem(DECOR_STARS_KEY, String(stars));
            writeStorageItem(DECOR_VINES_KEY, String(vines));
            writeStorageItem(DECOR_ROSES_KEY, String(roses));
        }

        const detail = { stars, vines, roses };
        window.dispatchEvent(new CustomEvent("ww-decor-changed", { detail }));
        return detail;
    }

    function initDecorations() {
        applyDecorations(getStoredDecorations(), false);
        syncDecorationsFromServer();
    }

    async function syncDecorationsFromServer() {
        try {
            const response = await fetch(API_BASE + "/api/decor");
            if (!response.ok) {
                return;
            }

            const body = await response.json();
            if (body && body.decor && typeof body.decor === "object") {
                applyDecorations(body.decor, true);
            }
        } catch (error) {
            // If backend is unavailable, keep local fallback decoration settings.
        }
    }

    function getStoredUser() {
        const raw = readStorageItem(AUTH_USER_KEY);
        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.uid === "string" && parsed.uid) {
                return parsed;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function getDefaultProducts() {
        return Array.isArray(window.WW_PRODUCTS) ? window.WW_PRODUCTS : [];
    }

    async function getProducts() {
        if (loadedProducts) {
            return loadedProducts;
        }

        const controller = typeof AbortController === "function"
            ? new AbortController()
            : null;
        const timeout = controller
            ? window.setTimeout(function () {
                controller.abort();
            }, 3200)
            : null;

        try {
            const response = await fetch(API_BASE + "/api/products", controller ? { signal: controller.signal } : undefined);
            if (!response.ok) {
                throw new Error("Failed to load products");
            }

            const payload = await response.json();
            if (payload && Array.isArray(payload.products)) {
                loadedProducts = payload.products;
                return loadedProducts;
            }

            loadedProducts = getDefaultProducts();
            return loadedProducts;
        } catch (error) {
            loadedProducts = getDefaultProducts();
            return loadedProducts;
        } finally {
            if (timeout !== null) {
                window.clearTimeout(timeout);
            }
        }
    }

    function getCartStorageKey() {
        const user = getStoredUser();
        if (user && user.uid) {
            return CART_USER_PREFIX + user.uid;
        }

        return CART_GUEST_KEY;
    }

    function readCartItems() {
        const raw = readStorageItem(getCartStorageKey());
        if (!raw) {
            return {};
        }

        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") {
                return {};
            }

            const safe = {};
            Object.keys(parsed).forEach(function (productId) {
                const qty = Number(parsed[productId]);
                if (Number.isFinite(qty) && qty > 0) {
                    safe[productId] = Math.floor(qty);
                }
            });

            return safe;
        } catch (error) {
            return {};
        }
    }

    function writeCartItems(items) {
        writeStorageItem(getCartStorageKey(), JSON.stringify(items));
    }

    function sumCartCount(items) {
        return Object.values(items).reduce(function (total, qty) {
            return total + qty;
        }, 0);
    }

    function readLegacyCartCount() {
        const raw = readStorageItem(CART_COUNT_KEY);
        const value = Number.parseInt(raw || String(cartCountFallback), 10);
        if (Number.isNaN(value)) {
            return 0;
        }

        return Math.max(value, 0);
    }

    function writeLegacyCartCount(value) {
        cartCountFallback = value;
        writeStorageItem(CART_COUNT_KEY, String(value));
    }

    function formatCurrency(value) {
        if (window.WW_CURRENCY && typeof window.WW_CURRENCY.formatFromBase === "function") {
            return window.WW_CURRENCY.formatFromBase(value);
        }

        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP"
        }).format(Number(value) || 0);
    }

    function getPrimaryImage(product) {
        if (product && Array.isArray(product.images) && product.images.length) {
            return product.images[0];
        }

        if (product && typeof product.image === "string" && product.image.trim()) {
            return product.image;
        }

        return "assets/images/wand-emberleaf.jpg";
    }

    function getCartCount() {
        const itemCount = sumCartCount(readCartItems());
        if (itemCount > 0) {
            return itemCount;
        }

        return readLegacyCartCount();
    }

    function setCartCount(value) {
        const safeValue = Math.max(0, value);
        writeLegacyCartCount(safeValue);

        const counter = document.getElementById("cart-count");
        if (counter) {
            counter.textContent = String(safeValue);
        }
    }

    function syncCartCountFromStorage() {
        setCartCount(getCartCount());
    }

    function addItemToCart(productId) {
        const items = readCartItems();
        const currentQty = items[productId] || 0;
        items[productId] = currentQty + 1;
        writeCartItems(items);
        setCartCount(sumCartCount(items));
    }

    function handleNavToggle() {
        const toggle = document.querySelector(".menu-toggle");
        const nav = document.getElementById("site-nav");

        if (!toggle || !nav) {
            return;
        }

        if (toggle.dataset.bound === "true") {
            return;
        }

        toggle.dataset.bound = "true";

        function closeMenu() {
            if (!nav.classList.contains("open")) {
                return;
            }

            nav.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        }

        toggle.addEventListener("click", function () {
            const isOpen = nav.classList.toggle("open");
            toggle.setAttribute("aria-expanded", String(isOpen));
        });

        document.addEventListener("click", function (event) {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }

            if (toggle.contains(target) || nav.contains(target)) {
                return;
            }

            closeMenu();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeMenu();
            }
        });

        nav.addEventListener("click", function (event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            if (target.closest(".nav-menu-links a")) {
                closeMenu();
            }
        });
    }

    function handleSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function (link) {
            link.addEventListener("click", function (event) {
                const targetId = link.getAttribute("href");
                if (!targetId || targetId === "#") {
                    return;
                }

                const target = document.querySelector(targetId);
                if (!target) {
                    return;
                }

                event.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });
    }

    function handleHeaderCollapse() {
        const header = document.querySelector(".site-header");
        if (!header) {
            return;
        }

        if (header.dataset.collapseBound === "true") {
            return;
        }

        header.dataset.collapseBound = "true";

        // The header shrinks ~75px on collapse (sticky header causes content to jump,
        // dropping scrollY by ~75px). Thresholds must have a gap > that delta, and a
        // transition lock stops re-evaluation while the animation is running.
        const COLLAPSE_AT = 120;  // collapse when scrolled past this
        const EXPAND_AT = 20;   // expand only when back near the very top
        const LOCK_MS = 380;  // matches CSS transition duration

        let ticking = false;
        let locked = false;

        function updateHeaderState() {
            if (window.matchMedia("(max-width: 860px)").matches) {
                header.classList.remove("is-collapsed");
                ticking = false;
                return;
            }

            if (locked) { ticking = false; return; }
            const y = window.scrollY;
            const isCollapsed = header.classList.contains("is-collapsed");
            if (!isCollapsed && y > COLLAPSE_AT) {
                locked = true;
                header.classList.add("is-collapsed");
                setTimeout(() => { locked = false; }, LOCK_MS);
            } else if (isCollapsed && y < EXPAND_AT) {
                locked = true;
                header.classList.remove("is-collapsed");
                setTimeout(() => { locked = false; }, LOCK_MS);
            }
            ticking = false;
        }

        function requestUpdate() {
            if (ticking) {
                return;
            }

            ticking = true;
            window.requestAnimationFrame(updateHeaderState);
        }

        updateHeaderState();
        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate);
    }

    function addToCartFromEvent(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest(".add-cart");
        if (!button) {
            return;
        }

        const productId = button.getAttribute("data-product-id");
        if (!productId) {
            return;
        }

        addItemToCart(productId);
    }

    function handleCartButtonNavigation() {
        const cartButton = document.getElementById("cart-button");
        if (!cartButton) {
            return;
        }

        cartButton.addEventListener("click", function () {
            window.location.href = "cart.html";
        });
    }

    function ensureSettingsButton() {
        const toolsRow = document.querySelector(".nav-tools-row");
        if (!toolsRow) {
            return null;
        }

        let settingsButton = document.getElementById("settings-button");
        if (!settingsButton) {
            settingsButton = document.createElement("button");
            settingsButton.id = "settings-button";
            settingsButton.className = "settings-pill";
            settingsButton.type = "button";
            settingsButton.setAttribute("aria-label", "Open settings");

            const icon = document.createElement("img");
            icon.className = "settings-icon";
            icon.src = "assets/images/settings%20icon.png";
            icon.alt = "";
            icon.setAttribute("aria-hidden", "true");

            settingsButton.appendChild(icon);
            toolsRow.appendChild(settingsButton);
        }

        const path = String(window.location.pathname || "").toLowerCase();
        const isOnSettingsPage = path.endsWith("/settings.html") || path.endsWith("settings.html");
        settingsButton.classList.toggle("active", isOnSettingsPage);
        settingsButton.setAttribute("aria-current", isOnSettingsPage ? "page" : "false");

        return settingsButton;
    }

    function handleSettingsButtonNavigation() {
        const settingsButton = ensureSettingsButton();
        if (!settingsButton) {
            return;
        }

        if (settingsButton.dataset.bound === "true") {
            return;
        }

        settingsButton.dataset.bound = "true";
        settingsButton.addEventListener("click", function () {
            window.location.href = "settings.html";
        });
    }

    function setAdminLinksVisible(isVisible) {
        document.querySelectorAll("a.admin-link").forEach(function (link) {
            link.hidden = !isVisible;
        });
    }

    function ensureAdminStatusElement() {
        const authControls = document.querySelector(".auth-controls");
        if (!authControls) {
            return null;
        }

        let badge = document.getElementById("admin-access-status");
        if (!badge) {
            badge = document.createElement("span");
            badge.id = "admin-access-status";
            badge.className = "admin-access-status";
            badge.hidden = true;
            authControls.appendChild(badge);
        }

        return badge;
    }

    function setAdminStatus(text, state) {
        const badge = ensureAdminStatusElement();
        if (!badge) {
            return;
        }

        const nextText = String(text || "").trim();
        if (!nextText) {
            badge.hidden = true;
            badge.textContent = "";
            badge.removeAttribute("data-state");
            return;
        }

        badge.textContent = nextText;
        badge.hidden = false;
        if (state) {
            badge.setAttribute("data-state", state);
        } else {
            badge.removeAttribute("data-state");
        }
    }

    async function canAccessAdmin(token) {
        if (!token) {
            return { ok: false, status: 401 };
        }

        try {
            const response = await fetch(API_BASE + "/api/admin/access?ts=" + Date.now(), {
                cache: "no-store",
                headers: {
                    Authorization: "Bearer " + token
                }
            });

            return { ok: response.ok, status: response.status };
        } catch (error) {
            return { ok: false, status: 0 };
        }
    }

    async function syncAdminLinksFromAuth() {
        const user = getStoredUser();
        const token = readStorageItem(AUTH_TOKEN_KEY);

        if (!user || !token) {
            setAdminLinksVisible(false);
            setAdminStatus("", "");
            return;
        }

        const access = await canAccessAdmin(token);
        if (access.ok) {
            setAdminLinksVisible(true);
            setAdminStatus("Admin access available", "ok");
            return;
        }

        setAdminLinksVisible(false);
        setAdminStatus("", "");
    }

    function renderProducts(filter, data) {
        const grid = document.getElementById("product-grid");

        if (!grid || !Array.isArray(data)) {
            return;
        }

        const filtered = filter === "all"
            ? data
            : data.filter(function (item) {
                return item.category === filter;
            });

        grid.innerHTML = filtered
            .map(function (item) {
                const image = getPrimaryImage(item);
                const detailsHref = "product.html#id=" + encodeURIComponent(item.id);
                return [
                    '<article class="product-card" data-category="' + item.category + '">',
                    '  <a class="product-card-link" href="' + detailsHref + '">',
                    '    <img src="' + image + '" alt="' + item.alt + '" />',
                    '  </a>',
                    '  <div class="card-body">',
                    '    <h3><a class="product-card-link" href="' + detailsHref + '">' + item.name + '</a></h3>',
                    '    <p>' + item.description + '</p>',
                    '    <div class="card-meta">',
                    '      <span>' + formatCurrency(item.price) + '</span>',
                    '      <div class="card-actions">',
                    '        <a class="auth-btn" href="' + detailsHref + '">View details</a>',
                    '        <button class="add-cart" data-product-id="' + item.id + '">Add to cart</button>',
                    '      </div>',
                    '    </div>',
                    '  </div>',
                    '</article>'
                ].join("");
            })
            .join("");
    }

    async function handleProductFiltering() {
        const buttons = document.querySelectorAll(".filter-btn");
        if (!buttons.length) {
            return;
        }

        const products = await getProducts();
        renderProducts(currentFilter, products);

        if (areFilterHandlersBound) {
            return;
        }

        areFilterHandlersBound = true;

        buttons.forEach(function (button) {
            button.addEventListener("click", function () {
                buttons.forEach(function (btn) {
                    btn.classList.remove("active");
                    btn.setAttribute("aria-pressed", "false");
                });

                button.classList.add("active");
                button.setAttribute("aria-pressed", "true");

                currentFilter = button.getAttribute("data-filter") || "all";
                renderProducts(currentFilter, products);
            });
        });
    }

    async function rerenderProductsForCurrencyChange() {
        const grid = document.getElementById("product-grid");
        if (!grid) {
            return;
        }

        const products = await getProducts();
        renderProducts(currentFilter, products);
    }

    window.WW_THEME = {
        getTheme: function () {
            const attrTheme = document.documentElement.getAttribute("data-theme");
            return normalizeTheme(attrTheme || getStoredTheme());
        },
        setTheme: function (theme) {
            return applyTheme(theme, true);
        },
        getThemeColors: function () {
            return getThemeColors(getStoredTheme(), getStoredCustomTheme());
        },
        getCustomTheme: function () {
            return getStoredCustomTheme() || normalizeThemeColors(THEME_PRESETS.midnight);
        },
        setThemeColors: function (colors) {
            return applyTheme({ theme: "custom", customTheme: colors }, true);
        },
        getBackgroundImage: function () {
            return getStoredBackgroundImage();
        },
        setBackgroundImage: function (imagePath) {
            return applyBackgroundImage(imagePath, true);
        },
        getHeaderOverlayImage: function () {
            return getStoredHeaderOverlayImage();
        },
        setHeaderOverlayImage: function (imagePath) {
            return applyHeaderOverlayImage(imagePath, true);
        },
        getFooterOverlayImage: function () {
            return getStoredFooterOverlayImage();
        },
        setFooterOverlayImage: function (imagePath) {
            return applyFooterOverlayImage(imagePath, true);
        },
        themes: THEME_OPTIONS.slice(),
        presets: Object.keys(THEME_PRESETS).reduce(function (accumulator, key) {
            accumulator[key] = getThemePreset(key);
            return accumulator;
        }, {})
    };

    window.WW_DECOR = {
        getState: function () {
            const starsAttr = document.documentElement.getAttribute("data-decor-stars");
            const vinesAttr = document.documentElement.getAttribute("data-decor-vines");
            const rosesAttr = document.documentElement.getAttribute("data-decor-roses");
            if (starsAttr || vinesAttr || rosesAttr) {
                return {
                    stars: starsAttr === "on",
                    vines: vinesAttr === "on",
                    roses: rosesAttr === "on"
                };
            }
            return getStoredDecorations();
        },
        setState: function (state) {
            return applyDecorations(state || {}, true);
        }
    };

    document.addEventListener("click", addToCartFromEvent);
    window.addEventListener("ww-auth-changed", function () {
        syncCartCountFromStorage();
        syncAdminLinksFromAuth();
    });
    window.addEventListener("ww-layout-ready", function () {
        handleHeaderCollapse();
        initPageUi();
    });
    window.addEventListener("ww-currency-changed", function () {
        rerenderProductsForCurrencyChange();
    });
    initTheme();
    initDecorations();
    handleHeaderCollapse();

    function initPageUi() {
        setAdminLinksVisible(false);
        syncCartCountFromStorage();
        syncAdminLinksFromAuth();
        handleSettingsButtonNavigation();
        handleNavToggle();
        handleCartButtonNavigation();
        handleSmoothScroll();
        handleProductFiltering();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPageUi, { once: true });
    } else {
        initPageUi();
    }
})();
