import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc,
   query, orderBy, arrayUnion, arrayRemove, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Layout from '@/components/Layout';
import Navbar from '../components/Navbar';
import { getTimeAgo } from '@/utils/date';
import { motion, AnimatePresence } from 'framer-motion';

export default function Feed() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [theories, setTheories] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState({});
  const [likeInProgress, setLikeInProgress] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    }
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/login');
      } else {
        setLoading(false);
        fetchTheories();
        fetchTrendingTopics();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchTheories = async () => {
    try {
      const theoriesCollection = collection(db, 'theories');
      const theoriesQuery = query(theoriesCollection, orderBy('createdAt', 'desc'));
      const theoriesSnapshot = await getDocs(theoriesQuery);
      const theoriesList = await Promise.all(
        theoriesSnapshot.docs.map(async (theoryDoc) => {
          const theoryData = theoryDoc.data();
          const commentsCollection = collection(db, 'theories', theoryDoc.id, 'comments');
          const commentsQuery = query(commentsCollection, orderBy('createdAt', 'desc'));
          const commentsSnapshot = await getDocs(commentsQuery);
          const theoryComments = await Promise.all(
            commentsSnapshot.docs.map(async (commentDoc) => {
              const commentData = commentDoc.data();
              const userRef = doc(db, 'users', commentData.userId);
              const userSnap = await getDoc(userRef);
              const userData = userSnap.exists() ? userSnap.data() : { displayName: 'Anonymous' };
              return {
                id: commentDoc.id,
                ...commentData,
                userDisplayName: userData?.displayName || 'User',
              };
            })
          );
          setComments((prev) => ({
            ...prev,
            [theoryDoc.id]: theoryComments,
          }));
          const userRef = doc(db, 'users', theoryData.userId);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : null;
          return {
            id: theoryDoc.id,
            ...theoryData,
            userPhotoURL: userData?.photoURL || '/default-avatar.png',
            userDisplayName: userData?.displayName || 'User',
            likes: theoryData.likes || 0,
            likedBy: theoryData.likedBy || [],
          };
        })
      );
      setTheories(theoriesList);
    } catch (error) {
      console.error("Error fetching theories:", error);
    }
  };

  const fetchTrendingTopics = async () => {
    try {
      // Get theories from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const theoriesCollection = collection(db, 'theories');
      const recentTheoriesQuery = query(
        theoriesCollection,
        where('createdAt', '>=', sevenDaysAgo),
        orderBy('createdAt', 'desc')
      );
      const theoriesSnapshot = await getDocs(recentTheoriesQuery);

      // Extract and count hashtags
      const hashtagCounts = {};
      theoriesSnapshot.docs.forEach(doc => {
        const theory = doc.data();
        const hashtags = (theory.description || '').match(/#\w+/g) || [];
        hashtags.forEach(tag => {
          hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
        });
      });

      // Sort hashtags by count and get top 5
      const sortedTrending = Object.entries(hashtagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag, count]) => ({
          tag,
          count,
          posts: theoriesSnapshot.docs.filter(doc => 
            doc.data().description?.includes(tag)
          ).length
        }));

      setTrendingTopics(sortedTrending);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Sign Out Error:", error.message);
    }
  };

  const handleLike = async (theoryId) => {
    // Prevent multiple clicks while processing
    if (likeInProgress[theoryId]) return;
    
    const currentUserId = auth.currentUser.uid;
    setLikeInProgress(prev => ({ ...prev, [theoryId]: true }));

    try {
      const theoryRef = doc(db, 'theories', theoryId);
      const theoryDoc = await getDoc(theoryRef);
      const theoryData = theoryDoc.data();
      const likedBy = Array.isArray(theoryData.likedBy) ? theoryData.likedBy : [];
      const isLiked = likedBy.includes(currentUserId);

      // Update Firestore
      await updateDoc(theoryRef, {
        likes: isLiked ? theoryData.likes - 1 : theoryData.likes + 1,
        likedBy: isLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
      });

      // Only update UI after successful Firestore update
      setTheories(prevTheories =>
        prevTheories.map(theory => {
          if (theory.id === theoryId) {
            return {
              ...theory,
              likes: isLiked ? theory.likes - 1 : theory.likes + 1,
              likedBy: isLiked 
                ? theory.likedBy.filter(id => id !== currentUserId)
                : [...theory.likedBy, currentUserId],
            };
          }
          return theory;
        })
      );
    } catch (error) {
      console.error('Error updating like:', error);
    } finally {
      setLikeInProgress(prev => ({ ...prev, [theoryId]: false }));
    }
  };

  const toggleCommentSection = (id) => {
    setActiveCommentId(activeCommentId === id ? null : id);
  };

  const handleCommentChange = (event) => {
    setCommentText(event.target.value);
  };

  const handleCommentSubmit = async (theoryId) => {
    if (!commentText) return;

    try {
      const commentRef = collection(db, 'theories', theoryId, 'comments');
      await addDoc(commentRef, {
        text: commentText,
        createdAt: new Date(),
        userId: auth.currentUser.uid,
      });
      setCommentText('');
      toggleCommentSection(theoryId);
      fetchTheories();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleShare = (theoryId) => {
    const shareUrl = `${window.location.origin}/theory/${theoryId}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => alert('Shareable link copied to clipboard: ' + shareUrl))
      .catch((error) => console.error('Error copying shareable link:', error));
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 animate-pulse">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                {theories.map((theory) => (
                  <motion.div
                    key={theory.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700"
                  >
                    {/* User Header */}
                    <div className="flex items-center p-4">
                      <img
                        src={theory.userPhotoURL}
                        alt={theory.userDisplayName}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                      />
                      <div className="ml-3">
                        <p className="text-sm font-semibold dark:text-white">
                          {theory.userDisplayName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {getTimeAgo(theory.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Media Content */}
                    {theory.mediaUrl && (
                      <div className="relative">
                        <img
                          src={theory.mediaUrl}
                          alt="Post content"
                          className="w-full aspect-auto object-cover max-h-[500px]"
                        />
                      </div>
                    )}

                    {/* Description */}
                    {theory.description && (
                      <div className="p-4">
                        <p className="text-gray-800 dark:text-gray-200">
                          {theory.description}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="p-4 border-t dark:border-gray-700">
                      <div className="flex items-center space-x-4">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleLike(theory.id)}
                          className={`flex items-center space-x-1.5 ${
                            theory.likedBy?.includes(auth.currentUser?.uid)
                              ? 'text-purple-500'
                              : 'text-gray-600 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-400'
                          }`}
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                          <span>{theory.likes}</span>
                        </motion.button>

                        <button
                          onClick={() => setActiveCommentId(activeCommentId === theory.id ? null : theory.id)}
                          className="flex items-center space-x-1.5 text-gray-600 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-400"
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                          <span>{comments[theory.id]?.length || 0}</span>
                        </button>

                        <button
                          onClick={() => handleShare(theory.id)}
                          className="flex items-center space-x-1.5 text-gray-600 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-400"
                        >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Comments Section */}
                      {activeCommentId === theory.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 space-y-4"
                        >
                          {comments[theory.id]?.map((comment) => (
                            <div
                              key={comment.id}
                              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-semibold dark:text-white">
                                  {comment.userDisplayName}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {getTimeAgo(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm mt-1 text-gray-700 dark:text-gray-300">
                                {comment.text}
                              </p>
                            </div>
                          ))}

                          <div className="flex space-x-2 mt-4">
                            <input
                              type="text"
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Add a comment..."
                              className="flex-1 rounded-lg px-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleCommentSubmit(theory.id)}
                              className="px-4 py-2 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              Post
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Trending Topics Sidebar */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4">
                  <h2 className="text-lg font-semibold mb-4 dark:text-white">Trending Topics</h2>
                  {trendingTopics.length > 0 ? (
                    <div className="space-y-4">
                      {trendingTopics.map(({ tag, count, posts }) => (
                        <motion.div
                          key={tag}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                          onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                        >
                          <div>
                            <p className="font-medium text-purple-500">{tag}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {posts} {posts === 1 ? 'post' : 'posts'}
                            </p>
                          </div>
                          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium">{count}</span>
                            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No trending topics yet
                    </p>
                  )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4">
                  <h2 className="text-lg font-semibold mb-2 dark:text-white">Create a Post</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Share your thoughts with the community
                  </p>
                  <button
                    onClick={() => router.push('/theory-form')}
                    className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Create Post
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}