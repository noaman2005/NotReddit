import { useEffect, useRef, useState } from 'react';
import { auth, db, firebaseStorage } from '../../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import CryptoJS from 'crypto-js';

const ChatRoom = () => {
    const [user, setUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [formValue, setFormValue] = useState('');
    const [recipient, setRecipient] = useState(null);
    const [chatId, setChatId] = useState('');
    const [file, setFile] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [typingTimeout, setTypingTimeout] = useState(null);
    const dummy = useRef();
    const router = useRouter();
    const { uid } = router.query;

    const secretKey = process.env.NEXT_PUBLIC_MESSAGE_ENCRYPTION_KEY || 'your-secret-key';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push('/login');
            } else {
                setUser(currentUser);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user || !uid) return;

        const chatRoomId = [user.uid, uid].sort().join('_');
        setChatId(chatRoomId);

        // Create chat document if it doesn't exist
        const createChatDoc = async () => {
            const chatRef = doc(db, 'chats', chatRoomId);
            const chatDoc = await getDoc(chatRef);
            if (!chatDoc.exists()) {
                await setDoc(chatRef, {
                    participants: [user.uid, uid],
                    createdAt: serverTimestamp(),
                    lastMessage: null,
                    typing: null
                });
            }
        };
        createChatDoc();

        // Listen for messages
        const q = query(collection(db, `chats/${chatRoomId}/messages`), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messagesArray = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                let decryptedMessage = '';

                if (data.text) {
                    try {
                        const bytes = CryptoJS.AES.decrypt(data.text, secretKey);
                        decryptedMessage = bytes.toString(CryptoJS.enc.Utf8);
                    } catch (error) {
                        console.error('Decryption error:', error);
                        decryptedMessage = 'Message cannot be decrypted';
                    }
                }

                messagesArray.push({
                    id: doc.id,
                    ...data,
                    text: decryptedMessage,
                    timestamp: data.createdAt?.toDate()
                });
            });
            setMessages(messagesArray);
            
            // Scroll to bottom after messages load
            setTimeout(() => {
                dummy.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);
        });

        // Listen for typing status
        const typingRef = doc(db, 'chats', chatRoomId);
        const typingUnsubscribe = onSnapshot(typingRef, (doc) => {
            const data = doc.data();
            if (data?.typing === uid) {
                setIsTyping(true);
            } else {
                setIsTyping(false);
            }
        });

        return () => {
            unsubscribe();
            typingUnsubscribe();
        };
    }, [user, uid]);

    useEffect(() => {
        if (!uid) return;

        const fetchRecipient = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    setRecipient({ uid, ...userDoc.data() });
                } else {
                    console.error('Recipient not found');
                    router.push('/chat');
                }
            } catch (error) {
                console.error('Error fetching recipient:', error);
            }
        };

        fetchRecipient();
    }, [uid]);

    const handleTyping = async () => {
        if (!chatId) return;

        try {
            if (typingTimeout) clearTimeout(typingTimeout);

            const chatRef = doc(db, 'chats', chatId);
            const chatDoc = await getDoc(chatRef);
            
            if (!chatDoc.exists()) {
                await setDoc(chatRef, {
                    participants: [user.uid, uid],
                    createdAt: serverTimestamp(),
                    lastMessage: null,
                    typing: user.uid
                });
            } else {
                await updateDoc(chatRef, {
                    typing: user.uid
                });
            }

            const timeout = setTimeout(async () => {
                const updatedDoc = await getDoc(chatRef);
                if (updatedDoc.exists()) {
                    await updateDoc(chatRef, {
                        typing: null
                    });
                }
            }, 2000);

            setTypingTimeout(timeout);
        } catch (error) {
            console.error('Error updating typing status:', error);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();

        if (!formValue.trim() && !file) return;

        const { uid, displayName, photoURL } = user;
        let messageData = {
            uid,
            displayName,
            photoURL,
            createdAt: serverTimestamp(),
            read: false
        };

        try {
            if (formValue.trim()) {
                const encryptedMessage = CryptoJS.AES.encrypt(formValue, secretKey).toString();
                messageData.text = encryptedMessage;
            }

            if (file) {
                const fileExt = file.name.split('.').pop().toLowerCase();
                const fileName = `${Date.now()}.${fileExt}`;
                const storageRef = ref(firebaseStorage, `chatImages/${chatId}/${fileName}`);
                
                await uploadBytes(storageRef, file);
                const imageUrl = await getDownloadURL(storageRef);
                messageData.imageUrl = imageUrl;
            }

            await addDoc(collection(db, `chats/${chatId}/messages`), messageData);
            setFormValue('');
            setFile(null);
            
            // Clear typing status
            const chatRef = doc(db, 'chats', chatId);
            await updateDoc(chatRef, { typing: null });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.size <= 5 * 1024 * 1024) { // 5MB limit
            setFile(file);
        } else {
            alert('File size should be less than 5MB');
        }
    };

    if (!user || !recipient) return null;

    return (
        <div className="flex flex-col h-screen max-h-screen overflow-hidden">
            <header className="bg-black text-white p-4 shadow-md flex items-center">
                <button onClick={() => router.push('/chat')} className="text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <div className="flex flex-col items-center flex-grow">
                    {recipient.photoURL && (
                        <img src={recipient.photoURL} alt="Profile" className="w-12 h-12 rounded-full mb-2" />
                    )}
                    <h2 className="text-xl font-sans">{recipient.displayName}</h2>
                    {isTyping && (
                        <p className="text-sm text-gray-400">typing...</p>
                    )}
                </div>
                <div className="flex space-x-6 mr-4">
                    <button className="text-blue-500 hover:text-blue-500 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                        </svg>
                    </button>
                    <button className="text-blue-500 hover:text-blue-500 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                    </button>
                </div>
            </header>

            <main className="flex-1 p-4 bg-gray-800 overflow-y-auto">
                <div className="max-w-4xl mx-auto lg:mx-0 lg:ml-auto lg:mr-[20%] space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.uid === user.uid ? 'justify-end' : 'justify-start'}`}>
                            {msg.uid !== user.uid && (
                                <img src={recipient.photoURL} alt="Avatar" className="w-8 h-8 rounded-full mr-2" />
                            )}
                            <div
                                className={`rounded-3xl text-md px-5 py-3 ${
                                    msg.uid === user.uid 
                                        ? 'bg-gray-600 text-white' 
                                        : 'bg-gray-900 text-white'
                                }`}
                            >
                                {msg.text && <p className="break-words">{msg.text}</p>}
                                {msg.imageUrl && (
                                    <img 
                                        src={msg.imageUrl} 
                                        alt="Shared" 
                                        className="rounded-md max-w-xs cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(msg.imageUrl, '_blank')}
                                    />
                                )}
                                <div className="text-xs text-gray-400 mt-1">
                                    {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={dummy} />
                </div>
            </main>

            <form onSubmit={sendMessage} className="p-4 bg-gray-800 shadow-md flex items-center space-x-2">
                <label
                    htmlFor="file-upload"
                    className="text-white p-2 rounded-3xl cursor-pointer transition duration-200 hover:bg-gray-600"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </label>
                <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                />
                <input
                    value={formValue}
                    onChange={(e) => {
                        setFormValue(e.target.value);
                        handleTyping();
                    }}
                    className="flex-1 border bg-gray-300 border-gray-600 rounded-full text-red px-4 py-2 focus:outline-none focus:ring focus:ring-blue-300 transition duration-200"
                    placeholder={`Message ${recipient.displayName}...`}
                />
                <button 
                    type="submit" 
                    disabled={!formValue.trim() && !file}
                    className="bg-black text-white px-2 py-2 rounded-full transition duration-200 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75 12 3m0 0 3.75 3.75M12 3v18" />
                    </svg>
                </button>
            </form>
        </div>
    );
};

export default ChatRoom;
