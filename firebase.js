// Import the necessary functions from the Firebase SDKs.
// This modular approach keeps the code clean and optimizes bundle size.
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    onSnapshot, 
    arrayUnion,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// --- Firebase Configuration ---
// Your project's actual Firebase configuration object.
const firebaseConfig = {
  apiKey: "AIzaSyCHTM6Xut0hYcIh0GSTYAejPP98aCwofAU",
  authDomain: "gooues-bdd91.firebaseapp.com",
  projectId: "gooues-bdd91",
  storageBucket: "gooues-bdd91.appspot.com",
  messagingSenderId: "1095910317502",
  appId: "1:1095910317502:web:c6f0e8c660964453642def"
};

// --- Initialization ---
// Initialize the Firebase app and get instances of the services we'll use.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Handles player authentication. It checks if a user is already signed in,
 * and if not, signs them in anonymously.
 * @returns {Promise<User>} A promise that resolves with the Firebase user object.
 */
export function authenticatePlayer() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is already signed in.
                console.log("Player already authenticated with UID:", user.uid);
                resolve(user);
            } else {
                // User is not signed in, so sign them in anonymously.
                signInAnonymously(auth)
                    .then((userCredential) => {
                        console.log("New player authenticated anonymously with UID:", userCredential.user.uid);
                        resolve(userCredential.user);
                    })
                    .catch(error => {
                        console.error("Error signing in anonymously:", error);
                        reject(error);
                    });
            }
        });
    });
}

/**
 * Creates a new game document in Firestore with an initial state.
 * @param {string} creatorUid - The UID of the player creating the game.
 * @param {Array<Array<number>>} initialBoard - The initial 2D array for the board state.
 * @returns {Promise<string>} A promise that resolves with the unique ID of the new game.
 */
export async function createGame(creatorUid, initialBoard) {
    // Generate a unique, short, and human-readable ID for the game.
    const gameId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const gameRef = doc(db, 'games', gameId);

    const newGame = {
        gameId: gameId,
        creatorId: creatorUid,
        players: [creatorUid], // The creator is automatically player 1.
        board: initialBoard,
        currentPlayer: 1, // Player 1 (black) always starts.
        status: 'waiting', // Game status: 'waiting', 'active', 'finished'
        createdAt: serverTimestamp(),
        winner: null,
    };

    await setDoc(gameRef, newGame);
    console.log(`Game created with ID: ${gameId}`);
    return gameId;
}

/**
 * Adds the current player to an existing game document.
 * @param {string} gameId - The ID of the game to join.
 * @param {string} playerUid - The UID of the player who is joining.
 * @returns {Promise<Object|null>} A promise that resolves with the game data if successful, or null if failed.
 */
export async function joinGame(gameId, playerUid) {
    const gameRef = doc(db, 'games', gameId);
    const gameSnap = await getDoc(gameRef);

    if (!gameSnap.exists()) {
        throw new Error("Game not found!");
    }

    const gameData = gameSnap.data();

    // Check if there is space for a new player.
    if (gameData.players.length >= 2) {
        throw new Error("This game is already full.");
    }

    // Add the new player and update the game status to 'active'.
    await updateDoc(gameRef, {
        players: arrayUnion(playerUid),
        status: 'active'
    });
    
    console.log(`Player ${playerUid} joined game ${gameId}`);
    return gameData;
}


/**
 * Sets up a real-time listener on a game document.
 * @param {string} gameId - The ID of the game to listen to.
 * @param {function} onUpdate - The callback function to execute when the game data changes.
 * It will be called with the new game data object.
 * @returns {function} An `unsubscribe` function to stop listening to updates.
 */
export function listenToGameUpdates(gameId, onUpdate) {
    const gameRef = doc(db, 'games', gameId);
    
    // onSnapshot returns the unsubscribe function automatically.
    const unsubscribe = onSnapshot(gameRef, (doc) => {
        if (doc.exists()) {
            onUpdate(doc.data());
        } else {
            console.error("Game document disappeared.");
            // You might want to handle this case in your UI (e.g., show an error message).
        }
    });

    return unsubscribe;
}

/**
 * Updates the game state in Firestore after a player makes a move.
 * @param {string} gameId - The ID of the game being played.
 * @param {Array<Array<number>>} newBoard - The updated 2D array representing the board.
 * @param {number} nextPlayer - The number of the player whose turn it is now (1 or 2).
 */
export async function updateGame(gameId, newBoard, nextPlayer) {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
        board: newBoard,
        currentPlayer: nextPlayer
    });
}

