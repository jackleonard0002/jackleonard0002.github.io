(function () {
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
      return "https://deputy-barrier-gratuit-weight.trycloudflare.com";
    }

    return hasLocation
      ? protocol + "//" + hostname + ":8787"
      : "http://localhost:8787";
  })();

  function formatCurrency(value) {
    if (window.WW_CURRENCY && typeof window.WW_CURRENCY.formatFromBase === "function") {
      return window.WW_CURRENCY.formatFromBase(value);
    }

    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP"
    }).format(Number(value) || 0);
  }

  function getFallbackProducts() {
    return Array.isArray(window.WW_PRODUCTS) ? window.WW_PRODUCTS : [];
  }

  async function getProducts() {
    try {
      const response = await fetch(API_BASE + "/api/products");
      if (!response.ok) {
        throw new Error("Failed to load products");
      }

      const payload = await response.json();
      if (payload && Array.isArray(payload.products)) {
        return payload.products;
      }

      return getFallbackProducts();
    } catch (error) {
      return getFallbackProducts();
    }
  }

  function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get("id") || "").trim();
    if (fromQuery) {
      return fromQuery;
    }

    const hash = String(window.location.hash || "").replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    const fromHash = (hashParams.get("id") || "").trim();
    if (fromHash) {
      return fromHash;
    }

    const pathname = String(window.location.pathname || "");
    const segmentMatch = pathname.match(/\/product(?:\.html)?\/?([^/?#]+)/i);
    return segmentMatch && segmentMatch[1] ? decodeURIComponent(segmentMatch[1]).trim() : "";
  }

  function getImages(product) {
    if (Array.isArray(product.images) && product.images.length) {
      return product.images;
    }

    if (typeof product.image === "string" && product.image.trim()) {
      return [product.image.trim()];
    }

    return ["assets/images/wand-emberleaf.jpg"];
  }

  function renderMissingProduct(detailEl) {
    detailEl.innerHTML = [
      '<p class="empty-cart">Sorry, this product could not be found.</p>',
      '<p><a class="auth-btn" href="shop.html">Return to shop</a></p>'
    ].join("");
  }

  function renderProduct(detailEl, product) {
    const images = getImages(product);
    const alt = product.alt || product.name;
    const primaryImage = images[0];

    detailEl.innerHTML = [
      '<article class="product-detail-layout">',
      '  <div class="product-gallery">',
      '    <img id="product-primary-image" class="product-primary-image" src="' + primaryImage + '" alt="' + alt + '" />',
      '    <div class="product-thumbs" role="list" aria-label="Product images">',
      images.map(function (image, index) {
        const active = index === 0 ? " is-active" : "";
        return '<button class="product-thumb' + active + '" type="button" data-image="' + image + '" data-alt="' + alt + '" aria-label="View image ' + (index + 1) + '"><img src="' + image + '" alt="' + alt + '" /></button>';
      }).join(""),
      '    </div>',
      '  </div>',
      '  <div class="product-info">',
      '    <p class="eyebrow">' + product.category + '</p>',
      '    <h1>' + product.name + '</h1>',
      '    <p class="product-price">' + formatCurrency(product.price) + '</p>',
      '    <p>' + product.description + '</p>',
      '    <ul class="product-meta-list">',
      '      <li><strong>Product ID:</strong> ' + product.id + '</li>',
      '      <li><strong>Images:</strong> ' + images.length + '</li>',
      '    </ul>',
      '    <div class="hero-actions">',
      '      <button class="add-cart btn btn-primary" data-product-id="' + product.id + '">Add to cart</button>',
      '      <a class="btn btn-ghost" href="shop.html">Continue shopping</a>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join("");

    detailEl.addEventListener("click", function (event) {
      const button = event.target.closest(".product-thumb");
      if (!button) {
        return;
      }

      const image = button.getAttribute("data-image");
      const nextAlt = button.getAttribute("data-alt") || alt;
      const primary = detailEl.querySelector("#product-primary-image");
      if (primary && image) {
        primary.src = image;
        primary.alt = nextAlt;
      }

      detailEl.querySelectorAll(".product-thumb").forEach(function (thumb) {
        thumb.classList.remove("is-active");
      });
      button.classList.add("is-active");
    });
  }

  async function initProductPage() {
    const detailEl = document.getElementById("product-detail");
    if (!detailEl) {
      return;
    }

    const productId = getProductIdFromUrl();
    if (!productId) {
      renderMissingProduct(detailEl);
      return;
    }

    const products = await getProducts();
    const product = products.find(function (item) {
      return item.id === productId;
    });

    if (!product) {
      renderMissingProduct(detailEl);
      return;
    }

    renderProduct(detailEl, product);
  }

  document.addEventListener("DOMContentLoaded", initProductPage);
})();
