import { auth, database } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


export function requireAuth() {
  // ─── FAST PATH ────────────────────────────────────────────────────────────
  // If a profile is already cached we can resolve synchronously right now,
  // without waiting for Firebase at all. We still register a background
  // listener below to catch token expiry / remote sign-out.
  const cached = getCurrentUser();
  if (cached) {
    // Kick off a silent background verification — does NOT block the caller.
    _verifyTokenInBackground(cached);
    return Promise.resolve(cached);
  }

  // ─── COLD PATH ────────────────────────────────────────────────────────────
  // No cache — wait for Firebase to tell us who is signed in.
  return new Promise((resolve) => {
    let unsubscribe;

    unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Always unsubscribe once we have a definitive answer.
      if (unsubscribe) unsubscribe();

      if (!firebaseUser) {
        window.location.href = "../index.html";
        return;
      }

      try {
        const ref = doc(database, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await signOut(auth);
          sessionStorage.removeItem("cc_user");
          window.location.href = "../index.html";
          return;
        }

        const profile = { uid: firebaseUser.uid, ...snap.data() };

        try {
          sessionStorage.setItem("cc_user", JSON.stringify(profile));
        } catch {
          // Private-browsing / storage full — auth still succeeds.
        }

        resolve(profile);
      } catch (error) {
        console.error("Auth guard error:", error);
        window.location.href = "../index.html";
      }
    });
  });
}

/**
 * Silent background token verification.
 * Runs after the fast-path resolve so the page never blocks on it.
 * If Firebase reports the user is gone, we clear cache and redirect.
 */
function _verifyTokenInBackground(cachedProfile) {
  let unsubscribe;
  unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    if (unsubscribe) unsubscribe();          // always clean up

    if (!firebaseUser || firebaseUser.uid !== cachedProfile.uid) {
      // Token expired or user signed out in another tab.
      sessionStorage.removeItem("cc_user");
      window.location.href = "../index.html";
    }
  });
}

export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem("cc_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function logout() {
  try {
    sessionStorage.removeItem("cc_user");
    // Also wipe the firestore-service session caches on logout
    try {
      const keys = Object.keys(sessionStorage).filter(k =>
        k.startsWith("fscache_")
      );
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }

    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    window.location.href = "../index.html";
  }
}