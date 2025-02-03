import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { db, auth } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import Layout from './Layout';
import { useRouter } from 'next/router';

const TheoryForm = () => {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [media, setMedia] = useState(null);
    const [mediaPreview, setMediaPreview] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [error, setError] = useState('');
    const [charCount, setCharCount] = useState(0);
    const MAX_CHAR_COUNT = 500;

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }
            // Check file type
            if (!file.type.startsWith('image/')) {
                setError('Only image files are allowed');
                return;
            }
            setError('');
            setMedia(file);
            setMediaPreview(URL.createObjectURL(file));
        }
    };

    const handleDescriptionChange = (e) => {
        const text = e.target.value;
        if (text.length <= MAX_CHAR_COUNT) {
            setDescription(text);
            setCharCount(text.length);
            setError('');
        } else {
            setError(`Description cannot exceed ${MAX_CHAR_COUNT} characters`);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        
        // Validate inputs
        if (!title.trim()) {
            setError('Title is required');
            return;
        }
        if (!description.trim()) {
            setError('Description is required');
            return;
        }
        if (description.length > MAX_CHAR_COUNT) {
            setError(`Description cannot exceed ${MAX_CHAR_COUNT} characters`);
            return;
        }

        setLoading(true);
        setError('');

        const formData = new FormData();
        if (media) {
            formData.append('file', media);
        }

        try {
            let mediaUrl = '';
            if (media) {
                const { data } = await axios.post('/api/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                mediaUrl = data.links[0];
            }

            const user = auth.currentUser;
            if (!user) {
                setError('You must be logged in to submit a theory');
                return;
            }

            const theoryRef = await addDoc(collection(db, 'theories'), {
                title: title.trim(),
                description: description.trim(),
                mediaUrl,
                userId: user.uid,
                createdAt: new Date(),
                likes: [],
                comments: [],
                views: 0
            });

            // Reset form
            setTitle('');
            setDescription('');
            setMedia(null);
            setMediaPreview(null);
            setCharCount(0);

            // Show success message
            setShowSuccess(true);

            // Redirect to the theory page after 2 seconds
            setTimeout(() => {
                router.push('/feet'); // Redirect to main feed
            }, 2000);

        } catch (error) {
            console.error("Error:", error);
            setError('Failed to submit theory. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Update preview visibility
    useEffect(() => {
        setIsPreviewVisible(title !== '' || description !== '' || media !== null);
    }, [title, description, media]);

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (mediaPreview) {
                URL.revokeObjectURL(mediaPreview);
            }
        };
    }, [mediaPreview]);

    return (
        <Layout>
            <div className="min-h-screen bg-gray-900 text-white">
                <header className="p-6 text-center border-b border-gray-800">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Share Your Theory
                    </h1>
                    <p className="text-gray-400 mt-2">Share your thoughts and ideas with the community</p>
                </header>

                <div className="max-w-6xl mx-auto p-6 flex flex-col lg:flex-row gap-8">
                    {/* Form Section */}
                    <div className="flex-1">
                        <div className="bg-gray-800 rounded-xl shadow-xl p-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
                                        {error}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="title">
                                        Title
                                    </label>
                                    <input
                                        id="title"
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                                        placeholder="Give your theory a catchy title"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="description">
                                        Description
                                        <span className="float-right text-gray-400">
                                            {charCount}/{MAX_CHAR_COUNT}
                                        </span>
                                    </label>
                                    <textarea
                                        id="description"
                                        value={description}
                                        onChange={handleDescriptionChange}
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 min-h-[200px]"
                                        placeholder="Explain your theory in detail..."
                                        required
                                    />
                                </div>

                                <div className="relative group">
                                    <input
                                        id="media"
                                        type="file"
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="media"
                                        className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-all"
                                    >
                                        <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4-4m0 0l4 4m-4-4v14m0-14V6a4 4 0 114 4h-6" />
                                        </svg>
                                        <span className="text-sm text-gray-400">
                                            {media ? 'Change image' : 'Upload an image (optional)'}
                                        </span>
                                        <span className="text-xs text-gray-500 mt-1">
                                            Max size: 5MB
                                        </span>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Submitting...
                                        </span>
                                    ) : (
                                        "Share Theory"
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Preview Section */}
                    {isPreviewVisible && (
                        <div className="flex-1 lg:sticky lg:top-6">
                            <div className="bg-gray-800 rounded-xl shadow-xl p-6">
                                <h2 className="text-xl font-bold mb-4 text-gray-200">Preview</h2>
                                
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-400">Title</h3>
                                        <p className="text-lg font-medium text-white mt-1">
                                            {title || "Your title will appear here"}
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-medium text-gray-400">Description</h3>
                                        <p className="text-gray-200 mt-1 whitespace-pre-wrap">
                                            {description || "Your description will appear here"}
                                        </p>
                                    </div>

                                    {mediaPreview && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-400 mb-2">Image Preview</h3>
                                            <img
                                                src={mediaPreview}
                                                alt="Preview"
                                                className="rounded-lg max-h-[300px] w-full object-cover"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Success Toast */}
                {showSuccess && (
                    <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in-up">
                        🎉 Theory submitted successfully! Redirecting...
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default TheoryForm;
