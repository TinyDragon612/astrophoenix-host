import React, { useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBKX0eIL-ja9zHCsgi_UwlD8JlByY96UB8",
  authDomain: "astrophoenix2-3b620.firebaseapp.com",
  projectId: "astrophoenix2-3b620",
  storageBucket: "astrophoenix2-3b620.firebasestorage.app",
  messagingSenderId: "335448449685",
  appId: "1:335448449685:web:fe31fc84f0313fa075319c",
  measurementId: "G-C9M23TNWHD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const LoginSignup: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Logged in!");
      } else {
        // ✅ Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // ✅ Save user data in Firestore
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
          bio: "",
          createdAt: new Date().toISOString(),
        });

        alert("Account created and user data saved!");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", padding: 24, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>{isLogin ? "Login" : "Sign Up"}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          />
        </div>
        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
        <button type="submit" style={{ width: "100%", padding: 8 }}>
          {isLogin ? "Login" : "Sign Up"}
        </button>
      </form>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        {isLogin ? (
          <>
            Don't have an account?{" "}
            <button onClick={() => setIsLogin(false)} style={{ color: "blue", background: "none", border: "none", cursor: "pointer" }}>
              Sign Up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button onClick={() => setIsLogin(true)} style={{ color: "blue", background: "none", border: "none", cursor: "pointer" }}>
              Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginSignup;