import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        window.location.href = "../index.html";
        return;
      }

      try {
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await signOut(auth);
          sessionStorage.removeItem("cc_user");
          window.location.href = "../index.html";
          return;
        }

        const profile = {
          uid: firebaseUser.uid,
          ...snap.data()
        };

        sessionStorage.setItem("cc_user", JSON.stringify(profile));
        resolve(profile);
      } catch (error) {
        console.error("Auth guard error:", error);
        window.location.href = "../index.html";
      }
    });
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
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    window.location.href = "../index.html";
  }
}