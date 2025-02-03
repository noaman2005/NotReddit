import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, updateDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';

export default function EditProfile() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!user) {
                router.push('/login');
            } else {
                fetchUserData(user.uid);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const fetchUserData = async (userId) => {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setUser(userData);
                setDisplayName(userData.displayName || '');
                setBio(userData.bio || '');
                setPhotoURL(userData.photoURL || '/default-avatar.png');
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            setErrorMessage('Failed to load user data. Please try again.');
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setErrorMessage('Image size should be less than 5MB');
                return;
            }
            if (!file.type.startsWith('image/')) {
                setErrorMessage('Please upload an image file');
                return;
            }
            setFile(file);
            setPhotoURL(URL.createObjectURL(file));
            setErrorMessage('');
        }
    };

    const uploadFileToStorage = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            const data = await response.json();
            return data.links[0];
        } catch (error) {
            throw new Error('Error uploading image. Please try again.');
        }
    };

    const isUsernameUnique = async (username, userId) => {
        try {
            const q = query(collection(db, 'users'), where('displayName', '==', username));
            const querySnapshot = await getDocs(q);
            
            // Username is unique if no documents found or if the only document is the current user's
            return querySnapshot.empty || 
                   (querySnapshot.size === 1 && querySnapshot.docs[0].id === userId);
        } catch (error) {
            throw new Error('Error checking username availability');
        }
    };

    const validateForm = () => {
        if (!displayName.trim()) {
            setErrorMessage('Display name is required');
            return false;
        }
        if (displayName.length > 30) {
            setErrorMessage('Display name must be less than 30 characters');
            return false;
        }
        if (bio.length > 160) {
            setErrorMessage('Bio must be less than 160 characters');
            return false;
        }
        return true;
    };

    const handleSaveChanges = async () => {
        if (!user || !validateForm()) return;

        setLoading(true);
        setErrorMessage('');
        const userId = auth.currentUser.uid;
        const userRef = doc(db, 'users', userId);
        const updatedData = { displayName: displayName.trim(), bio: bio.trim() };

        try {
            // Check username uniqueness
            const isUnique = await isUsernameUnique(displayName, userId);
            if (!isUnique) {
                setErrorMessage('Username already exists. Please choose a different one.');
                setLoading(false);
                return;
            }

            // Upload new profile picture if selected
            if (file) {
                const imageUrl = await uploadFileToStorage(file);
                updatedData.photoURL = imageUrl;
            }

            await updateDoc(userRef, updatedData);
            setShowSuccess(true);
            setTimeout(() => {
                router.push('/Dashboard');
            }, 1500);
        } catch (error) {
            console.error("Error updating profile:", error);
            setErrorMessage(error.message || 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg mt-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold dark:text-white">Edit Profile</h2>
                    <button
                        onClick={() => router.push('/Dashboard')}
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Profile Picture */}
                    <div className="flex flex-col items-center space-y-4">
                        <div className="relative">
                            <img
                                src={photoURL}
                                alt="Profile"
                                className="w-32 h-32 rounded-full object-cover border-4 border-purple-500"
                                referrerPolicy="no-referrer"
                            />
                            <label className="absolute bottom-0 right-0 bg-purple-500 p-2 rounded-full cursor-pointer hover:bg-purple-600 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Click the camera icon to change your profile picture
                        </p>
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            maxLength={30}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Your display name"
                        />
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {displayName.length}/30 characters
                        </p>
                    </div>

                    {/* Bio */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Bio
                        </label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            maxLength={160}
                            rows="4"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Tell us about yourself..."
                        ></textarea>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {bio.length}/160 characters
                        </p>
                    </div>

                    {/* Error Message */}
                    {errorMessage && (
                        <div className="p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
                            {errorMessage}
                        </div>
                    )}

                    {/* Success Message */}
                    {showSuccess && (
                        <div className="p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-lg">
                            Profile updated successfully! Redirecting...
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex space-x-4">
                        <button
                            onClick={() => router.push('/Dashboard')}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            disabled={loading}
                            className={`flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors ${
                                loading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </span>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
