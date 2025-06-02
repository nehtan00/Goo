// firebase.js (Complete file with added diagnostic logs)

// Import the necessary functions from the Firebase SDKs.
// This modular approach keeps the code clean and optimizes bundle size.
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import {
    getFirestore
    // Removed unused Firestore v9 functions like doc, setDoc etc. as main.js imports them directly
    // serverTimestamp is also imported directly in main.js
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

console.log("firebase.js: Script execution STARTED."); // New log

// --- Firebase Configuration ---
// Your project's actual Firebase configuration object.
const firebaseConfig = {
  apiKey: "AIzaSyCHTM6Xut0hYcIh0GSTYAejPP98aCwofAU", // IMPORTANT: For production, consider environment variables or more secure config methods if applicable
  authDomain: "gooues-bdd91.firebaseapp.com",
  projectId: "gooues-bdd91",
  storageBucket: "gooues-bdd91.appspot.com",
  messagingSenderId: "1095910317502",
  appId: "1:1095910317502:web:c6f0e8c660964453642def"
};

// --- Initialization ---
// Ensure Firebase app is initialized only once
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    console.log("firebase.js: Firebase app INITIALIZED."); // ADDED THIS LOG
} else {
    app = getApp(); // if already initialized, use that one
    console.log("firebase.js: Firebase app ALREADY INITIALIZED."); // ADDED THIS LOG
}

const auth = getAuth(app);
const db = getFirestore(app);

window.auth = auth;
window.db = db;
console.log("firebase.js: auth and db set on window object."); // ADDED THIS LOG


/**
 * Handles player authentication. It checks if a user is already signed in,
 * and if not, signs them in anonymously.
 * This is exported in case other modules need to explicitly re-authenticate,
 * but it's also called on script load.
 * @returns {Promise<User>} A promise that resolves with the Firebase user object.
 */
export function authenticatePlayer() {
    console.log("firebase.js: authenticatePlayer() function CALLED."); // New log
    return new Promise((resolve, reject) => {
        // onAuthStateChanged listener is set up once and will fire whenever auth state changes.
        // It will fire immediately with the current state, then again if it changes (e.g., after signInAnonymously).
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("firebase.js: onAuthStateChanged FIRED."); // New log
            if (user) {
                // User is present (already signed in or just signed in anonymously).
                console.log("firebase.js: onAuthStateChanged - User IS present. UID:", user.uid);
                // No need to unsubscribe here if we want it to keep listening for sign-outs,
                // but for the purpose of this initial promise, we can resolve.
                // If this is the *first* call and user is null, the 'else' block handles sign-in.
                // If this is a *subsequent* call after signInAnonymously, user will be populated.
                resolve(user);
                // If you only want this to resolve once for the initial auth, you might unsubscribe.
                // For now, let it keep listening as onAuthStateChanged in main.js also relies on it.
                // unsubscribe(); // Optional: if you only want this promise to resolve once.
            } else {
                // User is not signed in (e.g., first load, or after a sign-out).
                console.log("firebase.js: onAuthStateChanged - User is NOT present. Attempting anonymous sign-in.");
                signInAnonymously(auth)
                    .then((userCredential) => {
                        console.log("firebase.js: signInAnonymously - SUCCESS. UID:", userCredential.user.uid);
                        // onAuthStateChanged will fire again with this new user,
                        // and the 'if (user)' block above will handle it.
                        // We can resolve the promise here as sign-in was successful.
                        resolve(userCredential.user);
                        // unsubscribe(); // Optional
                    })
                    .catch(error => {
                        console.error("firebase.js: signInAnonymously - FAILED:", error);
                        reject(error);
                        // unsubscribe(); // Optional
                    });
            }
        }, (error) => { // Error callback for onAuthStateChanged itself
            console.error("firebase.js: onAuthStateChanged listener ERROR:", error);
            reject(error);
        });
        // Note: The `unsubscribe` function returned by onAuthStateChanged can be called
        // to remove the listener if it's no longer needed, e.g., when a component unmounts.
        // For a global auth listener like this, it often stays active for the app's lifetime.
    });
}

// Call authenticatePlayer when the script loads to ensure a user is signed in.
console.log("firebase.js: Calling authenticatePlayer() on script load to initiate auth check/sign-in."); // MODIFIED LOG
authenticatePlayer().then(user => {
    // This log confirms that the Promise returned by the initial authenticatePlayer() call resolved.
    // It doesn't necessarily mean onAuthStateChanged in main.js has received the user yet,
    // but it means the process initiated by firebase.js has proceeded.
    console.log('firebase.js: Initial authenticatePlayer() promise SUCCEEDED. User (or pending user) UID if available:', user ? user.uid : 'N/A, still processing');
}).catch(error => {
    console.error('firebase.js: Initial authenticatePlayer() promise FAILED:', error);
});

console.log("firebase.js: Script execution FINISHED."); // New log