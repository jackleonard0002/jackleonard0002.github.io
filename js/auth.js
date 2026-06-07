import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onIdTokenChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7MWCEXrM5AgLrwrD1GpZBIDXGp1-hptk",
  authDomain: "whimsical-wands.firebaseapp.com",
  projectId: "whimsical-wands",
  storageBucket: "whimsical-wands.firebasestorage.app",
  messagingSenderId: "287897165215",
  appId: "1:287897165215:web:69d252db149a58fc5331aa",
  measurementId: "G-0W9L4L8PGD"
};

const AUTH_USER_KEY = "ww_auth_user";
const AUTH_TOKEN_KEY = "ww_auth_token";

function syncStoredUser(user, token) {
  try {
    if (user) {
      localStorage.setItem(
        AUTH_USER_KEY,
        JSON.stringify({
          uid: user.uid,
          displayName: user.displayName || "",
          email: user.email || "",
          photoURL: user.photoURL || ""
        })
      );

      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      }
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (error) {
    // Ignore storage failures; auth UI should still work.
  }

  window.dispatchEvent(new CustomEvent("ww-auth-changed", { detail: user || null }));
}

function hasFirebaseConfig(config) {
  return Object.values(config).every(function (value) {
    return typeof value === "string" && value.trim() !== "" && !value.startsWith("REPLACE_WITH_");
  });
}

function getFriendlyAuthErrorMessage(error) {
  const code = String(error && error.code || "").toLowerCase();

  if (code === "auth/unauthorized-domain") {
    return "Google sign-in is blocked for this site domain. Add this domain in Firebase Authentication > Settings > Authorized domains.";
  }

  if (code === "auth/popup-blocked") {
    return "Your browser blocked the Google popup. Allow popups for this site and try again.";
  }

  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in popup was closed before completing sign-in.";
  }

  if (code === "auth/operation-not-allowed") {
    return "Google sign-in is not enabled in Firebase Authentication for this project.";
  }

  return "Google sign-in failed. Check browser console for details.";
}

function applyLoggedOutUI(elements, disabledMessage) {
  elements.signInLinks.forEach(function (link) {
    link.hidden = false;
  });

  if (elements.loginButton) {
    elements.loginButton.hidden = false;

    if (disabledMessage) {
      elements.loginButton.textContent = disabledMessage;
      elements.loginButton.disabled = true;
    } else {
      elements.loginButton.textContent = "Continue with Google";
      elements.loginButton.disabled = false;
    }
  }

  if (elements.logoutButton) {
    elements.logoutButton.hidden = true;
  }

  if (elements.userChip) {
    elements.userChip.hidden = true;
  }
}

function applyLoggedInUI(elements, user) {
  const displayName = user.displayName || user.email || "Signed in";

  elements.signInLinks.forEach(function (link) {
    link.hidden = true;
  });

  if (elements.userName) {
    elements.userName.textContent = displayName;
  }

  if (elements.userAvatar) {
    if (user.photoURL) {
      elements.userAvatar.src = user.photoURL;
      elements.userAvatar.hidden = false;
    } else {
      elements.userAvatar.removeAttribute("src");
      elements.userAvatar.hidden = true;
    }
  }

  if (elements.loginButton) {
    elements.loginButton.hidden = true;
  }

  if (elements.logoutButton) {
    elements.logoutButton.hidden = false;
  }

  if (elements.userChip) {
    elements.userChip.hidden = false;
  }
}

function initGoogleAuth() {
  const loginButton = document.getElementById("google-login-button");
  const logoutButton = document.getElementById("google-logout-button");
  const userChip = document.getElementById("user-chip");
  const userName = document.getElementById("user-name");
  const userAvatar = document.getElementById("user-avatar");
  const signInLinks = Array.from(document.querySelectorAll(".sign-in-link"));

  if (!loginButton && !logoutButton && !userChip && signInLinks.length === 0) {
    return;
  }

  const elements = {
    loginButton,
    logoutButton,
    userChip,
    userName,
    userAvatar,
    signInLinks
  };

  if (!hasFirebaseConfig(firebaseConfig)) {
    applyLoggedOutUI(elements, "Google login not configured");
    syncStoredUser(null, null);
    console.warn("Firebase Auth is not configured. Update js/auth.js with your Firebase web app config.");
    return;
  }

  if (location.protocol === "file:") {
    applyLoggedOutUI(elements, "Run on localhost for Google login");
    syncStoredUser(null, null);
    console.warn("Google sign-in requires localhost or a hosted domain, not file:// pages.");
    return;
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  if (loginButton) {
    loginButton.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("Google sign-in failed", error);
        const message = getFriendlyAuthErrorMessage(error);
        window.dispatchEvent(new CustomEvent("ww-auth-error", { detail: { code: error && error.code, message } }));
        alert(message);
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Sign-out failed", error);
        alert("Sign-out failed. Check console for details.");
      }
    });
  }

  onIdTokenChanged(auth, async function (user) {
    const token = user ? await user.getIdToken() : null;
    syncStoredUser(user, token);

    if (user) {
      applyLoggedInUI(elements, user);
      return;
    }

    applyLoggedOutUI(elements);
  });
}

document.addEventListener("DOMContentLoaded", initGoogleAuth);
