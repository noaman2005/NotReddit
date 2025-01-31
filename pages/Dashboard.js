import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Layout from '@/components/Layout';
import Navbar from '../components/Navbar';

export default function UserDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userStats, setUserStats] = useState({ theories: 0, followers: 0, following: 0 });
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!user) {
                router.push('/login');
            } else {
                setLoading(false);
                fetchUserData(user.uid);
                fetchUserActivities(user.uid);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const fetchUserData = async (userId) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                setUser(userDoc.data());
                setUserStats({
                    theories: userDoc.data().theoriesCount || 0,
                    followers: userDoc.data().followersCount || 0,
                    following: userDoc.data().followingCount || 0,
                });
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    };

    const fetchUserActivities = async (userId) => {
        try {
            const theoriesCollection = collection(db, 'theories');
            const theoriesQuery = query(theoriesCollection, orderBy('createdAt', 'desc'));
            const theoriesSnapshot = await getDocs(theoriesQuery);

            const userActivities = theoriesSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(theory => theory.userId === userId);

            setActivities(userActivities);
            setUserStats(prevStats => ({
                ...prevStats,
                theories: userActivities.length
            }));
        } catch (error) {
            console.error("Error fetching user activities:", error);
        }
    };

    const handleEditProfile = () => {
        router.push('/Edit-Profile');
    };

    const handleShareProfile = () => {
        const profileLink = `${window.location.origin}/profile/${auth.currentUser.uid}`;
        navigator.clipboard.writeText(profileLink);
        alert('Profile link copied!');
    };

    const addpost = () => {
        router.push('/theory-form');
    };

    return (
        <Layout>
            <Navbar />
            <div className="max-w-3xl mx-auto p-6 rounded-lg shadow-md">
                {/* User Profile Section */}
                <div className="flex flex-col md:flex-row items-center space-x-0 md:space-x-8 mb-6">
                    <img
                        src={user?.photoURL || '/default-avatar.png'}
                        alt={user?.displayName || 'User'}
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 rounded-full border-2 border-gray-300 mb-4 md:mb-0"
                    />
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-sans text-white">{user?.displayName}</h2>
                        <p className="text-red-300">{user?.bio || 'No bio available'}</p>
                        <div className="flex space-x-4 md:space-x-8 mt-4">
                            <div className="text-center">
                                <span className="block text-2xl font-semibold text-gray-800">{userStats.theories}</span>
                                <span className="text-gray-500 text-sm">Posts</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-2xl font-semibold text-gray-800">{userStats.followers}</span>
                                <span className="text-gray-500 text-sm">Followers</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-2xl font-semibold text-gray-800">{userStats.following}</span>
                                <span className="text-gray-500 text-sm">Following</span>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mt-6">
                            <button
                                onClick={handleEditProfile}
                                className="px-6 py-2 bg-gray-700 text-white rounded-md hover:bg-red-600 transition duration-200"
                            >
                                Edit Profile
                            </button>
                            <button
                                onClick={handleShareProfile}
                                className="px-6 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-green-200 transition duration-200"
                            >
                                Share Profile
                            </button>
                            <button
                                onClick={addpost}
                                className="p-2 text-white rounded-full hover:bg-green-600 transition duration-200"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
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
                                <h3 className="text-lg font-semibold text-gray-800">{activity.title}</h3>
                                <p className="text-gray-600">{activity.description}</p>
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
