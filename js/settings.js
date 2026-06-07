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
      return "https://true-experts-trade.loca.lt";
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

  function setAddressStatus(message, tone) {
    const status = document.getElementById("settings-address-status");
    if (!status) {
      return;
    }

    status.textContent = message;
    status.setAttribute("data-tone", tone || "info");
  }

  function setAddressFormEnabled(isEnabled) {
    const form = document.getElementById("settings-address-form");
    if (!form) {
      return;
    }

    form.querySelectorAll("input, textarea, button[type='submit']").forEach(function (field) {
      field.disabled = !isEnabled;
    });
  }

  function readAddressFromForm() {
    return {
      fullName: (document.getElementById("shipping-full-name") || {}).value ? document.getElementById("shipping-full-name").value.trim() : "",
      email: (document.getElementById("shipping-email") || {}).value ? document.getElementById("shipping-email").value.trim() : "",
      phone: (document.getElementById("shipping-phone") || {}).value ? document.getElementById("shipping-phone").value.trim() : "",
      line1: (document.getElementById("shipping-line1") || {}).value ? document.getElementById("shipping-line1").value.trim() : "",
      line2: (document.getElementById("shipping-line2") || {}).value ? document.getElementById("shipping-line2").value.trim() : "",
      city: (document.getElementById("shipping-city") || {}).value ? document.getElementById("shipping-city").value.trim() : "",
      region: (document.getElementById("shipping-region") || {}).value ? document.getElementById("shipping-region").value.trim() : "",
      postalCode: (document.getElementById("shipping-postal-code") || {}).value ? document.getElementById("shipping-postal-code").value.trim() : "",
      country: (document.getElementById("shipping-country") || {}).value ? document.getElementById("shipping-country").value.trim() : "",
      deliveryNote: (document.getElementById("shipping-delivery-note") || {}).value ? document.getElementById("shipping-delivery-note").value.trim() : ""
    };
  }

  function writeAddressToForm(address) {
    if (!address || typeof address !== "object") {
      return;
    }

    const fields = {
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

    Object.keys(fields).forEach(function (key) {
      const input = document.getElementById(fields[key]);
      if (input) {
        input.value = address[key] || "";
      }
    });
  }

  function validateRequiredAddress(address) {
    return Boolean(
      address.fullName &&
      address.line1 &&
      address.city &&
      address.region &&
      address.postalCode &&
      address.country
    );
  }

  async function loadSavedAddress() {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    try {
      const response = await fetch(API_BASE + "/api/me/address?ts=" + Date.now(), {
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      if (payload && payload.shippingAddress) {
        writeAddressToForm(payload.shippingAddress);
        setAddressStatus("Saved address loaded.", "ok");
      }
    } catch (error) {
      setAddressStatus("Could not load saved address right now.", "warn");
    }
  }

  async function saveAddress(event) {
    event.preventDefault();

    const token = getAuthToken();
    if (!token) {
      setAddressStatus("Sign in to save your address.", "warn");
      return;
    }

    const address = readAddressFromForm();
    if (!validateRequiredAddress(address)) {
      setAddressStatus("Please complete all required address fields.", "warn");
      return;
    }

    try {
      const response = await fetch(API_BASE + "/api/me/address", {
        method: "PUT",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(address)
      });

      if (!response.ok) {
        const body = await response.json().catch(function () {
          return {};
        });
        throw new Error(body && body.error ? body.error : "Could not save address.");
      }

      setAddressStatus("Address saved.", "ok");
    } catch (error) {
      setAddressStatus(error.message || "Could not save address.", "warn");
    }
  }

  function syncAddressUiWithAuth() {
    const user = getStoredUser();
    const token = getAuthToken();

    if (!user || !token) {
      setAddressFormEnabled(false);
      setAddressStatus("Sign in to load and save your address.", "info");
      return;
    }

    setAddressFormEnabled(true);
    const label = user.displayName || user.email || "your account";
    setAddressStatus("Managing address for " + label + ".", "info");
    loadSavedAddress();
  }

  function initSettingsPage() {
    const form = document.getElementById("settings-address-form");
    if (!form) {
      return;
    }

    form.addEventListener("submit", saveAddress);
    syncAddressUiWithAuth();

    window.addEventListener("ww-auth-changed", function () {
      syncAddressUiWithAuth();
    });
  }

  document.addEventListener("DOMContentLoaded", initSettingsPage);
})();
