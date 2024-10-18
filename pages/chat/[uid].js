import { useEffect, useRef, useState } from 'react';
import { auth, db, firebaseStorage } from '../../lib/firebase'; // Firebase config with storage
import { collection, addDoc, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Firebase storage imports
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/router';
import CryptoJS from 'crypto-js'; // Import CryptoJS for encryption

const ChatRoom = () => {
    const [user, setUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [formValue, setFormValue] = useState('');
    const [recipient, setRecipient] = useState(null);
    const [chatId, setChatId] = useState('');
    const [file, setFile] = useState(null); // New state for selected file
    const dummy = useRef();
    const router = useRouter();
    const { uid } = router.query; // Get recipient UID from route

    const secretKey = 'your-secret-key'; // Replace with a secure key

    // Check for authentication state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    // Fetch private chat messages
    useEffect(() => {
        if (!user || !uid) return;

        const chatRoomId = [user.uid, uid].sort().join('_');
        setChatId(chatRoomId);

        const q = query(collection(db, `chats/${chatRoomId}/messages`), orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messagesArray = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                let decryptedMessage = '';

                try {
                    // Decrypt the message
                    const bytes = CryptoJS.AES.decrypt(data.text, secretKey);
                    decryptedMessage = bytes.toString(CryptoJS.enc.Utf8);
                } catch (error) {
                    console.error('Decryption error: ', error);
                }

                messagesArray.push({ id: doc.id, ...data, text: decryptedMessage });
            });
            setMessages(messagesArray);
            if (dummy.current) {
                dummy.current.scrollIntoView({ behavior: 'smooth' });
            }
        });

        return () => unsubscribe();
    }, [user, uid]);

    // Fetch recipient details
    useEffect(() => {
        if (!uid) return;

        const fetchRecipient = async () => {
            const userDoc = await getDoc(doc(db, 'users', uid));
            setRecipient({ uid, ...userDoc.data() });
        };

        fetchRecipient();
    }, [uid]);

    // Function to send text messages
    const sendMessage = async (e) => {
        e.preventDefault();

        if (!formValue.trim() && !file) return; // No message or file

        const { uid, displayName, photoURL } = user;
        let messageData = {
            createdAt: new Date(),
            uid,
            displayName,
            photoURL,
        };

        if (formValue.trim()) {
            // Encrypt the message
            const encryptedMessage = CryptoJS.AES.encrypt(formValue, secretKey).toString();
            messageData.text = encryptedMessage;
        }

        if (file) {
            // Handle file upload
            const storageRef = ref(firebaseStorage, `chatImages/${chatId}/${file.name}`);
            await uploadBytes(storageRef, file);
            const imageUrl = await getDownloadURL(storageRef);
            messageData.imageUrl = imageUrl; // Add image URL to message data
            setFile(null); // Reset file after sending
        }

        await addDoc(collection(db, `chats/${chatId}/messages`), messageData);

        setFormValue('');
    };

    // Function to handle file selection
    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    if (!user || !recipient) return <p>Loading...</p>;

    return (
        <div className="flex flex-col h-screen">
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
                </div>
                <div className="flex space-x-6 mr-4">
                    <button onClick={() => {/* handle call functionality */ }} className="text-blue-500 hover:text-blue-500 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                        </svg>

                    </button>
                    <button onClick={() => {/* handle video call functionality */ }} className="text-blue-500 hover:text-blue-500 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>

                    </button>
                </div>
            </header>




            <main className="flex-1 p-4 bg-gray-800 overflow-y-auto">
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.uid === user.uid ? 'justify-end' : 'justify-start'}`}>
                            {msg.uid !== user.uid && (
                                <img src={recipient.photoURL} alt="Avatar" className="w-8 h-8 rounded-full mr-2" />
                            )}
                            <div
                                className={`rounded-3xl text-md px-5 py-3  ${msg.uid === user.uid ? 'bg-gray-600 text-white' : 'bg-gray-900 text-white'}`}
                            >
                                {msg.text && <p>{msg.text}</p>}
                                {msg.imageUrl && (
                                    <img src={msg.imageUrl} alt="Sent Image" className="rounded-md max-w-xs" />
                                )}
                            </div>
                        </div>
                    ))}
                    <span ref={dummy}></span>
                </div>
            </main>

            {/* Message Input and File Upload */}
            <form onSubmit={sendMessage} className="p-4 bg-gray-800 shadow-md flex items-center space-x-2">
                <label
                    htmlFor="file-upload"
                    className=" text-white p-2 rounded-3xl cursor-pointer transition duration-200 hover:bg-gray-600"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </label>
                <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileChange} // Your file change handler
                    className="hidden" // Hides the default input styling
                    accept="image/*"
                />
                <input
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="flex-1 border bg-gray-300 border-gray-600 rounded-full px-4 py-2 focus:outline-none focus:ring focus:ring-blue-300 transition duration-200"
                    placeholder={`Message ${recipient.displayName}...`}
                />
                <button type="submit" className="bg-black text-white px-2 py-2 rounded-full transition duration-200 hover:bg-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75 12 3m0 0 3.75 3.75M12 3v18" />
                    </svg>

                </button>
            </form>
        </div>
    );
};

export default ChatRoom;
