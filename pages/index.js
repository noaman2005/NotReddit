import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase'; // Firebase config
import Login from './login'; // Login component
import Feed from './feet'; // Feed component
import Layout from '../components/Layout'; // Import Layout component

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Loading state

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user); // Set user state based on auth state
      setLoading(false); // Stop loading after checking auth state
    });

    return () => unsubscribe(); // Clean up the subscription
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-2xl font-bold text-gray-800 dark:text-white">Loading...</div>
        </div>
      </Layout>
    ); // Show loading indicator
  }

  return (
    <Layout>
      {user ? <Feed /> : <Login />} {/* Render Feed or Login based on auth state */}
    </Layout>
  );
}
