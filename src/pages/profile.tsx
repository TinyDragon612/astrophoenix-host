import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { auth, db } from "../firebase";

interface UserProfile {
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
}

const Profile: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

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
            displayName: data.displayName || currentUser.displayName || "",
            email: data.email || currentUser.email || "",
            photoURL: data.photoURL || currentUser.photoURL || "",
            bio: data.bio || "",
          });
        } else {
          setUser({
            displayName: currentUser.displayName || "",
            email: currentUser.email || "",
            photoURL: currentUser.photoURL || "",
          });
        }
      } catch (err) {
        console.error("Error loading user data:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading profile...</div>;

  if (!user) return <div>No user is signed in.</div>;

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", padding: 24, border: "1px solid #ddd", borderRadius: 8 }}>
      {user.photoURL && (
        <img
          src={user.photoURL}
          alt="Profile"
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            objectFit: "cover",
            marginBottom: 16,
          }}
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
    </div>
  );
};

export default Profile;