(function () {
  function readStoredUser() {
    try {
      const raw = localStorage.getItem("ww_auth_user");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
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

  function refreshSignedInState(user) {
    const continueLink = document.getElementById("signin-continue");
    if (!continueLink) {
      return;
    }

    continueLink.href = resolveReturnPath();

    if (user && (user.displayName || user.email || user.uid)) {
      const name = user.displayName || user.email || "your account";
      setStatus("Signed in as " + name + ".", "ok");
      continueLink.hidden = false;
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
  }

  document.addEventListener("DOMContentLoaded", initSignInPage);
})();
