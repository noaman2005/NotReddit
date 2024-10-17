import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Navbar from '../components/Navbar';
import { FaUser } from 'react-icons/fa'; // Importing the user icon from react-icons

export default function SearchPage() {
    const [username, setUsername] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const fetchUsers = async () => {
            if (username.trim() === '') {
                setUsers([]); // Clear users if input is empty
                return;
            }

            setLoading(true);
            setError(null); // Reset error state
            try {
                const usersCollection = collection(db, 'users');
                const q = query(usersCollection, where('displayName', '>=', username)); // Use '>=', to allow partial matches
                const querySnapshot = await getDocs(q);
                const foundUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUsers(foundUsers);
            } catch (err) {
                console.error("Error fetching users:", err);
                setError("An error occurred while searching for users.");
            } finally {
                setLoading(false);
            }
        };

        const debounceFetch = setTimeout(fetchUsers, 300); // Debounce for better performance

        return () => clearTimeout(debounceFetch); // Cleanup the timeout on unmount
    }, [username]); // Run the effect whenever username changes

    const handleUserClick = (userId) => {
        router.push(`/UserDashboard?id=${userId}`); // Redirect to UserDashboard with the user ID
    };

    return (
        <Layout>
            <Navbar />
            <div className="max-w-3xl mx-auto p-4 bg-white">
                <h1 className="text-2xl font-bold mb-4 text-black">Search for Users</h1>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="border rounded-md p-2 mb-4"
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
                                <FaUser className="text-white mr-2" /> {/* User icon */}
                                <h2 className="text-xl text-white">{user.displayName}</h2>
                            </div>
                        ))
                    ) : (
                        username && <p className="text-red-500">No users found.</p> // Only show if username is not empty
                    )}
                </div>
            </div>
        </Layout>
    );
}
