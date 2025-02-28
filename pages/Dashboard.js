import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, getDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Layout from '@/components/Layout';
import { motion } from 'framer-motion';
import { getTimeAgo } from '@/utils/date';

export default function UserDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userStats, setUserStats] = useState({ theories: 0, followers: 0, following: 0 });
    const [activities, setActivities] = useState([]);
    const [selectedTab, setSelectedTab] = useState('theories');

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
                setUserStats(prev => ({
                    ...prev,
                    followers: userDoc.data().followersCount || 0,
                    following: userDoc.data().followingCount || 0,
                }));
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
            setUserStats(prev => ({
                ...prev,
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
        const profileLink = `${window.location.origin}/Dashboard`;
        navigator.clipboard.writeText(profileLink);
        alert('Profile link copied to clipboard!');
    };

    const addpost = () => {
        router.push('/theory-form');
    };

    const handleDeleteTheory = async (theoryId) => {
        if (!user) return;

        const confirmDelete = window.confirm('Are you sure you want to delete this theory?');
        if (!confirmDelete) return;

        try {
            await deleteDoc(doc(db, 'theories', theoryId));
            // Update local state to remove the deleted theory
            setActivities(prev => prev.filter(activity => activity.id !== theoryId));
        } catch (error) {
            console.error('Error deleting theory:', error);
            alert('Failed to delete theory');
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </Layout>
        );
    }

    const tabs = [
        { id: 'theories', label: 'Theories', count: userStats.theories },
        { id: 'followers', label: 'Followers', count: userStats.followers },
        { id: 'following', label: 'Following', count: userStats.following },
    ];

    return (
        <Layout>
            <div className="min-h-screen bg-gray-900">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    {/* Profile Header */}
                    <div className="bg-gray-800 rounded-xl p-6 mb-6 shadow-lg">
                        <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <img
                                    src={user?.photoURL || '/default-avatar.png'}
                                    alt={user?.displayName || 'User'}
                                    className="w-32 h-32 rounded-full border-4 border-purple-500 shadow-lg object-cover"
                                />
                            </motion.div>
                            
                            <div className="flex-1 text-center md:text-left">
                                <motion.h1 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-3xl font-bold text-white mb-2"
                                >
                                    {user?.displayName}
                                </motion.h1>
                                
                                <motion.p 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-gray-400 mb-4 max-w-2xl"
                                >
                                    {user?.bio || 'No bio available'}
                                </motion.p>

                                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                                    <button
                                        onClick={handleEditProfile}
                                        className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center space-x-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span>Edit Profile</span>
                                    </button>
                                    
                                    <button
                                        onClick={handleShareProfile}
                                        className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center space-x-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                        <span>Share</span>
                                    </button>

                                    <button
                                        onClick={addpost}
                                        className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span>New Theory</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Stats Tabs */}
                        <div className="mt-8 border-t border-gray-700 pt-6">
                            <div className="flex justify-around">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setSelectedTab(tab.id)}
                                        className={`flex flex-col items-center transition-colors ${
                                            selectedTab === tab.id
                                                ? 'text-purple-500'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        <span className="text-2xl font-bold">{tab.count}</span>
                                        <span className="text-sm">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Theories Feed */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activities.length === 0 ? (
                            <div className="col-span-full text-center py-12 bg-gray-800 rounded-xl">
                                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <p className="text-gray-400 text-lg">No theories yet</p>
                                <button
                                    onClick={() => router.push('/theory-form')}
                                    className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-lg hover:from-purple-700 hover:to-blue-600 transition-all duration-200 flex items-center justify-center mx-auto space-x-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>Create Your First Theory</span>
                                </button>
                            </div>
                        ) : (
                            activities.map((activity, index) => (
                                <motion.div
                                    key={activity.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1"
                                >
                                    {activity.mediaUrl ? (
                                        <div className="relative aspect-[4/3]">
                                            <img
                                                src={activity.mediaUrl}
                                                alt="Theory media"
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                    ) : (
                                        <div className="relative aspect-[4/3] bg-gradient-to-br from-purple-600/20 to-blue-500/20 flex items-center justify-center">
                                            <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-lg font-semibold text-white line-clamp-1">
                                                {activity.title || 'Untitled Theory'}
                                            </h3>
                                            <span className="text-sm text-gray-400">
                                                {getTimeAgo(activity.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-gray-300 mb-4 line-clamp-2">
                                            {activity.description}
                                        </p>
                                        <div className="mt-auto flex items-center justify-between text-gray-400 text-sm">
                                            <div className="flex items-center space-x-4">
                                                <span className="flex items-center">
                                                    <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                    </svg>
                                                    {activity.likes || 0}
                                                </span>
                                                <span className="flex items-center">
                                                    <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                    {(activity.comments?.length || 0)}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button 
                                                    className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
                                                    onClick={() => router.push(`/theory/${activity.id}`)}
                                                >
                                                    Read More
                                                </button>
                                                <button 
                                                    className="text-red-400 hover:text-red-300 transition-colors duration-200"
                                                    onClick={() => handleDeleteTheory(activity.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
