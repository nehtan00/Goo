// This file initializes the connection to your Firebase project.

// --- 1. Firebase Configuration ---
// Replace this with the configuration object from your Firebase project's settings.
// Go to Project Overview > Project settings > General > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyAn24mjnWAbmVevthpKDadNl0cLcBN3UH0",
  authDomain: "gooues-bdd91.firebaseapp.com",
  projectId: "gooues-bdd91",
  storageBucket: "gooues-bdd91.firebasestorage.app",
  messagingSenderId: "1095910317502",
  appId: "1:1095910317502:web:c6f0e8c660964453642def"
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


