// pages/Search.js

import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Navbar from '../components/Navbar';

export default function SearchPage() {
    const [username, setUsername] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    const handleSearch = async () => {
        setLoading(true);
        setError(null); // Reset error state
        try {
            const usersCollection = collection(db, 'users');
            const q = query(usersCollection, where('displayName', '==', username));
            const querySnapshot = await getDocs(q);
            const foundUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setUsers(foundUsers);

            if (foundUsers.length === 0) {
                setError("No users found.");
            }
        } catch (err) {
            console.error("Error fetching users:", err);
            setError("An error occurred while searching for users.");
        } finally {
            setLoading(false);
        }
    };

    const handleUserClick = (userId) => {
        router.push(`/UserDashboard?id=${userId}`); // Redirect to UserDashboard with the user ID
    };

    return (
        <Layout>
            <Navbar />
            <div className="max-w-3xl mx-auto p-4 text-black">
                <h1 className="text-2xl font-bold mb-4">Search for Users</h1>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="border rounded-md p-2 mb-4"
                />
                <button onClick={handleSearch} className="bg-blue-500 text-white px-4 py-2 rounded-md">
                    Search
                </button>
                {loading && <p className="text-yellow-400">Searching...</p>}
                {error && <p className="text-red-500">{error}</p>}
                <div className="mt-4">
                    {users.length > 0 ? (
                        users.map(user => (
                            <div 
                                key={user.id} 
                                onClick={() => handleUserClick(user.id)} 
                                className="p-4 bg-gray-800 rounded-lg mb-2 cursor-pointer hover:bg-gray-700 transition"
                            >
                                <h2 className="text-xl">{user.displayName}</h2>
                                <p className="text-gray-300">{user.username}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-red-500">No users found.</p>
                    )}
                </div>
            </div>
        </Layout>
    );
}
