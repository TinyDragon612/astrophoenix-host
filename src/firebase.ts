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
  projectId: "astrophoenix2-3b620",
  storageBucket: "astrophoenix2-3b620.firebasestorage.app",
  messagingSenderId: "335448449685",
  appId: "1:335448449685:web:fe31fc84f0313fa075319c",
  measurementId: "G-C9M23TNWHD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // Now auth state persists across refresh
  })
  .catch((error) => {
    console.error("Failed to set persistence:", error);
  });

setPersistence(auth, browserLocalPersistence);

import { } from 'firebase/auth';
import { } from 'firebase/storage';
import { } from 'firebase/performance';
import { } from 'firebase/analytics';