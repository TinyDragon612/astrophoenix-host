import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User, getAuth, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
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

  try {
    const userRef = doc(db, "users", auth.currentUser.uid);

    // ✅ Use setDoc with merge: true to create or update the document
    await setDoc(
      userRef,
      {
        displayName: newDisplayName,
        bio: newBio,
      },
      { merge: true }
    );

    // Update local state
    setUser((prev) =>
      prev
        ? { ...prev, displayName: newDisplayName, bio: newBio, }
        : { displayName: newDisplayName, email: auth.currentUser?.email || "", bio: newBio }
    );

    setEditing(false);
    alert("Profile updated!");
  } catch (err: any) {
    console.error("Error updating profile:", err);
    alert(`Failed to update profile: ${err.message}`);
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
        border: "1px solid #151515",
        borderRadius: 8,
        fontFamily: "Lucida Console, Lucida Sans Typewriter, monaco, Bitstream Vera Sans Mono, monospace",
        background: "#0b0b0b",
        color: "#fff",
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
          <h2 style={{ marginTop: 0 }}>{user.displayName || "Unnamed User"}</h2>
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
                background: "rgba(255,255,255,0.05)",
                color: "#fde8ff",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "8px 12px",
                borderRadius: 10,
                cursor: "pointer",
                marginRight: 8,
                backdropFilter: "blur(6px)",
                boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
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
                background: "rgba(229,57,53,0.18)",
                color: "#ffb4b2",
                border: "1px solid rgba(229,57,53,0.45)",
                padding: "8px 12px",
                borderRadius: 10,
                cursor: "pointer",
                backdropFilter: "blur(6px)",
                boxShadow: "0 2px 12px rgba(229,57,53,0.25)",
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
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #222", marginTop: 4, background: '#0b0b0b', color: '#fff' }}
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
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #222", marginTop: 4, resize: "none", background: '#0b0b0b', color: '#fff' }}
            />
          </div>
          <button
            onClick={handleSave}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#2e8b57", color: "white", cursor: "pointer", marginRight: 8 }}
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #333", background: "#0b0b0b", color: '#fff', cursor: "pointer" }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
};

export default Profile;
