import React, { useState } from "react";
import { initializeApp } from "firebase/app";
import {

getAuth,
createUserWithEmailAndPassword,
signInWithEmailAndPassword,
} from "firebase/auth";

import { setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "../firebase";

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
            await createUserWithEmailAndPassword(auth, email, password);
            alert("Account created!");
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