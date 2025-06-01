// =================================================================
// Mythos Go - main.js
// =================================================================

// --- Constants ---
const BOARD_SIZE = 9; // 9x9 board for faster games
const PIECE_MODEL_PATHS = {
    'Achilles': 'assets/achilles.glb',
    'War Elephant': 'assets/war_elephant.glb',
    'Knight Horse': 'assets/knight_horse.glb',
    'Aztec': 'assets/aztec.glb'
};

// --- DOM Element References ---
const gameContainer = document.getElementById('game-container');
const statusText = document.getElementById('status-text');
const turnText = document.getElementById('turn-text');
const player1CapturesText = document.getElementById('player1-captures');
const player2CapturesText = document.getElementById('player2-captures');
const newGameButton = document.getElementById('new-game-button');
const joinGameButton = document.getElementById('join-game-button');
const passTurnButton = document.getElementById('pass-turn-button');
const rulesStrategyButton = document.getElementById('rules-strategy-button');

// Modals
const gameSetupModal = document.getElementById('game-setup-modal');
const joinGameModal = document.getElementById('join-game-modal');
const shareGameModal = document.getElementById('share-game-modal');
const rulesStrategyModal = document.getElementById('rules-strategy-modal');

// Modal Controls
const closeSetupModalButton = gameSetupModal.querySelector('.close-button');
const closeJoinModalButton = joinGameModal.querySelector('.close-button');
const closeShareModalButton = shareGameModal.querySelector('.close-button');
const closeRulesModalButton = rulesStrategyModal.querySelector('.close-button');
const playerColorInput = document.getElementById('player-color-input');
const playerPieceSelect = document.getElementById('player-piece-select');
const difficultySelect = document.getElementById('difficulty-select');
const startAiGameButton = document.getElementById('start-ai-game-button');
const createMultGameButton = document.getElementById('create-mult-game-button');
const joinGameCodeInput = document.getElementById('join-game-code-input');
const joinMultGameButton = document.getElementById('join-mult-game-button');
const shareGameCodeDisplay = document.getElementById('share-game-code-display');
const copyCodeButton = document.getElementById('copy-code-button');
const shareGameLinkDisplay = document.getElementById('share-game-link-display');
const copyLinkButton = document.getElementById('copy-link-button');


// --- Three.js Variables ---
let scene, camera, renderer, raycaster, mouse;
let boardPlane; // Invisible plane for click detection
let stoneModels = {}; // Store 3D models: 'x-y' -> model

// --- Game State Variables ---
let board = []; // 2D array for game logic: 0=empty, 1=player1(Black), 2=player2(White)
let currentPlayer = 1;
let gameMode = null;
let currentDifficulty = 'easy';
let gameOver = true;
let activeGameId = null;
let localPlayerNum = 0;
let unsubscribeGameListener = null;
let consecutivePasses = 0;
let captures = { 1: 0, 2: 0 };
let koState = null; // Stores board state to prevent Ko recaptures

let player1Settings = { uid: null, color: '#222222', piece: 'zeus' }; // Default piece name
let player2Settings = { uid: null, color: '#FFFFFF', piece: 'zeus' }; // Default piece name

// NOTE: We do not declare 'db' or 'auth' here because they are already
// created in the global scope by firebase.js. This fixes the second error.

// =================================================================
// Initial Setup
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    waitForAuthAndSetupUI();
    window.addEventListener('resize', onWindowResize, false);
});

function waitForAuthAndSetupUI() {
    // Check if auth is available before using it
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(user => {
            if (user) {
                player1Settings.uid = user.uid; // Set local player UID
                checkUrlForGameToJoin();
            } else {
                statusText.textContent = "Connecting to game services...";
            }
        });
    } else {
        // This might happen if firebase.js fails to load, so we handle it gracefully.
        console.error("Firebase Auth not available. Check script loading.");
        statusText.textContent = "Error: Cannot connect to Authentication services.";
    }
}

