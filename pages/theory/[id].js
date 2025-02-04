import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import Layout from '../../components/Layout';
import { motion } from 'framer-motion';
import { getTimeAgo } from '../../utils/helpers';

export default function TheoryDetail() {
    const router = useRouter();
    const { id } = router.query;
    const [user] = useAuthState(auth);
    const [theory, setTheory] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) return;

        const fetchTheory = async () => {
            try {
                const theoryDoc = await getDoc(doc(db, 'theories', id));
                if (theoryDoc.exists()) {
                    const theoryData = theoryDoc.data();
                    setTheory({ 
                        id: theoryDoc.id, 
                        ...theoryData,
                        likes: Array.isArray(theoryData.likes) ? theoryData.likes : []
                    });
                } else {
                    setError('Theory not found');
                }
            } catch (err) {
                setError('Error fetching theory');
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        };

        // Listen to comments in real-time
        const commentsQuery = query(
            collection(db, 'theories', id, 'comments'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setComments(commentsData);
        });

        fetchTheory();
        return () => unsubscribe();
    }, [id]);

    const handleLike = async () => {
        if (!user) {
            router.push('/login');
            return;
        }

        try {
            const theoryRef = doc(db, 'theories', id);
            const isLiked = Array.isArray(theory.likes) && theory.likes.includes(user.uid);

            await updateDoc(theoryRef, {
                likes: isLiked 
                    ? arrayRemove(user.uid)
                    : arrayUnion(user.uid)
            });

            setTheory(prev => ({
                ...prev,
                likes: isLiked
                    ? prev.likes.filter(uid => uid !== user.uid)
                    : [...(prev.likes || []), user.uid]
            }));
        } catch (err) {
            console.error('Error updating like:', err);
        }
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!user) {
            router.push('/login');
            return;
        }

        if (!newComment.trim()) return;

        try {
            const commentsRef = collection(db, 'theories', id, 'comments');
            const commentData = {
                text: newComment,
                userId: user.uid,
                username: user.displayName,
                userPhotoURL: user.photoURL,
                createdAt: new Date().toISOString()
            };

            await addDoc(commentsRef, commentData);
            setNewComment('');
        } catch (err) {
            console.error('Error adding comment:', err);
        }
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

    if (error) {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">{error}</h1>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                        Go Back
                    </button>
                </div>
            </Layout>
        );
    }

    if (!theory) return null;

    return (
        <Layout>
            <div className="max-w-4xl mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800 rounded-xl overflow-hidden shadow-xl"
                >
                    {theory.mediaUrl && (
                        <div className="relative aspect-video">
                            <img
                                src={theory.mediaUrl}
                                alt="Theory media"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                            <img
                                src={theory.userPhotoURL || '/default-avatar.png'}
                                alt={theory.username}
                                className="w-10 h-10 rounded-full mr-3"
                            />
                            <div>
                                <h3 className="text-lg font-semibold text-white">
                                    {theory.username}
                                </h3>
                                <p className="text-sm text-gray-400">
                                    {getTimeAgo(theory.createdAt)}
                                </p>
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-4">
                            {theory.title}
                        </h1>
                        
                        <p className="text-gray-300 mb-6 whitespace-pre-wrap">
                            {theory.description}
                        </p>

                        <div className="flex items-center space-x-4 text-gray-400">
                            <button
                                onClick={handleLike}
                                className={`flex items-center space-x-2 transition-colors ${
                                    Array.isArray(theory.likes) && theory.likes.includes(user?.uid)
                                        ? 'text-purple-500'
                                        : 'hover:text-purple-500'
                                }`}
                            >
                                <svg className="w-6 h-6" fill={Array.isArray(theory.likes) && theory.likes.includes(user?.uid) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                                <span>{Array.isArray(theory.likes) ? theory.likes.length : 0}</span>
                            </button>
                            <div className="flex items-center space-x-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span>{comments.length}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Comments Section */}
                <div className="mt-8">
                    <h2 className="text-xl font-semibold text-white mb-4">Comments</h2>
                    
                    {/* Comment Form */}
                    <form onSubmit={handleComment} className="mb-6">
                        <div className="flex space-x-4">
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                type="submit"
                                disabled={!newComment.trim()}
                                className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Post
                            </button>
                        </div>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <motion.div
                                key={comment.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gray-800 rounded-lg p-4"
                            >
                                <div className="flex items-center mb-2">
                                    <img
                                        src={comment.userPhotoURL || '/default-avatar.png'}
                                        alt={comment.username}
                                        className="w-8 h-8 rounded-full mr-3"
                                    />
                                    <div>
                                        <h4 className="text-white font-medium">
                                            {comment.username}
                                        </h4>
                                        <p className="text-xs text-gray-400">
                                            {getTimeAgo(comment.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-gray-300">
                                    {comment.text}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
