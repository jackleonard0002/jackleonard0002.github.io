(function () {
  function readStorageItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function resolveApiBase() {
    const runtimeOverride = String(readStorageItem("ww_api_base") || "").trim().replace(/\/+$/, "");
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
  }

  function readStoredUser() {
    try {
      const raw = localStorage.getItem("ww_auth_user");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function readAuthToken() {
    return readStorageItem("ww_auth_token");
  }

  async function verifyServerSession(token) {
    if (!token) {
      return { ok: false, reason: "missing-token" };
    }

    try {
      const response = await fetch(resolveApiBase() + "/api/auth/session?ts=" + Date.now(), {
        cache: "no-store",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (!response.ok) {
        return { ok: false, reason: "unauthorized", status: response.status };
      }

      const payload = await response.json().catch(function () {
        return null;
      });
      return { ok: true, payload: payload };
    } catch (error) {
      return { ok: false, reason: "network" };
    }
  }

  function setStatus(message, tone) {
    const status = document.getElementById("signin-status");
    if (!status) {
      return;
    }

    status.textContent = message;
    status.setAttribute("data-tone", tone || "info");
  }

  function resolveReturnPath() {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo") || "shop.html";

    // Allow only local html targets.
    if (/^[a-z0-9-]+\.html$/i.test(returnTo)) {
      return returnTo;
    }

    return "shop.html";
  }

  async function refreshSignedInState(user) {
    const continueLink = document.getElementById("signin-continue");
    if (!continueLink) {
      return;
    }

    continueLink.href = resolveReturnPath();

    if (user && (user.displayName || user.email || user.uid)) {
      const name = user.displayName || user.email || "your account";
      setStatus("Signed in as " + name + ". Verifying server session...", "info");
      continueLink.hidden = false;

      const verification = await verifyServerSession(readAuthToken());
      if (verification.ok) {
        const isAdmin = verification.payload && verification.payload.isAdmin;
        setStatus(
          "Signed in as " + name + ". Server verified" + (isAdmin ? " (admin account)." : "."),
          "ok"
        );
      } else if (verification.reason === "network") {
        setStatus("Signed in locally, but could not reach API server. Keep localtunnel and API running.", "warn");
      } else {
        setStatus("Signed in locally, but backend rejected the token. Check Firebase Admin credentials on the API server.", "warn");
      }
      return;
    }

    setStatus("Not signed in.", "info");
    continueLink.hidden = true;
  }

  function initSignInPage() {
    if (!document.querySelector(".signin-card")) {
      return;
    }

    document.querySelectorAll("[data-signin-provider]").forEach(function (button) {
      button.addEventListener("click", function () {
        const provider = button.getAttribute("data-signin-provider") || "other";
        const labels = {
          email: "Email",
          apple: "Apple",
          github: "GitHub",
          "magic-link": "Magic Link"
        };
        const label = labels[provider] || "This";
        setStatus(label + " sign-in is available soon. For now, use Continue with Google.", "warn");
      });
    });

    refreshSignedInState(readStoredUser());
    window.addEventListener("ww-auth-changed", function (event) {
      refreshSignedInState(event.detail || null);
    });

    window.addEventListener("ww-auth-error", function (event) {
      const detail = event && event.detail ? event.detail : {};
      setStatus(detail.message || "Google sign-in failed.", "warn");
    });
  }

  document.addEventListener("DOMContentLoaded", initSignInPage);
})();
