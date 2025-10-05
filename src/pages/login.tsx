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
        alert("Logged in 🔥");
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
    <div style={{ maxWidth: 400, margin: "2rem auto", background: "#0b0b0b", padding: 24, border: "1px solid #151515", borderRadius: 8, color: '#fff', fontFamily:
        "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace" }}>
      <h2 style={{ marginTop: 0 }}>{isLogin ? "🔥Login" : "🔥Sign Up"}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", marginBottom: 12, borderRadius: 7, padding: 8, border: '1px solid #222', background: '#0b0b0b', color: '#fff' }}
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 12, borderRadius: 7, padding: 8, border: '1px solid #222', background: '#0b0b0b', color: '#fff' }}
          />
        </div>
        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}
        <button
          type="submit"
          style={{
            width: "100%",
            marginTop: 20,
            marginBottom: 20,
            padding: 12,
            background: "rgba(133,99,246,0.18)",
            border: "1px solid rgba(133,99,246,0.45)",
            borderRadius: 10,
            cursor: "pointer",
            color: "#f5ecff",
            boxShadow: "0 0 18px rgba(133,99,246,0.35)",
            backdropFilter: "blur(6px)",
            fontFamily:
              "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace",
          }}
        >
          {isLogin ? "Login" : "Sign Up"}
        </button>
      </form>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        {isLogin ? (
          <>
            Don't have an account?{" "}
            <button onClick={() => setIsLogin(false)} style={{ color: "#8563f6", background: "none", border: "none", cursor: "pointer", fontFamily:
          "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace" }}>
              Sign Up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button onClick={() => setIsLogin(true)} style={{ color: "#8563f6", background: "none", border: "none", cursor: "pointer", fontFamily:
          "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace" }}>
              Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginSignup;
