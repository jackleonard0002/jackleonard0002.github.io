(function () {
  const AUTH_USER_KEY = "ww_auth_user";
  const AUTH_TOKEN_KEY = "ww_auth_token";
  const API_BASE = window.WW_API_BASE || (function () {
    const runtimeOverride = (function () {
      try {
        const value = localStorage.getItem("ww_api_base");
        return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
      } catch (error) {
        return "";
      }
    })();

    if (/^https?:\/\//i.test(runtimeOverride)) {
      return runtimeOverride;
    }

    const hasLocation = !!(window.location && window.location.hostname);
    const hostname = hasLocation ? window.location.hostname : "";
    const protocol = hasLocation ? window.location.protocol : "http:";

    if (/github\.io$/i.test(hostname)) {
      return "https://four-boxes-fold.loca.lt";
    }

    return hasLocation
      ? protocol + "//" + hostname + ":8787"
      : "http://localhost:8787";
  })();

  function readStorageItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
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

  function getAuthToken() {
    return readStorageItem(AUTH_TOKEN_KEY);
  }

  async function apiRequest(path, options) {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Please sign in with Google first.");
    }

    const response = await fetch(API_BASE + path, {
      method: options && options.method ? options.method : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(options && options.headers ? options.headers : {})
      },
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });

    const body = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      let message = body && body.error ? body.error : "Request failed";
      if (body && body.details && typeof body.details === "object") {
        const fieldIssues = [];
        Object.keys(body.details).forEach(function (key) {
          const value = body.details[key];
          if (Array.isArray(value) && value.length) {
            fieldIssues.push(key + ": " + value.join(", "));
          }
        });
        if (fieldIssues.length) {
          message += "\n" + fieldIssues.join("\n");
        }
      }
      throw new Error(message);
    }

    return body;
  }

  function getRequiredAuthToken() {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Please sign in with Google first.");
    }
    return token;
  }

  async function uploadImportBundle(file) {
    const token = getRequiredAuthToken();
    const formData = new FormData();
    formData.append("bundle", file, file.name || "products-backup.zip");

    const response = await fetch(API_BASE + "/api/admin/products/import", {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token
      },
      body: formData
    });

    const body = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error((body && body.error) || "Import failed");
    }

    return body;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

  function setStatus(message) {
    const status = document.getElementById("admin-status");
    if (status) {
      status.textContent = message;
    }
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  function normalizeProductId(rawId, name, category) {
    const base = slugify(rawId || name);
    if (base.length >= 2) {
      return base;
    }

    const categoryBase = slugify(category) || "product";
    if (!base) {
      return categoryBase + "-item";
    }

    return base + "-item";
  }

  function setDashboardVisible(visible) {
    const dashboard = document.getElementById("admin-dashboard");
    if (dashboard) {
      dashboard.hidden = !visible;
    }
  }

  function renderProductList(products) {
    const list = document.getElementById("product-list");
    if (!list) {
      return;
    }

    if (!products.length) {
      list.innerHTML = '<p class="empty-cart">No products yet.</p>';
      return;
    }

    list.innerHTML = [
      '<table class="admin-table">',
      '  <thead><tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Pic. Num</th><th>Actions</th></tr></thead>',
      '  <tbody>',
      products.map(function (item) {
        const pictureCount = Array.isArray(item.images)
          ? item.images.filter(Boolean).length
          : (item.image ? 1 : 0);
        const detailsHref = "product.html#id=" + encodeURIComponent(item.id);
        return [
          '<tr data-id="' + escapeHtml(item.id) + '" data-name="' + escapeHtml(item.name) + '">',
          '  <td>' + escapeHtml(item.id) + '</td>',
          '  <td>' + escapeHtml(item.name) + '</td>',
          '  <td>' + escapeHtml(item.category) + '</td>',
          '  <td>' + formatCurrency(item.price) + '</td>',
          '  <td>' + String(pictureCount) + '</td>',
          '  <td class="table-actions">',
          '    <a class="auth-btn" href="' + detailsHref + '" target="_blank" rel="noopener noreferrer">View</a>',
          '    <button type="button" data-action="edit">Edit</button>',
          '    <button type="button" data-action="delete" class="remove-btn">Delete</button>',
          '  </td>',
          '</tr>'
        ].join("");
      }).join(""),
      '  </tbody>',
      '</table>'
    ].join("");
  }

  function renderOrders(orders) {
    const list = document.getElementById("orders-list");
    if (!list) {
      return;
    }

    if (!orders.length) {
      list.innerHTML = '<p class="empty-cart">No orders yet.</p>';
      return;
    }

    list.innerHTML = orders.map(function (order) {
      const customerName = order.customer && (order.customer.displayName || order.customer.email || "Guest");
      const shippingAddress = order.shippingAddress;
      const itemsMarkup = Array.isArray(order.items)
        ? order.items.map(function (item) {
            return '<li>' + escapeHtml(item.name) + ' x ' + Number(item.quantity || 0) + '</li>';
          }).join("")
        : "";
      const shippingMarkup = shippingAddress
        ? [
            '<div class="order-shipping">',
            '  <strong>Ship to:</strong> ' + escapeHtml(shippingAddress.fullName),
            '  <p>' + escapeHtml(shippingAddress.line1) + '</p>',
            shippingAddress.line2 ? '  <p>' + escapeHtml(shippingAddress.line2) + '</p>' : '',
            '  <p>' + escapeHtml(shippingAddress.city) + ', ' + escapeHtml(shippingAddress.region) + ' ' + escapeHtml(shippingAddress.postalCode) + '</p>',
            '  <p>' + escapeHtml(shippingAddress.country) + '</p>',
            shippingAddress.email ? '  <p>' + escapeHtml(shippingAddress.email) + '</p>' : '',
            shippingAddress.phone ? '  <p>' + escapeHtml(shippingAddress.phone) + '</p>' : '',
            shippingAddress.deliveryNote ? '  <p>' + escapeHtml(shippingAddress.deliveryNote) + '</p>' : '',
            '</div>'
          ].join("")
        : '';

      return [
        '<article class="order-card">',
        '  <h3>' + escapeHtml(order.id) + '</h3>',
        '  <p class="order-meta">Customer: ' + escapeHtml(customerName || "Guest") + '</p>',
        '  <p class="order-meta">Placed: ' + escapeHtml(new Date(order.createdAt).toLocaleString()) + '</p>',
        '  <p class="order-meta">Total: ' + formatCurrency(order.total) + '</p>',
        shippingMarkup,
        '  <ul>' + itemsMarkup + '</ul>',
        '</article>'
      ].join("");
    }).join("");
  }

  function renderAnalytics(analytics) {
    const metricOrders = document.getElementById("metric-orders");
    const metricRevenue = document.getElementById("metric-revenue");
    const metricTopProduct = document.getElementById("metric-top-product");
    const analyticsTable = document.getElementById("analytics-table");

    if (!metricOrders || !metricRevenue || !metricTopProduct || !analyticsTable) {
      return;
    }

    metricOrders.textContent = String(analytics.totalOrders || 0);
    metricRevenue.textContent = formatCurrency(analytics.totalRevenue || 0);
    metricTopProduct.textContent = analytics.topProduct
      ? analytics.topProduct.name + " (" + analytics.topProduct.unitsSold + ")"
      : "None";

    const rows = Array.isArray(analytics.productPerformance) ? analytics.productPerformance : [];
    if (!rows.length) {
      analyticsTable.innerHTML = '<p class="empty-cart">No analytics yet. Place an order to see product performance.</p>';
      return;
    }

    analyticsTable.innerHTML = [
      '<table class="admin-table">',
      '  <thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th></tr></thead>',
      '  <tbody>',
      rows.map(function (row) {
        return '<tr><td>' + escapeHtml(row.name) + '</td><td>' + row.unitsSold + '</td><td>' + formatCurrency(row.revenue) + '</td></tr>';
      }).join(""),
      '  </tbody>',
      '</table>'
    ].join("");
  }

  function fillForm(product) {
    document.getElementById("product-edit-id").value = product.id;
    document.getElementById("product-id").value = product.id;
    document.getElementById("product-name").value = product.name;
    document.getElementById("product-category").value = product.category;
    document.getElementById("product-price").value = String(product.price);
    const images = Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image];
    document.getElementById("product-images").value = images.filter(Boolean).join("\n");
    document.getElementById("product-description").value = product.description;
    document.getElementById("product-alt").value = product.alt;
  }

  function clearForm() {
    const form = document.getElementById("product-form");
    if (form) {
      form.reset();
    }

    const editId = document.getElementById("product-edit-id");
    if (editId) {
      editId.value = "";
    }
  }

  function collectFormValues() {
    const name = document.getElementById("product-name").value.trim();
    const rawId = document.getElementById("product-id").value.trim();
    const category = document.getElementById("product-category").value.trim();
    const id = normalizeProductId(rawId, name, category);
    const price = Number(document.getElementById("product-price").value);
    const rawImages = document.getElementById("product-images").value;
    const images = rawImages
      .split(/\r?\n|,/)
      .map(function (value) {
        return value.trim();
      })
      .filter(Boolean);
    const image = images[0] || "";
    const description = document.getElementById("product-description").value.trim();
    const alt = document.getElementById("product-alt").value.trim();

    if (!id || !name || !category || !image || !description || !alt || !Number.isFinite(price)) {
      return null;
    }

    return {
      id,
      name,
      category,
      price,
      image,
      images,
      description,
      alt
    };
  }

  async function uploadProductImages(files) {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Please sign in with Google first.");
    }

    const formData = new FormData();
    files.forEach(function (file) {
      formData.append("images", file);
    });

    const response = await fetch(API_BASE + "/api/admin/uploads", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
      },
      body: formData
    });

    const body = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      const message = body && body.error ? body.error : "Image upload failed";
      throw new Error(message);
    }

    return Array.isArray(body.images) ? body.images : [];
  }

  async function fetchDashboardData() {
    const [productsResult, ordersResult, analyticsResult] = await Promise.all([
      apiRequest("/api/admin/products"),
      apiRequest("/api/admin/orders"),
      apiRequest("/api/admin/analytics")
    ]);

    return {
      products: productsResult.products || [],
      orders: ordersResult.orders || [],
      analytics: analyticsResult.analytics || {
        totalOrders: 0,
        totalRevenue: 0,
        topProduct: null,
        productPerformance: []
      }
    };
  }

  async function renderAll() {
    const data = await fetchDashboardData();
    renderProductList(data.products);
    renderOrders(data.orders);
    renderAnalytics(data.analytics);
  }

  function bindProductActions() {
    const form = document.getElementById("product-form");
    const list = document.getElementById("product-list");
    const resetButton = document.getElementById("product-reset");
    const productIdInput = document.getElementById("product-id");
    const productNameInput = document.getElementById("product-name");
    const imageFilesInput = document.getElementById("product-image-files");
    const uploadImagesButton = document.getElementById("product-upload-images");
    const uploadStatus = document.getElementById("product-upload-status");
    const imagesField = document.getElementById("product-images");
    const exportButton = document.getElementById("products-export");
    const importButton = document.getElementById("products-import");
    const importFileInput = document.getElementById("products-import-file");
    const transferStatus = document.getElementById("products-transfer-status");

    if (form) {
      if (productNameInput && productIdInput) {
        productNameInput.addEventListener("input", function () {
          if (!productIdInput.value.trim()) {
            const categoryValue = document.getElementById("product-category").value.trim();
            productIdInput.value = normalizeProductId("", productNameInput.value, categoryValue);
          }
        });
      }

      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const values = collectFormValues();
        if (!values) {
          alert("Please fill every product field with valid values.");
          return;
        }

        const editId = document.getElementById("product-edit-id").value.trim();

        try {
          // Keep edit mode only when saving the same product ID.
          if (editId && editId === values.id) {
            await apiRequest("/api/admin/products/" + encodeURIComponent(editId), {
              method: "PUT",
              body: values
            });
          } else {
            await apiRequest("/api/admin/products", {
              method: "POST",
              body: values
            });
          }

          clearForm();
          await renderAll();
        } catch (error) {
          alert(error.message || "Could not save product.");
        }
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", clearForm);
    }

    if (uploadImagesButton && imageFilesInput && imagesField) {
      uploadImagesButton.addEventListener("click", async function () {
        const files = Array.from(imageFilesInput.files || []);
        if (!files.length) {
          if (uploadStatus) {
            uploadStatus.textContent = "Select one or more images to upload.";
          }
          return;
        }

        try {
          uploadImagesButton.disabled = true;
          if (uploadStatus) {
            uploadStatus.textContent = "Uploading images...";
          }

          const uploadedPaths = await uploadProductImages(files);
          const current = imagesField.value
            .split(/\r?\n|,/)
            .map(function (value) {
              return value.trim();
            })
            .filter(Boolean);

          const merged = Array.from(new Set(current.concat(uploadedPaths)));
          imagesField.value = merged.join("\n");
          imageFilesInput.value = "";

          if (uploadStatus) {
            uploadStatus.textContent = "Uploaded " + uploadedPaths.length + " image" + (uploadedPaths.length === 1 ? "" : "s") + ".";
          }
        } catch (error) {
          if (uploadStatus) {
            uploadStatus.textContent = error.message || "Upload failed.";
          }
        } finally {
          uploadImagesButton.disabled = false;
        }
      });
    }

    if (exportButton) {
      exportButton.addEventListener("click", async function () {
        try {
          exportButton.disabled = true;
          if (transferStatus) {
            transferStatus.textContent = "Generating backup zip...";
          }

          // Ask the server to write the ZIP and return its filename.
          const result = await apiRequest("/api/admin/products/export");
          if (!result || !result.fileName) {
            throw new Error("Server did not return a backup filename.");
          }

          // Navigate the browser directly to the static file URL — bypasses all blob/XHR binary issues.
          const downloadUrl = API_BASE + "/backups/" + encodeURIComponent(result.fileName);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = result.fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();

          if (transferStatus) {
            transferStatus.textContent = "Backup zip ready — check your downloads (" + Math.round(result.size / 1024) + " KB).";
          }
        } catch (error) {
          if (transferStatus) {
            transferStatus.textContent = error.message || "Could not download catalog.";
          }
        } finally {
          exportButton.disabled = false;
        }
      });
    }

    if (importButton && importFileInput) {
      importButton.addEventListener("click", async function () {
        const file = importFileInput.files && importFileInput.files[0];
        if (!file) {
          if (transferStatus) {
            transferStatus.textContent = "Choose a JSON file first.";
          }
          return;
        }

        try {
          importButton.disabled = true;
          if (transferStatus) {
            transferStatus.textContent = "Importing product backup...";
          }

          let result;
          if (/\.json$/i.test(file.name || "")) {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const products = Array.isArray(parsed)
              ? parsed
              : (Array.isArray(parsed.products) ? parsed.products : null);

            if (!products) {
              throw new Error("JSON must be an array of products or an object with a products array.");
            }

            result = await apiRequest("/api/admin/products/import", {
              method: "PUT",
              body: { products }
            });
          } else {
            result = await uploadImportBundle(file);
          }

          await renderAll();
          importFileInput.value = "";

          if (transferStatus) {
            transferStatus.textContent = "Imported "
              + Number(result.imported || 0)
              + " products and restored "
              + Number(result.restoredAssets || 0)
              + " asset files.";
          }
        } catch (error) {
          if (transferStatus) {
            transferStatus.textContent = error.message || "Could not import catalog.";
          }
        } finally {
          importButton.disabled = false;
        }
      });
    }

    if (list) {
      list.addEventListener("click", async function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest("button[data-action]");
        if (!button) {
          return;
        }

        const action = button.getAttribute("data-action");
        const row = button.closest("tr[data-id]");
        const id = row ? row.getAttribute("data-id") : "";
        const productName = row ? row.getAttribute("data-name") : "";

        if (!id) {
          return;
        }

        try {
          if (action === "edit") {
            const response = await apiRequest("/api/admin/products");
            const product = (response.products || []).find(function (item) {
              return item.id === id;
            });
            if (product) {
              fillForm(product);
            }
            return;
          }

          if (action === "delete") {
            const confirmed = window.confirm("Delete product \"" + (productName || id) + "\"? This cannot be undone.");
            if (!confirmed) {
              return;
            }

            await apiRequest("/api/admin/products/" + encodeURIComponent(id), {
              method: "DELETE"
            });
            await renderAll();
          }
        } catch (error) {
          alert(error.message || "Action failed.");
        }
      });
    }
  }

  function bindThemeControls() {
    const selector = document.getElementById("theme-selector");
    const customPanel = document.getElementById("theme-custom-panel");
    const customBaseInput = document.getElementById("theme-custom-base");
    const customSurfaceInput = document.getElementById("theme-custom-surface");
    const customAccentInput = document.getElementById("theme-custom-accent");
    const customSaveButton = document.getElementById("theme-custom-save");
    const customResetButton = document.getElementById("theme-custom-reset");
    const currentThemeName = document.getElementById("theme-current-name");
    const currentBaseText = document.getElementById("theme-current-base");
    const currentSurfaceText = document.getElementById("theme-current-surface");
    const currentAccentText = document.getElementById("theme-current-accent");
    const currentBaseSwatch = document.getElementById("theme-current-base-swatch");
    const currentSurfaceSwatch = document.getElementById("theme-current-surface-swatch");
    const currentAccentSwatch = document.getElementById("theme-current-accent-swatch");
    const starsToggle = document.getElementById("decor-stars-toggle");
    const vinesToggle = document.getElementById("decor-vines-toggle");
    const rosesToggle = document.getElementById("decor-roses-toggle");
    const backgroundFileInput = document.getElementById("theme-background-file");
    const backgroundUploadButton = document.getElementById("theme-background-upload");
    const backgroundClearButton = document.getElementById("theme-background-clear");
    const backgroundStatus = document.getElementById("theme-background-status");
    const backgroundCurrent = document.getElementById("theme-background-current");
    const headerFileInput = document.getElementById("theme-header-file");
    const headerUploadButton = document.getElementById("theme-header-upload");
    const headerClearButton = document.getElementById("theme-header-clear");
    const headerStatus = document.getElementById("theme-header-status");
    const headerCurrent = document.getElementById("theme-header-current");
    const footerFileInput = document.getElementById("theme-footer-file");
    const footerUploadButton = document.getElementById("theme-footer-upload");
    const footerClearButton = document.getElementById("theme-footer-clear");
    const footerStatus = document.getElementById("theme-footer-status");
    const footerCurrent = document.getElementById("theme-footer-current");
    if (!selector) {
      return;
    }

    function getThemeApi() {
      return window.WW_THEME && typeof window.WW_THEME.setTheme === "function"
        ? window.WW_THEME
        : null;
    }

    function getThemeLabel(themeName) {
      const labels = {
        midnight: "Midnight Arcana",
        ember: "Ember Forge",
        forest: "Enchanted Forest",
        amethyst: "Amethyst Veil",
        custom: "Custom Palette"
      };

      return labels[themeName] || "Midnight Arcana";
    }

    function normalizeThemeColors(colors) {
      const source = colors && typeof colors === "object" ? colors : {};
      return {
        base: String(source.base || "").trim().toUpperCase(),
        surface: String(source.surface || "").trim().toUpperCase(),
        accent: String(source.accent || "").trim().toUpperCase()
      };
    }

    function getThemeState() {
      const api = getThemeApi();
      if (api && typeof api.getTheme === "function" && typeof api.getThemeColors === "function") {
        return {
          theme: api.getTheme(),
          colors: normalizeThemeColors(api.getThemeColors())
        };
      }

      return {
        theme: selector ? selector.value : "midnight",
        colors: normalizeThemeColors({
          base: customBaseInput ? customBaseInput.value : "#0E131A",
          surface: customSurfaceInput ? customSurfaceInput.value : "#151C26",
          accent: customAccentInput ? customAccentInput.value : "#C87544"
        })
      };
    }

    function updateThemePreview(themeName, colors) {
      const nextTheme = themeName || "midnight";
      const nextColors = normalizeThemeColors(colors || {});

      if (currentThemeName) {
        currentThemeName.textContent = getThemeLabel(nextTheme);
      }

      if (currentBaseText) {
        currentBaseText.textContent = nextColors.base || "#0E131A";
      }
      if (currentSurfaceText) {
        currentSurfaceText.textContent = nextColors.surface || "#151C26";
      }
      if (currentAccentText) {
        currentAccentText.textContent = nextColors.accent || "#C87544";
      }
      if (currentBaseSwatch) {
        currentBaseSwatch.style.backgroundColor = nextColors.base || "#0E131A";
      }
      if (currentSurfaceSwatch) {
        currentSurfaceSwatch.style.backgroundColor = nextColors.surface || "#151C26";
      }
      if (currentAccentSwatch) {
        currentAccentSwatch.style.backgroundColor = nextColors.accent || "#C87544";
      }
    }

    function setCustomInputs(colors) {
      const nextColors = normalizeThemeColors(colors || {});
      if (customBaseInput && nextColors.base) {
        customBaseInput.value = nextColors.base;
      }
      if (customSurfaceInput && nextColors.surface) {
        customSurfaceInput.value = nextColors.surface;
      }
      if (customAccentInput && nextColors.accent) {
        customAccentInput.value = nextColors.accent;
      }
    }

    function readCustomInputs() {
      return normalizeThemeColors({
        base: customBaseInput ? customBaseInput.value : "#0E131A",
        surface: customSurfaceInput ? customSurfaceInput.value : "#151C26",
        accent: customAccentInput ? customAccentInput.value : "#C87544"
      });
    }

    function setCustomPanelVisible(visible) {
      if (customPanel) {
        customPanel.hidden = !visible;
      }
    }

    function getDecorApi() {
      return window.WW_DECOR && typeof window.WW_DECOR.setState === "function"
        ? window.WW_DECOR
        : null;
    }

    function getCurrentBackgroundImage() {
      const api = getThemeApi();
      if (api && typeof api.getBackgroundImage === "function") {
        return String(api.getBackgroundImage() || "");
      }

      return "";
    }

    function updateBackgroundCurrentLabel(imagePath) {
      if (!backgroundCurrent) {
        return;
      }

      const safePath = String(imagePath || "").trim();
      backgroundCurrent.textContent = safePath
        ? "Current: " + safePath
        : "Current: Default magical forest";
    }

    function updateHeaderCurrentLabel(imagePath) {
      if (!headerCurrent) {
        return;
      }
      const safePath = String(imagePath || "").trim();
      headerCurrent.textContent = safePath
        ? "Current: " + safePath
        : "Current: Default stars";
    }

    function updateFooterCurrentLabel(imagePath) {
      if (!footerCurrent) {
        return;
      }
      const safePath = String(imagePath || "").trim();
      footerCurrent.textContent = safePath
        ? "Current: " + safePath
        : "Current: Default stars";
    }

    async function saveBackgroundImage(imagePath) {
      const nextPath = String(imagePath || "").trim();
      const result = await apiRequest("/api/admin/background", {
        method: "PUT",
        body: { backgroundImage: nextPath }
      });

      const savedPath = result && typeof result.backgroundImage === "string"
        ? result.backgroundImage
        : nextPath;

      const api = getThemeApi();
      if (api && typeof api.setBackgroundImage === "function") {
        api.setBackgroundImage(savedPath);
      }

      updateBackgroundCurrentLabel(savedPath);
      return savedPath;
    }

    async function saveThemeOverlayImages(nextValues) {
      const result = await apiRequest("/api/admin/theme-images", {
        method: "PUT",
        body: nextValues
      });

      const api = getThemeApi();
      const savedHeader = result && typeof result.headerOverlayImage === "string"
        ? result.headerOverlayImage
        : (Object.prototype.hasOwnProperty.call(nextValues, "headerOverlayImage") ? String(nextValues.headerOverlayImage || "") : undefined);
      const savedFooter = result && typeof result.footerOverlayImage === "string"
        ? result.footerOverlayImage
        : (Object.prototype.hasOwnProperty.call(nextValues, "footerOverlayImage") ? String(nextValues.footerOverlayImage || "") : undefined);

      if (typeof savedHeader === "string") {
        if (api && typeof api.setHeaderOverlayImage === "function") {
          api.setHeaderOverlayImage(savedHeader);
        }
        updateHeaderCurrentLabel(savedHeader);
      }

      if (typeof savedFooter === "string") {
        if (api && typeof api.setFooterOverlayImage === "function") {
          api.setFooterOverlayImage(savedFooter);
        }
        updateFooterCurrentLabel(savedFooter);
      }

      return { headerOverlayImage: savedHeader, footerOverlayImage: savedFooter };
    }

    const themeApi = getThemeApi();
    if (themeApi && typeof themeApi.getTheme === "function") {
      selector.value = themeApi.getTheme();
    }
    const initialThemeState = getThemeState();
    if (selector && selector.value === "custom" && themeApi && typeof themeApi.getCustomTheme === "function") {
      setCustomInputs(themeApi.getCustomTheme());
    } else if (themeApi && typeof themeApi.getCustomTheme === "function") {
      setCustomInputs(themeApi.getCustomTheme());
    }
    setCustomPanelVisible(selector.value === "custom");
    updateThemePreview(initialThemeState.theme, initialThemeState.colors);
    updateBackgroundCurrentLabel(getCurrentBackgroundImage());
    if (themeApi && typeof themeApi.getHeaderOverlayImage === "function") {
      updateHeaderCurrentLabel(themeApi.getHeaderOverlayImage());
    }
    if (themeApi && typeof themeApi.getFooterOverlayImage === "function") {
      updateFooterCurrentLabel(themeApi.getFooterOverlayImage());
    }

    const decorApi = getDecorApi();
    if (decorApi && typeof decorApi.getState === "function") {
      const state = decorApi.getState();
      if (starsToggle) {
        starsToggle.checked = Boolean(state.stars);
      }
      if (vinesToggle) {
        vinesToggle.checked = Boolean(state.vines);
      }
      if (rosesToggle) {
        rosesToggle.checked = Boolean(state.roses);
      }
    }

    function syncPreviewFromState(themeName) {
      const state = getThemeState();
      updateThemePreview(themeName || state.theme, themeName === "custom" ? readCustomInputs() : state.colors);
    }

    selector.addEventListener("change", async function () {
      const nextTheme = selector.value;
      const api = getThemeApi();
      setCustomPanelVisible(nextTheme === "custom");
      syncPreviewFromState(nextTheme);

      if (nextTheme === "custom") {
        if (api && typeof api.getCustomTheme === "function") {
          setCustomInputs(api.getCustomTheme());
          updateThemePreview("custom", readCustomInputs());
        }
        return;
      }

      try {
        const result = await apiRequest("/api/admin/theme", {
          method: "PUT",
          body: { theme: nextTheme }
        });

        const savedTheme = result && typeof result.theme === "string" ? result.theme : nextTheme;
        if (api) {
          api.setTheme(savedTheme);
        } else {
          document.documentElement.setAttribute("data-theme", savedTheme);
          try {
            localStorage.setItem("ww_theme", savedTheme);
          } catch (error) {
            // ignore storage restrictions
          }
        }
      } catch (error) {
        alert(error.message || "Could not update website theme.");
        if (api && typeof api.getTheme === "function") {
          selector.value = api.getTheme();
          setCustomPanelVisible(selector.value === "custom");
          syncPreviewFromState(selector.value);
        }
      }
    });

    function applyCustomPreview() {
      const nextColors = readCustomInputs();
      const api = getThemeApi();

      updateThemePreview("custom", nextColors);

      if (api && typeof api.setThemeColors === "function") {
        api.setThemeColors(nextColors);
      }
    }

    async function saveCustomTheme() {
      const customTheme = readCustomInputs();
      const api = getThemeApi();

      try {
        if (customSaveButton) {
          customSaveButton.disabled = true;
        }

        const result = await apiRequest("/api/admin/theme", {
          method: "PUT",
          body: {
            theme: "custom",
            customTheme
          }
        });

        const savedCustomTheme = result && result.customTheme && typeof result.customTheme === "object"
          ? result.customTheme
          : customTheme;

        if (api) {
          api.setTheme({ theme: "custom", customTheme: savedCustomTheme });
        }

        selector.value = "custom";
        setCustomPanelVisible(true);
        setCustomInputs(savedCustomTheme);
        updateThemePreview("custom", savedCustomTheme);
      } catch (error) {
        alert(error.message || "Could not save custom theme.");
      } finally {
        if (customSaveButton) {
          customSaveButton.disabled = false;
        }
      }
    }

    if (customBaseInput) {
      customBaseInput.addEventListener("input", applyCustomPreview);
    }

    if (customSurfaceInput) {
      customSurfaceInput.addEventListener("input", applyCustomPreview);
    }

    if (customAccentInput) {
      customAccentInput.addEventListener("input", applyCustomPreview);
    }

    if (customSaveButton) {
      customSaveButton.addEventListener("click", saveCustomTheme);
    }

    if (customResetButton) {
      customResetButton.addEventListener("click", function () {
        const themeApi = getThemeApi();
        const fallback = themeApi && typeof themeApi.getCustomTheme === "function"
          ? themeApi.getCustomTheme()
          : {
              base: "#0E131A",
              surface: "#151C26",
              accent: "#C87544"
            };

        setCustomInputs(fallback);
        applyCustomPreview();
      });
    }

    async function updateDecorState(next) {
      const api = getDecorApi();
      try {
        const result = await apiRequest("/api/admin/decor", {
          method: "PUT",
          body: {
            stars: Boolean(next.stars),
            vines: Boolean(next.vines),
            roses: Boolean(next.roses)
          }
        });

        const savedDecor = result && result.decor && typeof result.decor === "object"
          ? result.decor
          : next;

        if (api) {
          api.setState(savedDecor);
        } else {
          document.documentElement.setAttribute("data-decor-stars", savedDecor.stars ? "on" : "off");
          document.documentElement.setAttribute("data-decor-vines", savedDecor.vines ? "on" : "off");
          document.documentElement.setAttribute("data-decor-roses", savedDecor.roses ? "on" : "off");
          try {
            localStorage.setItem("ww_decor_stars", String(savedDecor.stars));
            localStorage.setItem("ww_decor_vines", String(savedDecor.vines));
            localStorage.setItem("ww_decor_roses", String(savedDecor.roses));
          } catch (error) {
            // ignore storage restrictions
          }
        }
      } catch (error) {
        alert(error.message || "Could not update website decorations.");
        if (api && typeof api.getState === "function") {
          const current = api.getState();
          if (starsToggle) {
            starsToggle.checked = Boolean(current.stars);
          }
          if (vinesToggle) {
            vinesToggle.checked = Boolean(current.vines);
          }
          if (rosesToggle) {
            rosesToggle.checked = Boolean(current.roses);
          }
        }
      }
    }

    if (starsToggle) {
      starsToggle.addEventListener("change", async function () {
        const next = {
          stars: starsToggle.checked,
          vines: vinesToggle ? vinesToggle.checked : false,
          roses: rosesToggle ? rosesToggle.checked : false
        };
        await updateDecorState(next);
      });
    }

    if (vinesToggle) {
      vinesToggle.addEventListener("change", async function () {
        const next = {
          stars: starsToggle ? starsToggle.checked : false,
          vines: vinesToggle.checked,
          roses: rosesToggle ? rosesToggle.checked : false
        };
        await updateDecorState(next);
      });
    }

    if (rosesToggle) {
      rosesToggle.addEventListener("change", async function () {
        const next = {
          stars: starsToggle ? starsToggle.checked : false,
          vines: vinesToggle ? vinesToggle.checked : false,
          roses: rosesToggle.checked
        };
        await updateDecorState(next);
      });
    }

    if (backgroundUploadButton && backgroundFileInput) {
      backgroundUploadButton.addEventListener("click", async function () {
        const file = backgroundFileInput.files && backgroundFileInput.files[0];
        if (!file) {
          if (backgroundStatus) {
            backgroundStatus.textContent = "Select an image first.";
          }
          return;
        }

        try {
          backgroundUploadButton.disabled = true;
          if (backgroundStatus) {
            backgroundStatus.textContent = "Uploading background image...";
          }

          const uploaded = await uploadProductImages([file]);
          const nextPath = uploaded[0] || "";
          if (!nextPath) {
            throw new Error("Upload succeeded but no image path was returned.");
          }

          await saveBackgroundImage(nextPath);
          backgroundFileInput.value = "";

          if (backgroundStatus) {
            backgroundStatus.textContent = "Background image updated.";
          }
        } catch (error) {
          if (backgroundStatus) {
            backgroundStatus.textContent = error.message || "Could not upload background image.";
          }
        } finally {
          backgroundUploadButton.disabled = false;
        }
      });
    }

    if (backgroundClearButton) {
      backgroundClearButton.addEventListener("click", async function () {
        try {
          backgroundClearButton.disabled = true;
          if (backgroundStatus) {
            backgroundStatus.textContent = "Clearing background image...";
          }

          await saveBackgroundImage("");

          if (backgroundStatus) {
            backgroundStatus.textContent = "Background reset to default.";
          }
        } catch (error) {
          if (backgroundStatus) {
            backgroundStatus.textContent = error.message || "Could not clear background image.";
          }
        } finally {
          backgroundClearButton.disabled = false;
        }
      });
    }

    if (headerUploadButton && headerFileInput) {
      headerUploadButton.addEventListener("click", async function () {
        const file = headerFileInput.files && headerFileInput.files[0];
        if (!file) {
          if (headerStatus) {
            headerStatus.textContent = "Select an image first.";
          }
          return;
        }

        try {
          headerUploadButton.disabled = true;
          if (headerStatus) {
            headerStatus.textContent = "Uploading header image...";
          }

          const uploaded = await uploadProductImages([file]);
          const nextPath = uploaded[0] || "";
          if (!nextPath) {
            throw new Error("Upload succeeded but no image path was returned.");
          }

          await saveThemeOverlayImages({ headerOverlayImage: nextPath });
          headerFileInput.value = "";

          if (headerStatus) {
            headerStatus.textContent = "Header image updated.";
          }
        } catch (error) {
          if (headerStatus) {
            headerStatus.textContent = error.message || "Could not upload header image.";
          }
        } finally {
          headerUploadButton.disabled = false;
        }
      });
    }

    if (footerUploadButton && footerFileInput) {
      footerUploadButton.addEventListener("click", async function () {
        const file = footerFileInput.files && footerFileInput.files[0];
        if (!file) {
          if (footerStatus) {
            footerStatus.textContent = "Select an image first.";
          }
          return;
        }

        try {
          footerUploadButton.disabled = true;
          if (footerStatus) {
            footerStatus.textContent = "Uploading footer image...";
          }

          const uploaded = await uploadProductImages([file]);
          const nextPath = uploaded[0] || "";
          if (!nextPath) {
            throw new Error("Upload succeeded but no image path was returned.");
          }

          await saveThemeOverlayImages({ footerOverlayImage: nextPath });
          footerFileInput.value = "";

          if (footerStatus) {
            footerStatus.textContent = "Footer image updated.";
          }
        } catch (error) {
          if (footerStatus) {
            footerStatus.textContent = error.message || "Could not upload footer image.";
          }
        } finally {
          footerUploadButton.disabled = false;
        }
      });
    }

    if (headerClearButton) {
      headerClearButton.addEventListener("click", async function () {
        try {
          headerClearButton.disabled = true;
          if (headerStatus) {
            headerStatus.textContent = "Restoring default header stars...";
          }

          await saveThemeOverlayImages({ headerOverlayImage: "" });

          if (headerStatus) {
            headerStatus.textContent = "Header reset to default stars.";
          }
        } catch (error) {
          if (headerStatus) {
            headerStatus.textContent = error.message || "Could not reset header image.";
          }
        } finally {
          headerClearButton.disabled = false;
        }
      });
    }

    if (footerClearButton) {
      footerClearButton.addEventListener("click", async function () {
        try {
          footerClearButton.disabled = true;
          if (footerStatus) {
            footerStatus.textContent = "Restoring default footer stars...";
          }

          await saveThemeOverlayImages({ footerOverlayImage: "" });

          if (footerStatus) {
            footerStatus.textContent = "Footer reset to default stars.";
          }
        } catch (error) {
          if (footerStatus) {
            footerStatus.textContent = error.message || "Could not reset footer image.";
          }
        } finally {
          footerClearButton.disabled = false;
        }
      });
    }

    window.addEventListener("ww-header-overlay-changed", function (event) {
      const nextPath = event && typeof event.detail === "string" ? event.detail : "";
      updateHeaderCurrentLabel(nextPath);
    });

    window.addEventListener("ww-footer-overlay-changed", function (event) {
      const nextPath = event && typeof event.detail === "string" ? event.detail : "";
      updateFooterCurrentLabel(nextPath);
    });

    window.addEventListener("ww-theme-changed", function (event) {
      const detail = event && event.detail ? event.detail : null;
      const nextTheme = typeof detail === "string" ? detail : (detail && detail.theme ? detail.theme : "midnight");
      const nextColors = detail && detail.colors && typeof detail.colors === "object"
        ? detail.colors
        : getThemeState().colors;

      if (selector && selector.value !== nextTheme) {
        selector.value = nextTheme;
      }

      setCustomPanelVisible(nextTheme === "custom");
      if (nextTheme === "custom") {
        setCustomInputs(nextColors);
      }

      updateThemePreview(nextTheme, nextTheme === "custom" ? nextColors : nextColors);
    });

    window.addEventListener("ww-decor-changed", function (event) {
      if (!event || !event.detail) {
        return;
      }

      if (starsToggle) {
        starsToggle.checked = Boolean(event.detail.stars);
      }

      if (vinesToggle) {
        vinesToggle.checked = Boolean(event.detail.vines);
      }

      if (rosesToggle) {
        rosesToggle.checked = Boolean(event.detail.roses);
      }
    });

    window.addEventListener("ww-background-changed", function (event) {
      const nextPath = event && typeof event.detail === "string" ? event.detail : "";
      updateBackgroundCurrentLabel(nextPath);
    });
  }

  function bindSecondaryAdminMenu() {
    const links = Array.from(document.querySelectorAll("[data-admin-page-link]"));
    if (!links.length) {
      return;
    }

    function normalizePathName(value) {
      const raw = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
      const clean = raw.replace(/^\/+/, "").replace(/\.html$/, "");
      return clean || "admin";
    }

    const currentFile = normalizePathName(window.location.pathname);
    links.forEach(function (link) {
      const href = link.getAttribute("href") || "";
      const targetFile = normalizePathName(href.split("/").pop());
      const isActive = targetFile === currentFile;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  async function initAdminDashboard() {
    const user = getStoredUser();
    if (!user) {
      setStatus("Sign in with a Google account to continue.");
      setDashboardVisible(false);
      return;
    }

    try {
      await renderAll();
      setStatus("Admin access granted for " + (user.email || "account") + ".");
      setDashboardVisible(true);
    } catch (error) {
      setStatus("Access denied or backend unavailable: " + (error.message || "Unknown error"));
      setDashboardVisible(false);
    }
  }

  window.addEventListener("ww-auth-changed", function () {
    initAdminDashboard();
  });

  window.addEventListener("ww-order-created", function () {
    initAdminDashboard();
  });

  window.addEventListener("ww-currency-changed", function () {
    initAdminDashboard();
  });

  document.addEventListener("DOMContentLoaded", function () {
    bindProductActions();
    bindThemeControls();
    bindSecondaryAdminMenu();
    initAdminDashboard();
  });
})();