function checkUrlForGameToJoin() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    if (gameIdFromUrl) {
        joinGameCodeInput.value = gameIdFromUrl;
        openModal(joinGameModal);
        statusText.textContent = `Attempting to join game: ${gameIdFromUrl}`;
    }
}

function initEventListeners() {
    newGameButton.addEventListener('click', () => openModal(gameSetupModal));
    joinGameButton.addEventListener('click', () => openModal(joinGameModal));
    rulesStrategyButton.addEventListener('click', () => openModal(rulesStrategyModal));
    passTurnButton.addEventListener('click', handlePassTurn);

    closeSetupModalButton.addEventListener('click', () => closeModal(gameSetupModal));
    closeJoinModalButton.addEventListener('click', () => closeModal(joinGameModal));
    closeShareModalButton.addEventListener('click', () => closeModal(shareGameModal));
    closeRulesModalButton.addEventListener('click', () => closeModal(rulesStrategyModal));

    startAiGameButton.addEventListener('click', startNewAIGame);
    createMultGameButton.addEventListener('click', createMultiplayerGame);
    joinMultGameButton.addEventListener('click', () => {
        const gameId = joinGameCodeInput.value.trim();
        if (gameId) joinMultiplayerGame(gameId);
        else alert("Please enter a game code.");
    });
    
    copyCodeButton.addEventListener('click', () => copyToClipboard(shareGameCodeDisplay.value));
    copyLinkButton.addEventListener('click', () => copyToClipboard(shareGameLinkDisplay.value));
}

// =================================================================
// 3D Scene (Three.js)
// =================================================================

function initThreeJS() {
    gameContainer.innerHTML = '';
    stoneModels = {};

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd2b48c); // Wood color

    camera = new THREE.PerspectiveCamera(50, gameContainer.clientWidth / gameContainer.clientHeight, 0.1, 1000);
    camera.position.set(BOARD_SIZE / 2, BOARD_SIZE, BOARD_SIZE);
    camera.lookAt(BOARD_SIZE / 2, 0, BOARD_SIZE / 2);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
    gameContainer.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(20, 30, 20);
    scene.add(dirLight);

    drawBoardGrid();

    // Invisible plane for clicking
    const planeGeom = new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    boardPlane = new THREE.Mesh(planeGeom, planeMat);
    boardPlane.rotation.x = -Math.PI / 2;
    boardPlane.position.set((BOARD_SIZE - 1) / 2, 0, (BOARD_SIZE - 1) / 2);
    scene.add(boardPlane);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    gameContainer.addEventListener('click', onBoardClick, false);
    
    animate();
}

function drawBoardGrid() {
    const material = new THREE.LineBasicMaterial({ color: 0x000000 });
    for (let i = 0; i < BOARD_SIZE; i++) {
        // Horizontal lines
        let pointsH = [new THREE.Vector3(0, 0, i), new THREE.Vector3(BOARD_SIZE - 1, 0, i)];
        let geomH = new THREE.BufferGeometry().setFromPoints(pointsH);
        scene.add(new THREE.Line(geomH, material));
        
        // Vertical lines
        let pointsV = [new THREE.Vector3(i, 0, 0), new THREE.Vector3(i, 0, BOARD_SIZE - 1)];
        let geomV = new THREE.BufferGeometry().setFromPoints(pointsV);
        scene.add(new THREE.Line(geomV, material));
    }
}

function addStoneTo3DScene(x, z, player) {
    const key = `${x}-${z}`;
    if (stoneModels[key]) return; // Stone already exists visually

    const settings = player === 1 ? player1Settings : player2Settings;
    const modelPath = PIECE_MODEL_PATHS[settings.piece] || PIECE_MODEL_PATHS['zeus']; // Default to Zeus if invalid
    
    const loader = new THREE.GLTFLoader();
    loader.load(modelPath, gltf => {
        const model = gltf.scene;
        model.scale.set(0.4, 0.4, 0.4);
        model.position.set(x, 0.1, z);
        model.traverse(child => {
            if (child.isMesh) {
                child.material = child.material.clone();
                child.material.color.set(settings.color);
            }
        });
        scene.add(model);
        stoneModels[key] = model;
    }, undefined, error => {
        console.error("Model load error:", error);
        // Fallback to sphere
        const geom = new THREE.SphereGeometry(0.45, 32, 16);
        const mat = new THREE.MeshStandardMaterial({ color: settings.color, roughness: 0.5 });
        const sphere = new THREE.Mesh(geom, mat);
        sphere.position.set(x, 0.45, z);
        scene.add(sphere);
        stoneModels[key] = sphere;
    });
}

