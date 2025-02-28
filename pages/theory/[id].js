import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import Layout from '../../components/Layout';
import { motion } from 'framer-motion';
import { getTimeAgo } from '../../utils/helpers';
import Link from 'next/link';

export default function TheoryDetail() {
    const router = useRouter();
    const { id } = router.query;
    const [user] = useAuthState(auth);
    const [theory, setTheory] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedDescription, setEditedDescription] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

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
                    setEditedTitle(theoryData.title);
                    setEditedDescription(theoryData.description);
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

    const handleEdit = async () => {
        if (!theory || !user || user.uid !== theory.userId) return;

        try {
            await updateDoc(doc(db, 'theories', id), {
                title: editedTitle,
                description: editedDescription,
                updatedAt: new Date()
            });

            setTheory(prev => ({
                ...prev,
                title: editedTitle,
                description: editedDescription,
                updatedAt: new Date()
            }));
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating theory:', error);
            alert('Failed to update theory');
        }
    };

    const handleDelete = async () => {
        if (!theory || !user || user.uid !== theory.userId) return;

        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'theories', id));
            router.push('/Dashboard');
        } catch (error) {
            console.error('Error deleting theory:', error);
            alert('Failed to delete theory');
            setIsDeleting(false);
        }
    };

    const handleCancelEdit = () => {
        setEditedTitle(theory.title);
        setEditedDescription(theory.description);
        setIsEditing(false);
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
                                    {theory.updatedAt && ' (edited)'}
                                </p>
                            </div>
                            {user && user.uid === theory.userId && (
                                <div className="flex space-x-2 ml-4">
                                    {!isEditing && (
                                        <>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="text-blue-500 hover:text-blue-600"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={handleDelete}
                                                disabled={isDeleting}
                                                className="text-red-500 hover:text-red-600"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                </svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {isEditing ? (
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Title"
                                />
                                <textarea
                                    value={editedDescription}
                                    onChange={(e) => setEditedDescription(e.target.value)}
                                    className="w-full h-48 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Description"
                                />
                                <div className="flex justify-end space-x-2">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleEdit}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold mb-4 text-white">
                                    {theory.title}
                                </h1>
                                <p className="text-gray-300 whitespace-pre-wrap">
                                    {theory.description}
                                </p>
                            </>
                        )}
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
                                        <Link 
                                            href={`/UserDashboard?id=${comment.userId}`}
                                            className="font-medium text-white hover:underline"
                                        >
                                            {comment.username}
                                        </Link>
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
