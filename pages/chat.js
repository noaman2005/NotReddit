import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, where, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';

export default function Chat() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const dummy = useRef();
  const router = useRouter();

  // Handle user's online status
  useEffect(() => {
    if (!user) return;

    // Set user as online
    const userStatusRef = doc(db, 'status', user.uid);
    const updateOnlineStatus = async () => {
      await setDoc(userStatusRef, {
        online: true,
        lastSeen: serverTimestamp()
      });
    };

    // Set up cleanup for when user goes offline
    const setupOfflineStatus = async () => {
      await setDoc(userStatusRef, {
        online: false,
        lastSeen: serverTimestamp()
      });
    };

    updateOnlineStatus();

    // Handle page visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateOnlineStatus();
      } else {
        setupOfflineStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setupOfflineStatus();
    };
  }, [user]);

  // Check for authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch users and their online status
  useEffect(() => {
    if (!user) return;

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersArray = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (doc.id !== user.uid) {
          usersArray.push({ uid: doc.id, ...data });
        }
      });
      setUsers(usersArray);
    });

    // Listen for online status changes
    const unsubscribeStatus = onSnapshot(collection(db, 'status'), (snapshot) => {
      const onlineStatus = {};
      snapshot.forEach((doc) => {
        onlineStatus[doc.id] = doc.data().online;
      });
      setOnlineUsers(onlineStatus);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeStatus();
    };
  }, [user]);

  const selectUser = (selectedUser) => {
    if (!user) return;
    router.push(`/chat/${selectedUser.uid}`);
  };

  const filteredUsers = users.filter(userItem => 
    userItem.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="p-6 border-b dark:border-gray-700">
            <h1 className="text-2xl font-bold dark:text-white text-gray-900">Messages</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Connect with other users</p>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b dark:border-gray-700">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-gray-900 placeholder-gray-500 dark:placeholder-gray-400"
              />
              <svg
                className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* User List */}
          <div className="divide-y dark:divide-gray-700">
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No users found
              </div>
            ) : (
              filteredUsers.map((userItem) => (
                <motion.div
                  key={userItem.uid}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="p-4 flex items-center space-x-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                  onClick={() => selectUser(userItem)}
                >
                  <div className="relative">
                    <img
                      src={userItem.photoURL || '/default-avatar.png'}
                      alt={userItem.displayName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                    />
                    {onlineUsers[userItem.uid] && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {userItem.displayName}
                      </h2>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {onlineUsers[userItem.uid] ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {userItem.status || 'No status'}
                    </p>
                  </div>
                  <svg
                    className="h-5 w-5 text-gray-400 dark:text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