function removeStoneFrom3DScene(x, z) {
    const key = `${x}-${z}`;
    if (stoneModels[key]) {
        scene.remove(stoneModels[key]);
        delete stoneModels[key];
    }
}

function onBoardClick(event) {
    if (gameOver || (gameMode === 'multiplayer' && currentPlayer !== localPlayerNum)) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(boardPlane);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const x = Math.round(point.x);
        const z = Math.round(point.z);
        if (x >= 0 && x < BOARD_SIZE && z >= 0 && z < BOARD_SIZE) {
            handlePlayerMove(z, x); // Go boards are often indexed (row, col) which maps to (z, x)
        }
    }
}

function animate() {
    if (!renderer) return; // Stop if scene cleared
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = gameContainer.clientWidth / gameContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
    }
}

// =================================================================
// Go Game Logic
// =================================================================

function initializeBoardArray() {
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
}

/**
 * Main function to attempt placing a stone. Validates the move,
 * checks for captures, and handles suicide and Ko rules.
 * @returns {Array|null} A list of captured stones, or null if the move is invalid.
 */
function placeStone(row, col, player) {
    if (board[row][col] !== 0) return null; // Invalid move: point is not empty

    // Create a temporary board to test the move
    let tempBoard = board.map(r => r.slice());
    tempBoard[row][col] = player;
    
    const opponent = player === 1 ? 2 : 1;
    let capturedStones = [];

    // 1. Check for captures of opponent stones
    const neighbors = getNeighbors(row, col);
    for (const n of neighbors) {
        if (tempBoard[n.row][n.col] === opponent) {
            const group = findGroup(n.row, n.col, tempBoard);
            if (group.liberties === 0) {
                capturedStones.push(...group.stones);
            }
        }
    }
    
    // Remove captured stones from the temporary board
    capturedStones.forEach(stone => tempBoard[stone.row][stone.col] = 0);

    // 2. Check for suicide
    const ownGroup = findGroup(row, col, tempBoard);
    if (ownGroup.liberties === 0) {
        return null; // Invalid move: suicide
    }
    
    // 3. Check for Ko
    const boardString = tempBoard.map(r => r.join('')).join('');
    if (boardString === koState) {
        return null; // Invalid move: Ko
    }
    
    // If we've reached here, the move is valid.
    // Update the real board and return captures.
    if (capturedStones.length > 0) {
        koState = board.map(r => r.join('')).join(''); // Store pre-capture state for Ko
    } else {
        koState = null;
    }
    
    board = tempBoard;
    return capturedStones;
}

/**
 * Simulate placing a stone on a given board and koState, without mutating global state.
 * Returns null if move is illegal, or {capturedStones, tempBoard, newKoState} if legal.
 */
function simulatePlaceStone(row, col, player, boardState, koStateSim) {
    if (boardState[row][col] !== 0) return null;

    let tempBoard = boardState.map(r => r.slice());
    tempBoard[row][col] = player;

    const opponent = player === 1 ? 2 : 1;
    let capturedStones = [];

    const neighbors = getNeighbors(row, col);
    for (const n of neighbors) {
        if (tempBoard[n.row][n.col] === opponent) {
            const group = findGroup(n.row, n.col, tempBoard);
            if (group.liberties === 0) {
                capturedStones.push(...group.stones);
            }
        }
    }

    capturedStones.forEach(stone => tempBoard[stone.row][stone.col] = 0);

    const ownGroup = findGroup(row, col, tempBoard);
    if (ownGroup.liberties === 0) return null;

    const boardString = tempBoard.map(r => r.join('')).join('');
    if (boardString === koStateSim) return null;

    return { capturedStones, tempBoard, newKoState: capturedStones.length > 0 ? boardState.map(r => r.join('')).join('') : null };
}

