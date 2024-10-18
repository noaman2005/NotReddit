import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Navbar from '../components/Navbar';

export default function SearchPage({ currentUserId }) {
    const [username, setUsername] = useState('');
    const [users, setUsers] = useState([]);
    const [suggestedUsers, setSuggestedUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const fetchUsers = async () => {
            if (username.trim() === '') {
                setUsers([]);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const usersCollection = collection(db, 'users');
                const q = query(usersCollection, where('displayName', '>=', username));
                const querySnapshot = await getDocs(q);
                const foundUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log("Found users:", foundUsers); // Log fetched users
                setUsers(foundUsers);
            } catch (err) {
                console.error("Error fetching users:", err);
                setError("An error occurred while searching for users.");
            } finally {
                setLoading(false);
            }
        };

        const debounceFetch = setTimeout(fetchUsers, 300);

        return () => clearTimeout(debounceFetch);
    }, [username]);

    const handleUserClick = (userId) => {
        router.push(`/UserDashboard?id=${userId}`);
    };

    useEffect(() => {
        const fetchSuggestedUsers = async () => {
            try {
                const usersCollection = collection(db, 'users');
                const querySnapshot = await getDocs(usersCollection);
                const allUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const filteredUsers = allUsers.filter(user => user.id !== currentUserId);
                setSuggestedUsers(filteredUsers);
            } catch (err) {
                console.error("Error fetching suggested users:", err);
            }
        };

        fetchSuggestedUsers();
    }, [currentUserId]);

    return (
        <Layout>
            <div className="max-w-3xl mx-auto p-4 ">
                <h1 className="text-2xl font-bold mb-4 text-white">Search for Users</h1>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="border rounded-3xl w-full p-4 mb-4"
                />
                {loading && <p className="text-yellow-400">Searching...</p>}
                {error && <p className="text-red-500">{error}</p>}
                <div className="mt-4">
                    {users.length > 0 ? (
                        users.map(user => (
                            <div
                                key={user.id}
                                onClick={() => handleUserClick(user.id)}
                                className="flex items-center p-4 bg-gray-800 rounded-lg mb-2 cursor-pointer hover:bg-gray-700 transition"
                            >
                                <img src={user.photoURL || '/default-avatar.png'} alt={`${user.displayName}'s avatar`} className="w-10 h-10 rounded-full mr-2" />
                                <h2 className="text-xl text-white">{user.displayName}</h2>
                            </div>
                        ))
                    ) : (
                        username && <p className="text-red-500">No users found.</p>
                    )}
                </div>

                {/* Suggested Users Section */}
                <h2 className="text-xl font-bold mt-8 text-white">Suggested Users</h2>
                <div className="mt-4">
                    {suggestedUsers.length > 0 ? (
                        suggestedUsers.map(user => (
                            <div
                                key={user.id}
                                onClick={() => handleUserClick(user.id)}
                                className="flex items-center p-3 bg-gray-100 rounded-3xl mb-2 cursor-pointer hover:bg-gray-400 transition duration-300 ease-in-out"
                            >
                                <img src={user.photoURL || '/default-avatar.png'} alt={`${user.displayName}'s avatar`} className="w-12 h-12 rounded-full border-2 border-gray-300 shadow-sm" />
                                <h2 className="text-lg font-medium text-gray-800 ml-3">{user.displayName}</h2>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500">No suggested users found.</p>
                    )}
                </div>

            </div>
        </Layout>
    );
}
