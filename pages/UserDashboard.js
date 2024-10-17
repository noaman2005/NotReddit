// pages/UserDashboard.js

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import Layout from '@/components/Layout';
import Navbar from '../components/Navbar';

export default function UserDashboard() {
    const router = useRouter();
    const { id } = router.query; // Extracting the user ID from the URL
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userStats, setUserStats] = useState({ theories: 0, followers: 0, following: 0 });
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        if (id) {
            fetchUserData(id);
            fetchUserActivities(id);
        }
    }, [id]);
    const fetchUserData = async (userId) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const data = userDoc.data();
                console.log("Full User Data:", data); // Log full user data
                
                // Check if theoriesCount is undefined
                if (data.theoriesCount === undefined) {
                    console.warn("Theories count is not defined in the user document.");
                } else {
                    console.log("Theories Count:", data.theoriesCount); // Log theories count
    
                    // Display the number of theories
                    alert(`User has ${data.theoriesCount} theories.`);
                }
    
                setUser(data);
                setUserStats({
                    theories: data.theoriesCount || 0,
                    followers: data.followersCount || 0,
                    following: data.followingCount || 0,
                    posts: data.postsCount || 0, // Retrieve the number of posts
                });
            } else {
                console.error("User does not exist");
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        } finally {
            setLoading(false);
        }
    };
    
    
    const fetchUserActivities = async (userId) => {
        try {
            const theoriesCollection = collection(db, 'theories');
            const theoriesQuery = query(theoriesCollection, orderBy('createdAt', 'desc'));
            const theoriesSnapshot = await getDocs(theoriesQuery);
    
    
            const userActivities = theoriesSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(activity => activity.userId === userId);
    
            setActivities(userActivities);
        } catch (error) {
            console.error("Error fetching user activities:", error);
        }
    };
    

    if (loading) {
        return <div>Loading...</div>; // Loading state
    }

    return (
        <Layout>
            <Navbar />
            <div className="max-w-3xl mx-auto p-4 text-white">
                {/* User Profile Section */}
                <div className="flex items-center space-x-6 mb-4">
                    <img
                        src={user?.photoURL || '/default-avatar.png'}
                        alt={user?.displayName || 'User'}
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 p-2 rounded-full"
                    />
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-semibold">{user?.displayName}</h2>
                        <p className="text-red-200 mb-2">{user?.bio || 'No bio available'}</p>
                        <div className="flex space-x-4 mb-2">
                            
                        </div>
                    </div>
                </div>
                {/* Activity Feed Section */}
                <h2 className="text-lg font-bold mb-2">Theories</h2>
                <div className="space-y-4 text-black">
                    {activities.length === 0 ? (
                        <p className="text-red-500">No theories found.</p>
                    ) : (
                        activities.map(activity => (
                            <div key={activity.id} className="p-4 bg-gray-100 rounded-lg shadow">
                                <h3 className="font-semibold">{activity.title}</h3>
                                <p>{activity.description}</p>
                                {activity.mediaUrl && (
                                    <img src={activity.mediaUrl} alt="Activity Media" className="mt-2 w-full h-auto rounded-lg" />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    );
}
