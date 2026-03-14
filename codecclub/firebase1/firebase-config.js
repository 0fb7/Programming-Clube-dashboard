
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAyE6TXFG7aV9Gk_Qk6bT2gOsws3KvzWQg",
    authDomain: "pclub-a431b.firebaseapp.com",
    databaseURL: "https://pclub-a431b-default-rtdb.firebaseio.com",
    projectId: "pclub-a431b",
    storageBucket: "pclub-a431b.firebasestorage.app",
    messagingSenderId: "245432366089",
    appId: "1:245432366089:web:a515a24ca2d37b485c34d8"
  };

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);


 