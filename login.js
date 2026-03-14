import { auth, db } from "./firebase/firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const loginBtn = document.getElementById("login-btn");
const emailInput = document.getElementById("login-email");
const passInput = document.getElementById("login-pass");
const errorEl = document.getElementById("login-error");

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!email || !password) {
    showError("Please fill in all fields.");
    return;
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) {
      showError("Account profile not found in Firestore.");
      return;
    }

    const profile = { uid, ...userSnap.data() };
    sessionStorage.setItem("cc_user", JSON.stringify(profile));

    window.location.href = "pages/overview.html";
  } catch (err) {
    console.error(err);
    if (
      err.code === "auth/user-not-found" ||
      err.code === "auth/wrong-password" ||
      err.code === "auth/invalid-credential"
    ) {
      showError("Invalid email or password.");
    } else {
      showError("Login failed. Please try again.");
    }
  }
});

function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}