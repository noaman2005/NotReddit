import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { db } from '../lib/firebase';
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
                setUser(data);
                setUserStats({
                    theories: data.theoriesCount || 0,
                    followers: data.followersCount || 0,
                    following: data.followingCount || 0,
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

    const selectUser = () => {
        if (!user) return;
        router.push(`/chat/${user.uid}`); // Navigate to chat room
    };

    const handleShareProfile = () => {
        const profileLink = `${window.location.origin}/profile/${user.uid}`;
        navigator.clipboard.writeText(profileLink);
        alert('Profile link copied!'); // Alert the user
    };

    if (loading) {
        return <div>Loading...</div>; // Loading state
    }

    return (
        <Layout>
            <Navbar />
            <div className="max-w-3xl mx-auto p-6 rounded-lg  shadow-md text-white">
                {/* User Profile Section */}
                <div className="flex flex-col md:flex-row items-center space-x-0 md:space-x-8 mb-6">
                    <img
                        src={user?.photoURL || '/default-avatar.png'}
                        alt={user?.displayName || 'User'}
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 rounded-full border-2 border-gray-300 mb-4 md:mb-0"
                    />
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-semibold">{user?.displayName}</h2>
                        <p className="text-red-300">{user?.bio || 'No bio available'}</p>
                        <div className="flex space-x-4 md:space-x-4 mt-4">
                            <button
                                onClick={selectUser}
                                className="px-6 py-2 bg-gray-700 text-white rounded-md hover:bg-blue-600 transition duration-200"
                            >
                                Message
                            </button>
                            <button
                                onClick={handleShareProfile}
                                className="px-6 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-green-200 transition duration-200"
                            >
                                Share Profile
                            </button>
                        </div>
                    </div>
                </div>
                {/* Activity Feed Section */}
                <h2 className="text-2xl font-bold text-green-200 mb-4">Theories</h2>
                <div className="space-y-6">
                    {activities.length === 0 ? (
                        <p className="text-red-500">No theories found.</p>
                    ) : (
                        activities.map(activity => (
                            <div key={activity.id} className="p-4 bg-gradient-to-b from-red-300 to-green-400 rounded-lg shadow-md">
                                <h3 className="text-lg font-semibold">{activity.title}</h3>
                                <p>{activity.description}</p>
                                {activity.mediaUrl && (
                                    <img
                                        src={activity.mediaUrl}
                                        alt="Activity Media"
                                        className="mt-4 w-full h-auto rounded-lg"
                                    />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    );
}
