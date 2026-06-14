import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs,
  doc, updateDoc, deleteDoc, query, orderBy, where, getDoc,
  increment, writeBatch, serverTimestamp,
  Timestamp }  // ← Timestamp SÍ existe pero solo en versiones >= 10.x
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { getStorage, ref, uploadBytes, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDWiMfhTKI4q9bptjvSyKG4YLWMXGhDsSQ",
  authDomain: "decants-b3470.firebaseapp.com",
  projectId: "decants-b3470",
  storageBucket: "decants-b3470.firebasestorage.app",
  messagingSenderId: "474370687390",
  appId: "1:474370687390:web:048d54dc7f900ba186568f",
  measurementId: "G-QTBLKHF0TZ"
};

const app = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const auth    = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, query, orderBy, where, getDoc, increment, writeBatch,
  serverTimestamp, Timestamp,
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  ref, uploadBytes, getDownloadURL };