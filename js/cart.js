(function () {
  const CART_GUEST_KEY = "ww_cart_items_guest";
  const CART_USER_PREFIX = "ww_cart_items_user_";
  const CART_COUNT_KEY = "ww_cart_count";
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
      return "https://true-experts-trade.loca.lt";
    }

    return hasLocation
      ? protocol + "//" + hostname + ":8787"
      : "http://localhost:8787";
  })();
  let loadedProducts = null;

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
      // Ignore storage failures so cart UI still renders.
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

  function sumCount(items) {
    return Object.values(items).reduce(function (total, qty) {
      return total + qty;
    }, 0);
  }

  function syncLegacyCount(items) {
    writeStorageItem(CART_COUNT_KEY, String(sumCount(items)));
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

  function readShippingAddressFromForm() {
    const fullName = document.getElementById("shipping-full-name");
    const email = document.getElementById("shipping-email");
    const phone = document.getElementById("shipping-phone");
    const line1 = document.getElementById("shipping-line1");
    const line2 = document.getElementById("shipping-line2");
    const city = document.getElementById("shipping-city");
    const region = document.getElementById("shipping-region");
    const postalCode = document.getElementById("shipping-postal-code");
    const country = document.getElementById("shipping-country");
    const deliveryNote = document.getElementById("shipping-delivery-note");

    return {
      fullName: fullName ? fullName.value.trim() : "",
      email: email ? email.value.trim() : "",
      phone: phone ? phone.value.trim() : "",
      line1: line1 ? line1.value.trim() : "",
      line2: line2 ? line2.value.trim() : "",
      city: city ? city.value.trim() : "",
      region: region ? region.value.trim() : "",
      postalCode: postalCode ? postalCode.value.trim() : "",
      country: country ? country.value.trim() : "",
      deliveryNote: deliveryNote ? deliveryNote.value.trim() : ""
    };
  }

  function writeShippingAddressToForm(address) {
    if (!address) {
      return;
    }

    const fieldIds = {
      fullName: "shipping-full-name",
      email: "shipping-email",
      phone: "shipping-phone",
      line1: "shipping-line1",
      line2: "shipping-line2",
      city: "shipping-city",
      region: "shipping-region",
      postalCode: "shipping-postal-code",
      country: "shipping-country",
      deliveryNote: "shipping-delivery-note"
    };

    Object.keys(fieldIds).forEach(function (key) {
      const input = document.getElementById(fieldIds[key]);
      if (input) {
        input.value = address[key] || "";
      }
    });
  }

  async function loadProductCatalog() {
    try {
      const response = await fetch(API_BASE + "/api/products");
      if (!response.ok) {
        throw new Error("Failed to load products");
      }

      const payload = await response.json();
      if (payload && Array.isArray(payload.products)) {
        loadedProducts = payload.products;
        return;
      }
    } catch (error) {
      // fall back to bundled product list below
    }

    loadedProducts = Array.isArray(window.WW_PRODUCTS) ? window.WW_PRODUCTS : [];
  }

  async function loadSavedShippingAddress() {
    const user = getStoredUser();
    if (!user || !getAuthToken()) {
      return;
    }

    try {
      const response = await fetch(API_BASE + "/api/me/address", {
        headers: {
          Authorization: "Bearer " + getAuthToken()
        }
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      if (payload && payload.shippingAddress) {
        writeShippingAddressToForm(payload.shippingAddress);
      }
    } catch (error) {
      // Ignore profile loading failures and let the user type the address manually.
    }
  }

  function findProduct(productId) {
    const products = Array.isArray(loadedProducts) ? loadedProducts : (Array.isArray(window.WW_PRODUCTS) ? window.WW_PRODUCTS : []);
    return products.find(function (item) {
      return item.id === productId;
    }) || null;
  }

  function productTitleFallback(productId) {
    return productId
      .split("-")
      .map(function (chunk) {
        return chunk.charAt(0).toUpperCase() + chunk.slice(1);
      })
      .join(" ");
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

  function updateOwnerLabel() {
    const owner = document.getElementById("cart-owner");
    if (!owner) {
      return;
    }

    const user = getStoredUser();
    if (user) {
      const label = user.displayName || user.email || "Signed-in user";
      owner.textContent = "Cart linked to " + label;
      return;
    }

    owner.textContent = "Guest cart";
  }

  function validateShippingAddress(address) {
    return Boolean(
      address.fullName &&
      address.line1 &&
      address.city &&
      address.region &&
      address.postalCode &&
      address.country
    );
  }

  function renderCart() {
    const cartItemsEl = document.getElementById("cart-items");
    const summaryCount = document.getElementById("summary-count");
    const summaryTotal = document.getElementById("summary-total");

    if (!cartItemsEl || !summaryCount || !summaryTotal) {
      return;
    }

    const items = readCartItems();
    const ids = Object.keys(items);

    if (!ids.length) {
      cartItemsEl.innerHTML = '<p class="empty-cart">Your cart is empty. Add a few magical items from the shop.</p>';
      summaryCount.textContent = "0";
      summaryTotal.textContent = formatCurrency(0);
      syncLegacyCount(items);
      return;
    }

    let subtotal = 0;
    const markup = ids.map(function (productId) {
      const quantity = items[productId];
      const product = findProduct(productId);
      const name = product ? product.name : productTitleFallback(productId);
      const image = getPrimaryImage(product);
      const alt = product ? product.alt : name;
      const price = product ? Number(product.price || 0) : 0;
      const rowTotal = quantity * price;
      subtotal += rowTotal;

      return [
        '<article class="cart-item" data-product-id="' + productId + '">',
        '  <img class="cart-item-image" src="' + image + '" alt="' + alt + '" />',
        '  <div class="cart-item-body">',
        '    <h3>' + name + '</h3>',
        '    <p class="cart-item-meta">Unit price: ' + formatCurrency(price) + '</p>',
        '    <div class="cart-item-controls">',
        '      <button type="button" data-action="decrease">-</button>',
        '      <span aria-live="polite">' + quantity + '</span>',
        '      <button type="button" data-action="increase">+</button>',
        '      <button type="button" data-action="remove" class="remove-btn">Remove</button>',
        '    </div>',
        '  </div>',
        '  <p class="cart-item-total">' + formatCurrency(rowTotal) + '</p>',
        '</article>'
      ].join("");
    }).join("");

    cartItemsEl.innerHTML = markup;
    summaryCount.textContent = String(sumCount(items));
    summaryTotal.textContent = formatCurrency(subtotal);
    syncLegacyCount(items);
  }

  function updateQuantity(productId, action) {
    const items = readCartItems();
    const current = items[productId] || 0;

    if (action === "increase") {
      items[productId] = current + 1;
    }

    if (action === "decrease") {
      if (current <= 1) {
        delete items[productId];
      } else {
        items[productId] = current - 1;
      }
    }

    if (action === "remove") {
      delete items[productId];
    }

    writeCartItems(items);
    renderCart();
  }

  async function placeOrder() {
    const items = readCartItems();
    if (!Object.keys(items).length) {
      alert("Your cart is empty.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      alert("Please sign in with Google before placing an order.");
      return;
    }

    const shippingAddress = readShippingAddressFromForm();
    if (!validateShippingAddress(shippingAddress)) {
      alert("Please complete the shipping address before placing your order.");
      return;
    }

    const saveAddress = document.getElementById("save-shipping-address");
    if (saveAddress && saveAddress.checked) {
      try {
        const saveResponse = await fetch(API_BASE + "/api/me/address", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify(shippingAddress)
        });

        if (!saveResponse.ok) {
          const saveBody = await saveResponse.json().catch(function () {
            return {};
          });
          throw new Error(saveBody && saveBody.error ? saveBody.error : "Could not save shipping address.");
        }
      } catch (error) {
        alert(error.message || "Could not save shipping address.");
        return;
      }
    }

    const payload = {
      items: Object.keys(items).map(function (productId) {
        return {
          productId,
          quantity: items[productId]
        };
      }),
      shippingAddress
    };

    try {
      const response = await fetch(API_BASE + "/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });

      const body = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        const errorMessage = body && body.error ? body.error : "Could not place order.";
        throw new Error(errorMessage);
      }
    } catch (error) {
      alert(error.message || "Could not place order.");
      return;
    }

    writeCartItems({});
    renderCart();
    window.dispatchEvent(new CustomEvent("ww-order-created"));
    alert("Order placed! You can review it in the admin dashboard.");
  }

  function bindCartEvents() {
    const cartItemsEl = document.getElementById("cart-items");
    const clearButton = document.getElementById("clear-cart");
    const placeOrderButton = document.getElementById("place-order");
    const shippingForm = document.getElementById("shipping-address-form");

    if (cartItemsEl) {
      cartItemsEl.addEventListener("click", function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest("button[data-action]");
        if (!button) {
          return;
        }

        const action = button.getAttribute("data-action");
        const row = button.closest(".cart-item");
        const productId = row ? row.getAttribute("data-product-id") : null;

        if (!action || !productId) {
          return;
        }

        updateQuantity(productId, action);
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        writeCartItems({});
        renderCart();
      });
    }

    if (placeOrderButton) {
      placeOrderButton.addEventListener("click", placeOrder);
    }

    if (shippingForm) {
      shippingForm.addEventListener("submit", function (event) {
        event.preventDefault();
        placeOrder();
      });
    }

    window.addEventListener("ww-auth-changed", function () {
      updateOwnerLabel();
      renderCart();
      loadSavedShippingAddress();
    });

    window.addEventListener("ww-currency-changed", function () {
      renderCart();
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    await loadProductCatalog();
    await loadSavedShippingAddress();
    updateOwnerLabel();
    renderCart();
    bindCartEvents();
  });
})();