/**
 * Finds a connected group of stones and its liberties.
 * Uses a Breadth-First Search (BFS) algorithm.
 * @returns {{stones: Array, liberties: number}}
 */
function findGroup(startRow, startCol, boardState) {
    const player = boardState[startRow][startCol];
    if (player === 0) return { stones: [], liberties: 0 };

    const queue = [{ row: startRow, col: startCol }];
    const visited = new Set([`${startRow},${startCol}`]);
    const groupStones = [];
    const libertyPoints = new Set();

    while (queue.length > 0) {
        const { row, col } = queue.shift();
        groupStones.push({ row, col });

        const neighbors = getNeighbors(row, col);
        for (const n of neighbors) {
            const key = `${n.row},${n.col}`;
            if (visited.has(key)) continue;
            
            const neighborState = boardState[n.row][n.col];
            if (neighborState === 0) {
                libertyPoints.add(key);
            } else if (neighborState === player) {
                visited.add(key);
                queue.push({ row: n.row, col: n.col });
            }
        }
    }
    return { stones: groupStones, liberties: libertyPoints.size };
}

function getNeighbors(row, col) {
    const neighbors = [];
    if (row > 0) neighbors.push({ row: row - 1, col: col });
    if (row < BOARD_SIZE - 1) neighbors.push({ row: row + 1, col: col });
    if (col > 0) neighbors.push({ row: row, col: col - 1 });
    if (col < BOARD_SIZE - 1) neighbors.push({ row: row, col: col + 1 });
    return neighbors;
}

// =================================================================
// AI Logic
// =================================================================

function getAIMove() {
    let bestScore = -Infinity;
    let bestMoves = [];
    const availableMoves = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === 0) {
                availableMoves.push({ r, c });
            }
        }
    }
    
    if (availableMoves.length === 0) return { pass: true };

    for (const move of availableMoves) {
        let score = 0;
        // Use simulation helper
        const simResult = simulatePlaceStone(move.r, move.c, 2, board, koState);
        if (!simResult) continue;

        const { capturedStones, tempBoard } = simResult;
        score += capturedStones.length * 100;

        // Heuristics: use tempBoard for group checks
        const neighbors = getNeighbors(move.r, move.c);
        for (const n of neighbors) {
            if (tempBoard[n.row][n.col] === 1) {
                const group = findGroup(n.row, n.col, tempBoard);
                if (group.liberties === 2) score += 25;
            }
        }
        for (const n of neighbors) {
            if (tempBoard[n.row][n.col] === 2) {
                const group = findGroup(n.row, n.col, tempBoard);
                if (group.liberties === 1) score += 50;
            }
        }
        for (const n of neighbors) {
            if (tempBoard[n.row][n.col] === 2) score += 1;
        }
        if (currentDifficulty !== 'easy') {
            const edgeDist = Math.min(move.r, move.c, BOARD_SIZE - 1 - move.r, BOARD_SIZE - 1 - move.c);
            if (edgeDist === 0) score += 3;
            if (edgeDist <= 2) score += 1;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }

    if (bestMoves.length > 0) {
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    } else {
        return availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : { pass: true };
    }
}


// =================================================================
// Game Flow & UI
// =================================================================

function resetGame() {
    if (unsubscribeGameListener) unsubscribeGameListener();
    gameOver = true;
    activeGameId = null;
    localPlayerNum = 0;
    currentPlayer = 1;
    consecutivePasses = 0;
    captures = { 1: 0, 2: 0 };
    koState = null;
    initializeBoardArray();
    if (scene) {
        Object.values(stoneModels).forEach(model => scene.remove(model));
    }
    stoneModels = {};
    updateScoreUI();
    turnText.textContent = "";
    passTurnButton.classList.add('hidden');
}

function startNewAIGame() {
    resetGame();
    gameMode = 'ai';
    currentDifficulty = difficultySelect.value;
    gameOver = false;
    
    player1Settings.color = playerColorInput.value;
    player1Settings.piece = playerPieceSelect.value; // Get selected piece
    player2Settings.color = player1Settings.color === '#FFFFFF' ? '#222222' : '#FFFFFF';
    player2Settings.piece = 'zeus'; // AI can use a default piece
    
    initThreeJS();
    updateStatusText(`Playing vs. AI (${currentDifficulty}).`);
    updateTurnText();
    passTurnButton.classList.remove('hidden');
    closeModal(gameSetupModal);
}

function handlePlayerMove(row, col) {
    const captured = placeStone(row, col, currentPlayer);

    if (captured !== null) { // Move was legal
        consecutivePasses = 0;
        addStoneTo3DScene(col, row, currentPlayer);
        
        if (captured.length > 0) {
            captures[currentPlayer] += captured.length;
            captured.forEach(stone => removeStoneFrom3DScene(stone.col, stone.row));
            updateScoreUI();
        }

        // Switch player
        currentPlayer = (currentPlayer === 1) ? 2 : 1;

        if (gameMode === 'multiplayer') {
            updateGameInFirebase({ board, captures, currentPlayer, consecutivePasses, koState });
        } else {
             updateTurnText();
            if (currentPlayer === 2) {
                setTimeout(aiTurn, 500);
            }
        }
    } else {
        // Illegal move indication (e.g., flash screen red briefly)
        console.log("Illegal move attempted.");
    }
}

function handlePassTurn() {
    if (gameOver || (gameMode === 'multiplayer' && currentPlayer !== localPlayerNum)) return;
    
    consecutivePasses++;
    
    if (consecutivePasses >= 2) {
        endGame();
        if (gameMode === 'multiplayer') {
            updateGameInFirebase({ gameOver: true, winner: determineWinner(), consecutivePasses });
        }
    } else {
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        if (gameMode === 'multiplayer') {
            updateGameInFirebase({ currentPlayer, consecutivePasses });
        } else {
            updateTurnText();
            if (currentPlayer === 2) {
                setTimeout(aiTurn, 500);
            }
        }
    }
}

function aiTurn() {
    if (gameOver) return;
    const move = getAIMove();
    
    if(move.pass) {
        handlePassTurn();
    } else {
        handlePlayerMove(move.r, move.c);
    }
}

function endGame() {
    gameOver = true;
    const winner = determineWinner();
    if (winner === 0) {
        updateStatusText("Game Over - It's a draw!");
    } else {
        const winnerName = (winner === localPlayerNum || (gameMode === 'ai' && winner === 1)) ? "You" : "Opponent";
        updateStatusText(`Game Over - ${winnerName} won!`);
    }
    turnText.textContent = "Thank you for playing.";
    passTurnButton.classList.add('hidden');
}

function determineWinner() {
    if (captures[1] > captures[2]) return 1;
    if (captures[2] > captures[1]) return 2;
    return 0; // Draw
}

function updateScoreUI() {
    player1CapturesText.textContent = captures[1];
    player2CapturesText.textContent = captures[2];
}

function updateStatusText(message) { statusText.textContent = message; }
function updateTurnText() {
    if (gameOver) return;
    if (gameMode === 'ai') {
        turnText.textContent = currentPlayer === 1 ? "Your turn (Black)." : "AI's turn (White)...";
    } else if (gameMode === 'multiplayer') {
        if (activeGameId) {
            turnText.textContent = currentPlayer === localPlayerNum ? "Your turn." : "Opponent's turn.";
        }
    }
}

// =================================================================
// Multiplayer (Firebase)
// =================================================================

