import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AizaSyDkFnlWw83q6oT8T6Rg3VN6AY_KKv0adw",
  authDomain: "checkin-system-d1e02.firebaseapp.com",
  projectId: "checkin-system-d1e02",
  storageBucket: "checkin-system-d1e02.firebasestorage.app",
  messagingSenderId: "135133924046",
  appId: "1:135133924046:web:458c48b8fd238624acde9f",
  measurementId: "G-GRF5951M42"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };