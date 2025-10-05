import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User, getAuth, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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

  // Load user profile
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
          setUser({
            displayName: currentUser.displayName || "Unnamed User",
            email: currentUser.email || "",
            bio: "",
            photoURL: currentUser.photoURL || "",
          });
          setNewDisplayName(currentUser.displayName || "");
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

    const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
        displayName: newDisplayName,
        bio: newBio,
    });

    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName,
        bio: newBio,
      });

      // Update local state
      setUser((prev) =>
        prev ? { ...prev, displayName: newDisplayName, bio: newBio } : { displayName: newDisplayName, email: auth.currentUser?.email || "", bio: newBio }
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

      {!editing ? (
        <>
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
              onClick={() => setEditing(true)}
              style={{
                background: "#007bff",
                color: "white",
                border: "none",
                padding: "8px 12px",
                borderRadius: 6,
                cursor: "pointer",
                marginRight: 8,
              }}
            >
              Edit Profile
            </button>
            <button
              onClick={async () => {
                try {
                  await signOut(auth);
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
        </>
      ) : (
        <>
          <h2>Edit Profile</h2>
          <div style={{ marginBottom: 12 }}>
            <label>
              <strong>Display Name</strong>
            </label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginTop: 4 }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              <strong>Bio</strong>
            </label>
            <textarea
              value={newBio}
              onChange={(e) => setNewBio(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginTop: 4, resize: "none" }}
            />
          </div>
          <button
            onClick={handleSave}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "green", color: "white", cursor: "pointer", marginRight: 8 }}
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "#f8f8f8", cursor: "pointer" }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
};

export default Profile;