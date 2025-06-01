// This file initializes the connection to your Firebase project.

// --- 1. Firebase Configuration ---
// These are your project's specific credentials.
const firebaseConfig = {
  apiKey: "AIzaSyAn24mjnWAbmVevthpKDadNI0cLcBN3UH0",
  authDomain: "gooues-bdd91.firebaseapp.com",
  projectId: "gooues-bdd91",
  storageBucket: "gooues-bdd91.appspot.com",
  messagingSenderId: "1095910317502",
  appId: "1:1095910317502:web:2f1a603957866817c18569" // This is a common format, but double-check if issues persist.
};

// --- 2. Initialize Firebase App and Services ---
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();


// --- 3. Anonymous Authentication ---
auth.onAuthStateChanged(user => {
  if (user) {
    // User is signed in anonymously.
    console.log("User signed in anonymously with UID:", user.uid);
  } else {
    // User is signed out. Attempt to sign them in.
    auth.signInAnonymously().catch(error => {
      console.error("Anonymous sign-in failed:", error);
      document.getElementById('status-text').textContent = "Error: Could not connect to game services. Please refresh the page.";
    });
  }
});


/*
--- IMPORTANT: FIRESTORE SECURITY RULES ---
You MUST set up security rules in your Firebase console for this to work.
Go to your project's Firestore Database > Rules tab and paste the following:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Games collection
    match /games/{gameId} {
      // Anyone who is authenticated (even anonymously) can read a game's state.
      allow read: if request.auth != null;
      
      // A new game can be created by any authenticated user.
      allow create: if request.auth != null;

      // A game can only be updated by one of the two players in that game.
      // This prevents others from interfering with a game in progress.
      allow update: if request.auth != null && (request.auth.uid == resource.data.player1.uid || request.auth.uid == resource.data.player2.uid);
    }
  }
}

*/