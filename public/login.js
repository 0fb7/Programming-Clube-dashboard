import { auth, database } from "./firebase1/firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loginBtn  = document.getElementById("login-btn");
const emailInput = document.getElementById("login-email");
const passInput  = document.getElementById("login-pass");
const errorEl    = document.getElementById("login-error");

// FIX 5: pressing Enter in either input field triggers login —
// standard browser form UX that was missing entirely.
emailInput?.addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
passInput?.addEventListener("keydown",  e => { if (e.key === "Enter") handleLogin(); });

// FIX 6: guard before addEventListener so a missing element doesn't throw
loginBtn?.addEventListener("click", handleLogin);

async function handleLogin() {
  const email = emailInput?.value.trim() ?? "";

  // FIX 4: do NOT trim the password — leading/trailing spaces are valid
  // characters and trimming them causes silent auth failures for those users.
  const password = passInput?.value ?? "";

  // FIX 3: clear any previous error at the start of every attempt
  hideError();

  if (!email || !password) {
    showError("Please fill in all fields.");
    return;
  }

  // FIX 1: disable the button for the entire async operation so rapid
  // clicking cannot fire multiple simultaneous signInWithEmailAndPassword calls.
  setLoading(true);

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const userSnap = await getDoc(doc(database, "users", uid));
    if (!userSnap.exists()) {
      showError("Account profile not found. Please contact your administrator.");
      return;
    }

    const profile = { uid, ...userSnap.data() };

    // FIX 8: sessionStorage.setItem throws in some private-browsing contexts
    // (QuotaExceededError). Catch it so the user still gets redirected.
    try {
      sessionStorage.setItem("cc_user", JSON.stringify(profile));
    } catch {
      // Storage unavailable — auth succeeded so we still proceed.
      // Pages will fall back to the slow-path onAuthStateChanged.
    }

    window.location.href = "pages/overview.html";

  } catch (err) {
    console.error(err);

    const authErrors = new Set([
      "auth/user-not-found",
      "auth/wrong-password",
      "auth/invalid-credential",
      "auth/invalid-email",
    ]);

    if (authErrors.has(err.code)) {
      showError("Invalid email or password.");
    } else if (err.code === "auth/too-many-requests") {
      showError("Too many attempts. Please wait a moment and try again.");
    } else if (err.code === "auth/network-request-failed") {
      showError("Network error. Please check your connection.");
    } else {
      showError("Login failed. Please try again.");
    }
  } finally {
    // FIX 1 (cont.): always re-enable the button, even if an error was thrown
    setLoading(false);
  }
}

function setLoading(isLoading) {
  if (!loginBtn) return;
  loginBtn.disabled = isLoading;
  loginBtn.textContent = isLoading ? "Signing in…" : "Sign in";
}

function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

// FIX 3: companion to showError — called at the start of every login attempt
function hideError() {
  if (!errorEl) return;
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}