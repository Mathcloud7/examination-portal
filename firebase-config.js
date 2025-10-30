// ------------------------------
// Firebase Configuration & Init
// ------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// ------------------------------
// Your Firebase project config
// ------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyAKaQRmWm-3KF8kmJgbf1ENR45__p36e84",
  authDomain: "year6f-43761.firebaseapp.com",
  databaseURL: "https://year6f-43761-default-rtdb.firebaseio.com",
  projectId: "year6f-43761",
  storageBucket: "year6f-43761.firebasestorage.app",
  messagingSenderId: "95725834235",
  appId: "1:95725834235:web:e7b03541093dbcca88855e"
};

// ------------------------------
// Initialize Firebase services
// ------------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// ------------------------------
// Export for other modules
// ------------------------------
export {
  app,
  db,
  storage,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  ref,
  uploadBytes,
  getDownloadURL,
  serverTimestamp
};
