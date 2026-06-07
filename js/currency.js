(function () {
  const BASE_CURRENCY = "GBP";
  const PREFERENCE_KEY = "ww_view_currency";
  const RATES_KEY = "ww_currency_rates";
  const RATES_FETCHED_AT_KEY = "ww_currency_rates_fetched_at";
  const RATES_TTL_MS = 6 * 60 * 60 * 1000;
  const SUPPORTED_CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD"];
  const CURRENCY_LOCALES = {
    GBP: "en-GB",
    USD: "en-US",
    EUR: "de-DE",
    CAD: "en-CA",
    AUD: "en-AU"
  };

  let selectedCurrency = BASE_CURRENCY;
  let exchangeRates = { GBP: 1 };

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
      // Ignore storage write errors.
    }
  }

  function normalizeCurrency(value) {
    const code = String(value || "").toUpperCase().trim();
    if (!SUPPORTED_CURRENCIES.includes(code)) {
      return BASE_CURRENCY;
    }

    return code;
  }

  function loadSelectedCurrency() {
    selectedCurrency = normalizeCurrency(readStorageItem(PREFERENCE_KEY));
  }

  function loadCachedRates() {
    const rawRates = readStorageItem(RATES_KEY);
    if (!rawRates) {
      exchangeRates = { GBP: 1 };
      return;
    }

    try {
      const parsed = JSON.parse(rawRates);
      if (parsed && typeof parsed === "object") {
        exchangeRates = { GBP: 1, ...parsed };
        return;
      }
    } catch (error) {
      // ignore malformed cache
    }

    exchangeRates = { GBP: 1 };
  }

  function hasFreshRates() {
    const fetchedAt = Number(readStorageItem(RATES_FETCHED_AT_KEY) || 0);
    if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) {
      return false;
    }

    return Date.now() - fetchedAt < RATES_TTL_MS;
  }

  function extractRatesFromPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (payload.rates && typeof payload.rates === "object") {
      return payload.rates;
    }

    if (payload.conversion_rates && typeof payload.conversion_rates === "object") {
      return payload.conversion_rates;
    }

    return null;
  }

  async function fetchLatestRates() {
    const endpoints = [
      "https://open.er-api.com/v6/latest/GBP",
      "https://api.exchangerate-api.com/v4/latest/GBP"
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          continue;
        }

        const payload = await response.json();
        const rates = extractRatesFromPayload(payload);
        if (!rates) {
          continue;
        }

        exchangeRates = { GBP: 1, ...rates };
        writeStorageItem(RATES_KEY, JSON.stringify(exchangeRates));
        writeStorageItem(RATES_FETCHED_AT_KEY, String(Date.now()));
        return;
      } catch (error) {
        // Try the next service.
      }
    }

    throw new Error("No exchange-rate service available");
  }

  async function ensureRates() {
    loadCachedRates();

    if (hasFreshRates()) {
      return;
    }

    try {
      await fetchLatestRates();
    } catch (error) {
      // Keep cached or default rates if service is unavailable.
    }
  }

  function convertFromBase(value, targetCurrency) {
    const safeCurrency = normalizeCurrency(targetCurrency || selectedCurrency);
    const amount = Number(value) || 0;
    const rate = Number(exchangeRates[safeCurrency]);

    if (!Number.isFinite(rate) || rate <= 0) {
      return amount;
    }

    return amount * rate;
  }

  function formatValue(value, targetCurrency) {
    const safeCurrency = normalizeCurrency(targetCurrency || selectedCurrency);
    const locale = CURRENCY_LOCALES[safeCurrency] || "en-GB";
    const convertedValue = convertFromBase(value, safeCurrency);

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCurrency
    }).format(convertedValue);
  }

  function renderStaticMoney() {
    const priceNodes = document.querySelectorAll("[data-base-price]");
    priceNodes.forEach(function (node) {
      const raw = node.getAttribute("data-base-price");
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        return;
      }

      node.textContent = formatValue(value);
    });
  }

  function emitCurrencyChange() {
    window.dispatchEvent(new CustomEvent("ww-currency-changed", {
      detail: {
        currency: selectedCurrency,
        rates: exchangeRates
      }
    }));
  }

  function applyCurrencySelection(currency) {
    const next = normalizeCurrency(currency);
    if (next === selectedCurrency) {
      return;
    }

    selectedCurrency = next;
    writeStorageItem(PREFERENCE_KEY, selectedCurrency);
    renderStaticMoney();
    emitCurrencyChange();
  }

  function createCurrencyControl() {
    const settingsSlot = document.getElementById("settings-currency-slot");
    if (!settingsSlot) {
      return;
    }

    const existingSelector = document.getElementById("currency-selector");
    if (existingSelector) {
      const existingWrapper = existingSelector.closest(".currency-switcher");
      if (existingWrapper && existingWrapper.parentElement !== settingsSlot) {
        settingsSlot.appendChild(existingWrapper);
      }
      return;
    }

    const label = document.createElement("label");
    label.className = "currency-switcher";
    label.setAttribute("for", "currency-selector");
    label.textContent = "Currency";

    const select = document.createElement("select");
    select.id = "currency-selector";
    select.className = "currency-select";
    select.setAttribute("aria-label", "Select display currency");

    SUPPORTED_CURRENCIES.forEach(function (currencyCode) {
      const option = document.createElement("option");
      option.value = currencyCode;
      option.textContent = currencyCode;
      if (currencyCode === selectedCurrency) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener("change", function () {
      applyCurrencySelection(select.value);
    });

    label.appendChild(select);
    settingsSlot.appendChild(label);
  }

  function getCurrency() {
    return selectedCurrency;
  }

  window.WW_CURRENCY = {
    baseCurrency: BASE_CURRENCY,
    supportedCurrencies: SUPPORTED_CURRENCIES.slice(),
    getCurrency,
    setCurrency: applyCurrencySelection,
    convertFromBase,
    formatFromBase: formatValue,
    refreshRates: ensureRates
  };

  async function init() {
    loadSelectedCurrency();
    await ensureRates();
    createCurrencyControl();
    renderStaticMoney();
    emitCurrencyChange();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
