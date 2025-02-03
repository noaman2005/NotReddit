import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Layout from '@/components/Layout';

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

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-3xl mx-auto p-6 rounded-lg shadow-md dark:bg-gray-800 bg-white mt-8">
                {/* User Profile Section */}
                <div className="flex flex-col md:flex-row items-center space-x-0 md:space-x-8 mb-6">
                    <img
                        src={user?.photoURL || '/default-avatar.png'}
                        alt={user?.displayName || 'User'}
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 rounded-full border-2 border-gray-300 mb-4 md:mb-0"
                    />
                    <div className="flex flex-col">
                        <h2 className="text-3xl font-sans dark:text-white text-gray-900">{user?.displayName}</h2>
                        <p className="dark:text-gray-300 text-gray-600">{user?.bio || 'No bio available'}</p>
                        <div className="flex space-x-4 md:space-x-8 mt-4">
                            <div className="text-center">
                                <span className="block text-2xl font-semibold dark:text-white text-gray-900">{userStats.theories}</span>
                                <span className="dark:text-gray-400 text-gray-600 text-sm">Posts</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-2xl font-semibold dark:text-white text-gray-900">{userStats.followers}</span>
                                <span className="dark:text-gray-400 text-gray-600 text-sm">Followers</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-2xl font-semibold dark:text-white text-gray-900">{userStats.following}</span>
                                <span className="dark:text-gray-400 text-gray-600 text-sm">Following</span>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mt-6">
                            <button
                                onClick={handleEditProfile}
                                className="px-6 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition duration-200"
                            >
                                Edit Profile
                            </button>
                            <button
                                onClick={handleShareProfile}
                                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                            >
                                Share Profile
                            </button>
                            <button
                                onClick={addpost}
                                className="p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition duration-200"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                {/* Activity Feed Section */}
                <h2 className="text-2xl font-bold dark:text-white text-gray-900 mb-4">Theories</h2>
                <div className="space-y-6">
                    {activities.length === 0 ? (
                        <p className="dark:text-gray-300 text-gray-600">No theories found.</p>
                    ) : (
                        activities.map(activity => (
                            <div key={activity.id} className="p-4 bg-white dark:bg-gray-700 rounded-lg shadow-md">
                                <h3 className="text-lg font-semibold dark:text-white text-gray-900">{activity.title}</h3>
                                <p className="dark:text-gray-300 text-gray-600">{activity.description}</p>
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
