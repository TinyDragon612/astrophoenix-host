import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { getAuth, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

interface UserProfile {
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
}

const Profile: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newBio, setNewBio] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUser({
            displayName: data.displayName || currentUser.displayName || "Unnamed User",
            email: data.email || currentUser.email || "",
            bio: data.bio || "",
            photoURL: data.photoURL || currentUser.photoURL || "",
          });
          setNewDisplayName(data.displayName || currentUser.displayName || "");
          setNewBio(data.bio || "");
        } else {
          // fallback to auth data if Firestore doc not found
          const fallbackUser = {
            displayName: currentUser.displayName || "Unnamed User",
            email: currentUser.email || "",
            bio: "",
            photoURL: currentUser.photoURL || "",
          };
          setUser(fallbackUser);
          setNewDisplayName(fallbackUser.displayName);
          setNewBio("");
        }
      } catch (err) {
        console.error("Error loading user data:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return alert("No user logged in");

    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName,
        bio: newBio,
      });

      // Update local state
      setUser((prev) =>
        prev
          ? { ...prev, displayName: newDisplayName, bio: newBio }
          : { displayName: newDisplayName, email: auth.currentUser?.email || "", bio: newBio }
      );
      setEditing(false);
      alert("Profile updated!");
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Failed to update profile.");
    }
  };

  if (loading) return <div>Loading profile...</div>;
  if (!user) return <div>No user is signed in.</div>;

   return (
    <div
      style={{
        maxWidth: 450,
        margin: "2rem auto",
        padding: 24,
        border: "1px solid #ddd",
        borderRadius: 8,
        fontFamily: "system-ui, Segoe UI, Roboto, Arial",
      }}
    >
      {user.photoURL && (
        <img
          src={user.photoURL}
          alt="Profile"
          style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", marginBottom: 16 }}
        />
      )}
      <h2>{user.displayName || "Unnamed User"}</h2>
      <p>
        <strong>Email:</strong> {user.email}
      </p>
      {user.bio && (
        <p>
          <strong>Bio:</strong> {user.bio}
        </p>
      )}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={async () => {
            const auth = getAuth();
            try {
              await signOut(auth);
              // navigate back to root/login
              // using window.location to force app to re-evaluate auth state is also acceptable, but we'll navigate
              window.location.href = "/";
            } catch (err) {
              console.error("Error signing out:", err);
            }
          }}
          style={{
            background: "#e53935",
            color: "white",
            border: "none",
            padding: "8px 12px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;