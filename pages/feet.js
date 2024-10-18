import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Layout from '@/components/Layout';
import Navbar from '../components/Navbar';

export default function Feed() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [theories, setTheories] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState({});

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/login');
      } else {
        setLoading(false);
        fetchTheories();
        fetchSuggestedUsers();
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

  const fetchSuggestedUsers = async () => {
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSuggestedUsers(usersList);
    } catch (error) {
      console.error("Error fetching suggested users:", error);
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

  const handleLike = async (theoryId) => {
    const currentUserId = auth.currentUser.uid;
    setTheories((prevTheories) =>
      prevTheories.map((theory) => {
        if (theory.id === theoryId) {
          const likedBy = Array.isArray(theory.likedBy) ? theory.likedBy : [];
          const isLiked = likedBy.includes(currentUserId);
          return {
            ...theory,
            likes: isLiked ? theory.likes - 1 : theory.likes + 1,
            likedBy: isLiked ? likedBy.filter((id) => id !== currentUserId) : [...likedBy, currentUserId],
          };
        }
        return theory;
      })
    );

    try {
      const theoryRef = doc(db, 'theories', theoryId);
      const theoryDoc = await getDoc(theoryRef);
      const theoryData = theoryDoc.data();
      const likedBy = Array.isArray(theoryData.likedBy) ? theoryData.likedBy : [];
      const isLiked = likedBy.includes(currentUserId);
      if (isLiked) {
        await updateDoc(theoryRef, {
          likes: theoryData.likes - 1,
          likedBy: arrayRemove(currentUserId),
        });
      } else {
        await updateDoc(theoryRef, {
          likes: theoryData.likes + 1,
          likedBy: arrayUnion(currentUserId),
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleShare = (theoryId) => {
    const shareUrl = `${window.location.origin}/theory/${theoryId}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => alert('Shareable link copied to clipboard: ' + shareUrl))
      .catch((error) => console.error('Error copying shareable link:', error));
  };

  if (loading) {
    return <div className="text-2xl font-bold text-center mt-20">Loading...</div>;
  }

  return (
    <Layout>
      <header className="p-2 flex items-center justify-between m-3">
        <h1 className="text-2xl font-bold text-white">Feed</h1>
      </header>
      <hr className="border-t border-gray-300 mb-6 w-full" />
      <div className="mt-6"></div>
      <div className="flex flex-col md:flex-row justify-center space-x-0 md:space-x-8 mt-4">
        <div className="max-w-2xl w-full p-4 rounded-lg shadow-lg">
          <main className="flex flex-col space-y-6">
            {theories.length === 0 ? (
              <p className="text-center text-gray-600">No theories submitted yet.</p>
            ) : (
              theories.map((theory) => (
                <div key={theory.id} className="bg-gradient-to-b from-black to-gray-400 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                  <div className="flex items-center space-x-2 mb-4">
                    <img
                      src={theory.userPhotoURL}
                      alt={theory.userDisplayName}
                      className="w-10 h-10 rounded-full"
                    />
                    <span className="font-semibold text-blue-400">{theory.userDisplayName}</span>
                  </div>
                  <h2 className="font-bold mt-2 text-lg text-red-900">{theory.title}</h2>
                  {theory.mediaUrl && (
                    <img
                      src={theory.mediaUrl}
                      alt="Theory Media"
                      className="mt-2 w-full h-auto rounded-lg max-h-80 object-cover"
                    />
                  )}
                  <p className="p-2 text-gray-900">{theory.description}</p>
                  <div className="flex items-center justify-between mt-4 space-x-4">
                    <div
                      className={`flex items-center space-x-1 cursor-pointer transition-colors duration-200 ${theory.likedBy.includes(auth.currentUser.uid) ? 'text-red-500' : 'text-gray-600'}`}
                      onClick={() => handleLike(theory.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                      </svg>
                      <span>{theory.likes} Likes</span>
                    </div>
                    <div className="flex items-center space-x-1 cursor-pointer" onClick={() => toggleCommentSection(theory.id)}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                      </svg>
                      <span>{comments[theory.id]?.length || 0} Comments</span>
                    </div>
                    <div className="flex items-center space-x-1 cursor-pointer" onClick={() => handleShare(theory.id)}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                      </svg>
                      <span>Share</span>
                    </div>
                  </div>
                  {activeCommentId === theory.id && (
                    <div className="mt-4">
                      <input
                        type="text"
                        value={commentText}
                        onChange={handleCommentChange}
                        placeholder="Add a comment..."
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={() => handleCommentSubmit(theory.id)}
                        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                      >
                        Submit
                      </button>
                      {comments[theory.id]?.map((comment) => (
                        <div key={comment.id} className="mt-2 text-gray-700">
                          <strong>{comment.userDisplayName}: </strong>
                          <span>{comment.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </main>
        </div>
        <div className="hidden md:block md:w-64 mt-4 md:mt-0">
          <h3 className="text-lg font-bold mb-2">Suggested Users</h3>
          <ul className="bg-white shadow-md rounded-lg p-4">
            {suggestedUsers.map((user) => (
              <li key={user.id} className="flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer">
                <img src={user.photoURL || '/default-avatar.png'} alt={user.displayName} className="w-8 h-8 rounded-full" />
                <span className="font-medium">{user.displayName}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </Layout>
  );
}
