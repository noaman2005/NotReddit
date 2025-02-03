// lib/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBDBvtbzyYU8JifpSR9lIbDvECq7mmTi0w",
  authDomain: "proveit-493fc.firebaseapp.com",
  projectId: "proveit-493fc",
  storageBucket: "proveit-493fc.appspot.com",
  messagingSenderId: "304416373736",
  appId: "1:304416373736:web:e7c4a2e6cb4f8ed999025d",
  measurementId: "G-G5EHMH8EVY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const firebaseStorage = getStorage(app);

// Google Sign In function
const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    // Create or update user document in Firestore
    const userRef = doc(db, 'users', result.user.uid);
    await setDoc(userRef, {
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
      lastLogin: serverTimestamp(),
    }, { merge: true }); // merge: true will only update the specified fields
    return result;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export { auth, db, app, firebaseStorage, signInWithGoogle };
