import React, { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
        const fetchUserProfile = async () => {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setLoading(false);
                return;
            }

            const db = getFirestore();
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                setUser({
                    displayName: userDoc.data().displayName || currentUser.displayName || '',
                    email: userDoc.data().email || currentUser.email || '',
                    photoURL: userDoc.data().photoURL || currentUser.photoURL || '',
                    bio: userDoc.data().bio || '',
                });
            } else {
                setUser({
                    displayName: currentUser.displayName || '',
                    email: currentUser.email || '',
                    photoURL: currentUser.photoURL || '',
                });
            }
            setLoading(false);
        };

        fetchUserProfile();
    }, []);

    if (loading) {
        return <div>Loading profile...</div>;
    }

    if (!user) {
        return <div>No user is signed in.</div>;
    }

    return (
        <div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
            {user.photoURL && (
                <img
                    src={user.photoURL}
                    alt="Profile"
                    style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', marginBottom: 16 }}
                />
            )}
            <h2>{user.displayName}</h2>
            <p><strong>Email:</strong> {user.email}</p>
            {user.bio && <p><strong>Bio:</strong> {user.bio}</p>}
        </div>
    );
};

export default Profile;