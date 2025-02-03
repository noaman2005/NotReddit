import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { getTimeAgo } from '@/utils/date';
import { motion } from 'framer-motion';

export default function SearchPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState('users'); // 'users' or 'posts'
    const [users, setUsers] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        // Get search term from URL query
        const { q } = router.query;
        if (q) {
            setSearchTerm(q);
            // If it starts with #, switch to posts search
            if (q.startsWith('#')) {
                setSearchType('posts');
            }
        }
    }, [router.query]);

    useEffect(() => {
        const search = async () => {
            if (searchTerm.trim() === '') {
                setUsers([]);
                setPosts([]);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                if (searchType === 'posts') {
                    await searchPosts();
                } else {
                    await searchUsers();
                }
            } catch (err) {
                console.error("Error searching:", err);
                setError("An error occurred while searching.");
            } finally {
                setLoading(false);
            }
        };

        const debounceFetch = setTimeout(search, 300);
        return () => clearTimeout(debounceFetch);
    }, [searchTerm, searchType]);

    const searchUsers = async () => {
        const usersCollection = collection(db, 'users');
        const q = query(usersCollection, limit(50));
        const querySnapshot = await getDocs(q);

        const allUsers = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const searchTermLower = searchTerm.toLowerCase();
        const filteredUsers = allUsers.filter(user =>
            user.displayName?.toLowerCase().includes(searchTermLower)
        );

        setUsers(filteredUsers.slice(0, ITEMS_PER_PAGE));
    };

    const searchPosts = async () => {
        const theoriesCollection = collection(db, 'theories');
        const q = query(
            theoriesCollection,
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        const theoriesSnapshot = await getDocs(q);

        const theoriesList = await Promise.all(
            theoriesSnapshot.docs.map(async (theoryDoc) => {
                const theoryData = theoryDoc.data();
                const userRef = doc(db, 'users', theoryData.userId);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : null;

                return {
                    id: theoryDoc.id,
                    ...theoryData,
                    userPhotoURL: userData?.photoURL || '/default-avatar.png',
                    userDisplayName: userData?.displayName || 'User',
                };
            })
        );

        // Filter posts based on search term
        const searchTermLower = searchTerm.toLowerCase().replace('#', '');
        const filteredPosts = theoriesList.filter(post =>
            post.description?.toLowerCase().includes(searchTermLower)
        );

        setPosts(filteredPosts);
    };

    const handleUserClick = (userId) => {
        router.push(`/UserDashboard?id=${userId}`);
    };

    return (
        <Layout>
            <div className="min-h-screen bg-gray-900">
                <div className="max-w-4xl mx-auto px-4 py-8">
                    {/* Search Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            {searchType === 'posts' ? 'Search Posts' : 'Find People'}
                        </h1>
                        <p className="text-gray-400 mt-2">
                            {searchType === 'posts' 
                                ? 'Discover posts and conversations' 
                                : 'Connect with others in the community'}
                        </p>
                    </div>

                    {/* Search Type Toggle */}
                    <div className="flex justify-center mb-6">
                        <div className="flex space-x-2 bg-gray-800 p-1 rounded-lg">
                            <button
                                onClick={() => setSearchType('users')}
                                className={`px-4 py-2 rounded-md transition-colors ${
                                    searchType === 'users'
                                        ? 'bg-purple-500 text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Users
                            </button>
                            <button
                                onClick={() => setSearchType('posts')}
                                className={`px-4 py-2 rounded-md transition-colors ${
                                    searchType === 'posts'
                                        ? 'bg-purple-500 text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                Posts
                            </button>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative mb-8">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={searchType === 'posts' ? "Search posts or hashtags..." : "Search by username..."}
                            className="w-full px-6 py-4 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    {/* Search Results */}
                    {searchType === 'users' ? (
                        // Users Results
                        <div className="space-y-4">
                            {users.map(user => (
                                <motion.div
                                    key={user.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => handleUserClick(user.id)}
                                    className="flex items-center p-4 bg-gray-800 rounded-xl cursor-pointer transform transition-all duration-200 hover:scale-[1.02] hover:bg-gray-700"
                                >
                                    <img
                                        src={user.photoURL || '/default-avatar.png'}
                                        alt={`${user.displayName}'s avatar`}
                                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-700"
                                    />
                                    <div className="ml-4 flex-1">
                                        <h2 className="text-lg font-medium text-white">{user.displayName}</h2>
                                        {user.bio && (
                                            <p className="text-sm text-gray-400 line-clamp-1">{user.bio}</p>
                                        )}
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </motion.div>
                            ))}
                            {users.length === 0 && !loading && searchTerm && (
                                <p className="text-center text-gray-400 py-8">No users found</p>
                            )}
                        </div>
                    ) : (
                        // Posts Results
                        <div className="space-y-6">
                            {posts.map(post => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-gray-800 rounded-xl p-4 shadow-lg"
                                >
                                    <div className="flex items-center mb-4">
                                        <img
                                            src={post.userPhotoURL}
                                            alt={post.userDisplayName}
                                            className="w-10 h-10 rounded-full object-cover border border-gray-700"
                                        />
                                        <div className="ml-3">
                                            <p className="text-white font-medium">{post.userDisplayName}</p>
                                            <p className="text-sm text-gray-400">{getTimeAgo(post.createdAt)}</p>
                                        </div>
                                    </div>
                                    {post.mediaUrl && (
                                        <img
                                            src={post.mediaUrl}
                                            alt="Post content"
                                            className="w-full rounded-lg mb-4 object-cover max-h-[300px]"
                                        />
                                    )}
                                    <p className="text-gray-200 whitespace-pre-wrap">{post.description}</p>
                                    <div className="flex items-center mt-4 text-gray-400">
                                        <span className="flex items-center">
                                            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                            {post.likes || 0}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                            {posts.length === 0 && !loading && searchTerm && (
                                <p className="text-center text-gray-400 py-8">No posts found</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
