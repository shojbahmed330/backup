import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBLaOaW9TwZEMEoZOm8PA-1rM-sQSghpkM",
  authDomain: "voicesocial-56a00.firebaseapp.com",
  projectId: "voicesocial-56a00",
  storageBucket: "voicesocial-56a00.firebasestorage.app",
  messagingSenderId: "576952416734",
  appId: "1:576952416734:web:4895dc1abd06d7eb5a454f",
  measurementId: "G-K79J8XZH73"
};

// Initialize Firebase
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Use browserSessionPersistence for Auth. This is more reliable in some sandboxed environments.
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
  .catch((error) => {
    console.error("Firebase: Auth session persistence failed. User may not stay logged in.", error);
  });

// NOTE: The db.enablePersistence() call has been removed.
// While it enables offline capabilities, it can be a source of complex issues
// in certain browser environments (e.g., with ad-blockers, multiple tabs, or strict privacy settings),
// often manifesting as CORS or network errors. Disabling it provides a more stable
// online-only experience and is a common troubleshooting step for these kinds of problems.


export { auth, db, storage, app };