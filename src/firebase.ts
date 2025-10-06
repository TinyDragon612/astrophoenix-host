// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { setPersistence, browserLocalPersistence } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBKX0eIL-ja9zHCsgi_UwlD8JlByY96UB8",
  authDomain: "astrophoenix2-3b620.firebaseapp.com",
  databaseURL: "https://astrophoenix2-3b620-default-rtdb.firebaseio.com",
  projectId: "astrophoenix2-3b620",
  storageBucket: "astrophoenix2-3b620.firebasestorage.app",
  messagingSenderId: "335448449685",
  appId: "1:335448449685:web:05b6397db031115a75319c",
  measurementId: "G-6SPVXTY689"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);

  setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("✅ Firebase auth persistence set to local");
  })
  .catch((err) => console.error("Persistence error:", err));

setPersistence(auth, browserLocalPersistence);

import { } from 'firebase/auth';
import { } from 'firebase/storage';
import { } from 'firebase/performance';
import { } from 'firebase/analytics';
