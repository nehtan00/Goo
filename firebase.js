// This file initializes the connection to your Firebase project.

// --- 1. Firebase Configuration ---
// Replace this with the configuration object from your Firebase project's settings.
// Go to Project Overview > Project settings > General > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// --- 2. Initialize Firebase App and Services ---
// This sets up the core connection using your config.
const app = firebase.initializeApp(firebaseConfig);

// Get a reference to the Firestore database service.
const db = firebase.firestore();

// Get a reference to the Authentication service.
const auth = firebase.auth();


// --- 3. Anonymous Authentication ---
// This is the key for our no-login multiplayer.
// We sign the user in anonymously in the background. They get a unique, temporary ID
// that we can use to identify them in a game session without them needing to create an account.
auth.onAuthStateChanged(user => {
  if (user) {
    // User is signed in anonymously.
    console.log("User signed in anonymously with UID:", user.uid);
  } else {
    // User is signed out. Attempt to sign them in.
    auth.signInAnonymously().catch(error => {
      console.error("Anonymous sign-in failed:", error);
      // Handle error, e.g., show a message to the user that the game can't connect.
      document.getElementById('status-text').textContent = "Error: Could not connect to game services. Please refresh the page.";
    });
  }
});