async function createMultiplayerGame() {
    if (!auth.currentUser) return;
    resetGame();
    gameMode = 'multiplayer';
    localPlayerNum = 1;
    gameOver = false;
    
    player1Settings.uid = auth.currentUser.uid;
    player1Settings.color = playerColorInput.value;
    player1Settings.piece = playerPieceSelect.value; // Get selected piece
    
    const newGameData = {
        player1: player1Settings, player2: null,
        board, captures, currentPlayer: 1,
        status: 'waiting', consecutivePasses: 0, koState: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        const gameRef = await db.collection('games').add(newGameData);
        activeGameId = gameRef.id;
        initThreeJS();
        updateStatusText("Waiting for opponent...");
        closeModal(gameSetupModal);
        
        shareGameCodeDisplay.value = activeGameId;
        shareGameLinkDisplay.value = `${window.location.origin}${window.location.pathname}?game=${activeGameId}`;
        openModal(shareGameModal);

        listenToGameUpdates(activeGameId);
    } catch (error) { console.error("Error creating game:", error); }
}

async function joinMultiplayerGame(gameId) {
    if (!auth.currentUser) return;
    resetGame();
    const gameRef = db.collection('games').doc(gameId);
    try {
        const doc = await gameRef.get();
        if (!doc.exists) { alert("Game not found."); return; }
        const gameData = doc.data();
        if (gameData.player2 && gameData.player2.uid !== auth.currentUser.uid) { alert("Game is full."); return; }
        if (gameData.player1.uid === auth.currentUser.uid) { alert("Cannot join your own game."); return; }
        
        localPlayerNum = 2;
        player2Settings.uid = auth.currentUser.uid;
        player2Settings.color = gameData.player1.color === '#FFFFFF' ? '#222222' : '#FFFFFF';
        player2Settings.piece = playerPieceSelect.value; // P2 selects their piece
        
        await gameRef.update({ player2: player2Settings, status: 'active' });
        activeGameId = gameId;
        listenToGameUpdates(activeGameId);
        closeModal(joinGameModal);
    } catch (error) { console.error("Error joining game:", error); }
}

function listenToGameUpdates(gameId) {
    if (unsubscribeGameListener) unsubscribeGameListener();
    unsubscribeGameListener = db.collection('games').doc(gameId)
        .onSnapshot(doc => {
            if (!doc.exists) { updateStatusText("Game deleted."); resetGame(); return; }
            const gameData = doc.data();

            if (!renderer && !gameOver) initThreeJS();

            // Sync state
            board = gameData.board;
            captures = gameData.captures;
            currentPlayer = gameData.currentPlayer;
            consecutivePasses = gameData.consecutivePasses;
            koState = gameData.koState;
            player1Settings = gameData.player1;
            if(gameData.player2) player2Settings = gameData.player2;

            // Update UI
            sync3DAndUI(gameData);
            
            if (gameData.gameOver) {
                gameOver = true;
                endGame();
                if (unsubscribeGameListener) unsubscribeGameListener();
            } else {
                gameOver = false;
                passTurnButton.classList.remove('hidden');
                updateTurnText();
            }
        }, error => {
            console.error("Firebase listener error:", error);
            updateStatusText("Connection error.");
        });
}

function sync3DAndUI(gameData) {
    if (!scene) return;
    Object.values(stoneModels).forEach(model => scene.remove(model));
    stoneModels = {};
    for(let r=0; r<BOARD_SIZE; r++) {
        for(let c=0; c<BOARD_SIZE; c++) {
            if(gameData.board[r][c] !== 0) {
                addStoneTo3DScene(c, r, gameData.board[r][c]);
            }
        }
    }
    updateScoreUI();
}

async function updateGameInFirebase(dataToUpdate) {
    if (!activeGameId || !auth.currentUser) return;
    try { await db.collection('games').doc(activeGameId).update(dataToUpdate); }
    catch (error) { console.error("Firebase update error:", error); }
}

// --- Utility Functions ---
function openModal(modal) { modal.classList.remove('hidden'); }
function closeModal(modal) { modal.classList.add('hidden'); }
function copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => alert("Copied!")); }