// =================================================================
// Mythos Go - main.js (Visual & Bugfix Overhaul)
// =================================================================

// --- Constants ---
const BOARD_SIZE = 9;
const PIECE_MODEL_PATHS = {
    'Achilles': 'assets/achilles.glb',
    'War Elephant': 'assets/war_elephant.glb',
    'Knight Horse': 'assets/knight_horse.glb',
    'Aztec': 'assets/aztec.glb'
};
const DEFAULT_PIECE_KEY = 'Achilles';
// Marble texture for the board. Found a free, high-quality one.
const MARBLE_TEXTURE_URL = 'https://www.transparenttextures.com/patterns/marble-white.png';

// --- Global DOM Element Variables ---
// Declared globally, but assigned after the DOM is loaded.
let gameContainer, statusText, turnText, player1CapturesText, player2CapturesText;
let newGameButton, joinGameButton, passTurnButton, rulesStrategyButton;
let gameSetupModal, joinGameModal, shareGameModal, rulesStrategyModal;
let playerColorInput, playerPieceSelect, difficultySelect;
let startAiGameButton, createMultGameButton, joinGameCodeInput, joinMultGameButton;

// --- Three.js Variables ---
let scene, camera, renderer, raycaster, mouse;
let boardMesh; // The 3D marble slab for the board
let stoneModels = {};

// --- Game State Variables ---
let board = [];
let currentPlayer = 1;
let gameMode = null;
let currentDifficulty = 'easy';
let gameOver = true;
let activeGameId = null;
let localPlayerNum = 0;
let unsubscribeGameListener = null;
let consecutivePasses = 0;
let captures = { 1: 0, 2: 0 };
let koState = null;

let player1Settings = { uid: null, color: '#222222', piece: DEFAULT_PIECE_KEY };
let player2Settings = { uid: null, color: '#FFFFFF', piece: DEFAULT_PIECE_KEY };

// =================================================================
// Initial Setup
// =================================================================

// Main entry point: waits for the HTML to be ready before doing anything.
document.addEventListener('DOMContentLoaded', () => {
    assignDOMElements();
    initEventListeners();
    waitForAuthAndSetupUI();
    window.addEventListener('resize', onWindowResize, false);
});

// **FIX:** Assigns all DOM variables in one place, after the page has loaded.
// This prevents "Cannot read properties of null" errors.
function assignDOMElements() {
    gameContainer = document.getElementById('game-container');
    statusText = document.getElementById('status-text');
    turnText = document.getElementById('turn-text');
    player1CapturesText = document.getElementById('player1-captures');
    player2CapturesText = document.getElementById('player2-captures');
    newGameButton = document.getElementById('new-game-button');
    joinGameButton = document.getElementById('join-game-button');
    passTurnButton = document.getElementById('pass-turn-button');
    rulesStrategyButton = document.getElementById('rules-strategy-button');
    gameSetupModal = document.getElementById('game-setup-modal');
    joinGameModal = document.getElementById('join-game-modal');
    shareGameModal = document.getElementById('share-game-modal');
    rulesStrategyModal = document.getElementById('rules-strategy-modal');
    playerColorInput = document.getElementById('player-color-input');
    playerPieceSelect = document.getElementById('player-piece-select');
    difficultySelect = document.getElementById('difficulty-select');
    startAiGameButton = document.getElementById('start-ai-game-button');
    createMultGameButton = document.getElementById('create-mult-game-button');
    joinGameCodeInput = document.getElementById('join-game-code-input');
    joinMultGameButton = document.getElementById('join-mult-game-button');
}

// **FIX:** Attaches all event listeners in one place.
function initEventListeners() {
    newGameButton.addEventListener('click', () => openModal(gameSetupModal));
    joinGameButton.addEventListener('click', () => openModal(joinGameModal));
    rulesStrategyButton.addEventListener('click', () => openModal(rulesStrategyModal));
    passTurnButton.addEventListener('click', handlePassTurn);

    // Add listeners for all close buttons
    document.querySelectorAll('.close-button').forEach(button => {
        const modalId = button.getAttribute('data-modal-id');
        button.addEventListener('click', () => closeModal(document.getElementById(modalId)));
    });

    startAiGameButton.addEventListener('click', startNewAIGame);
    createMultGameButton.addEventListener('click', createMultiplayerGame);
    joinMultGameButton.addEventListener('click', () => {
        const gameId = joinGameCodeInput.value.trim();
        if (gameId) joinMultiplayerGame(gameId);
        else alert("Please enter a game code.");
    });

    // Share buttons
    document.getElementById('copy-code-button').addEventListener('click', () => copyToClipboard(document.getElementById('share-game-code-display').value));
    document.getElementById('copy-link-button').addEventListener('click', () => copyToClipboard(document.getElementById('share-game-link-display').value));
}

function waitForAuthAndSetupUI() {
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(user => {
            if (user) {
                player1Settings.uid = user.uid; 
                checkUrlForGameToJoin();
            } else {
                statusText.textContent = "Connecting to game services...";
            }
        });
    } else {
        console.error("Firebase Auth not available.");
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

// =================================================================
// 3D Scene Overhaul (Three.js)
// =================================================================

function initThreeJS() {
    gameContainer.innerHTML = '';
    stoneModels = {};

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(50, gameContainer.clientWidth / gameContainer.clientHeight, 0.1, 1000);
    // **VISUAL FIX:** Better camera angle for a more 3D feel.
    camera.position.set(BOARD_SIZE / 2, BOARD_SIZE * 1.2, BOARD_SIZE * 1.2);
    camera.lookAt(BOARD_SIZE / 2, 0, BOARD_SIZE / 2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
    renderer.shadowMap.enabled = true; // Enable shadows
    gameContainer.appendChild(renderer.domElement);

    // **VISUAL FIX:** Improved lighting for better depth and realism.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0)); // Soft ambient light
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 15, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    createMarbleBoard();
    drawBoardGrid();

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    gameContainer.addEventListener('click', onBoardClick, false);
    
    animate();
}

// **VISUAL FIX:** Create a 3D board slab with a marble texture.
function createMarbleBoard() {
    const textureLoader = new THREE.TextureLoader();
    const marbleTexture = textureLoader.load(MARBLE_TEXTURE_URL);
    marbleTexture.wrapS = marbleTexture.wrapT = THREE.RepeatWrapping;
    marbleTexture.repeat.set(4, 4);

    const boardGeom = new THREE.BoxGeometry(BOARD_SIZE, 0.5, BOARD_SIZE);
    const boardMat = new THREE.MeshStandardMaterial({ 
        map: marbleTexture,
        roughness: 0.8,
        metalness: 0.2
    });
    boardMesh = new THREE.Mesh(boardGeom, boardMat);
    boardMesh.position.set((BOARD_SIZE - 1) / 2, -0.25, (BOARD_SIZE - 1) / 2);
    boardMesh.receiveShadow = true;
    scene.add(boardMesh);
}

function drawBoardGrid() {
    const material = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    const lineY = 0.01; // Position lines slightly above the board surface
    for (let i = 0; i < BOARD_SIZE; i++) {
        // Horizontal lines
        let pointsH = [new THREE.Vector3(0, lineY, i), new THREE.Vector3(BOARD_SIZE - 1, lineY, i)];
        let geomH = new THREE.BufferGeometry().setFromPoints(pointsH);
        scene.add(new THREE.Line(geomH, material));
        
        // Vertical lines
        let pointsV = [new THREE.Vector3(i, lineY, 0), new THREE.Vector3(i, lineY, BOARD_SIZE - 1)];
        let geomV = new THREE.BufferGeometry().setFromPoints(pointsV);
        scene.add(new THREE.Line(geomV, material));
    }
}

// **FIX:** More robust model loading and scaling.
function addStoneTo3DScene(x, z, player) {
    const key = `${x}-${z}`;
    if (stoneModels[key]) return;

    const settings = player === 1 ? player1Settings : player2Settings;
    const modelPath = PIECE_MODEL_PATHS[settings.piece] || PIECE_MODEL_PATHS[DEFAULT_PIECE_KEY];
    
    const loader = new THREE.GLTFLoader();
    loader.load(modelPath, gltf => {
        const model = gltf.scene;
        // Center and scale the model correctly after loading
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center); // Center the model's geometry
        model.scale.set(0.4, 0.4, 0.4); // Uniform scale
        model.position.set(x, 0.25, z); // Place on the board

        model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.material = child.material.clone();
                child.material.color.set(settings.color);
            }
        });
        scene.add(model);
        stoneModels[key] = model;
    }, undefined, error => {
        console.error(`Model load error for ${modelPath}:`, error);
        // Better looking fallback sphere
        const geom = new THREE.SphereGeometry(0.45, 32, 16);
        const mat = new THREE.MeshStandardMaterial({ color: settings.color, roughness: 0.5, metalness: 0.1 });
        const sphere = new THREE.Mesh(geom, mat);
        sphere.castShadow = true;
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

    // Use boardMesh for raycasting for better accuracy on a 3D surface
    if (!boardMesh) return; 

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(boardMesh);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        // Adjust for the board's centered position
        const boardOriginOffset = (BOARD_SIZE - 1) / 2;
        const x = Math.round(point.x + boardOriginOffset);
        const z = Math.round(point.z + boardOriginOffset);
        
        if (x >= 0 && x < BOARD_SIZE && z >= 0 && z < BOARD_SIZE) {
            handlePlayerMove(z, x); // Go boards are (row, col) -> (z, x)
        }
    }
}

function animate() {
    if (!renderer) return;
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
// Go Game Logic (No changes needed here)
// =================================================================

function initializeBoardArray() {
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0));
}

function placeStone(row, col, player) {
    if (board[row][col] !== 0) return null; 
    let tempBoard = board.map(r => r.slice());
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
    if (boardString === koState) return null; 
    if (capturedStones.length > 0) {
        koState = board.map(r => r.join('')).join(''); 
    } else {
        koState = null;
    }
    board = tempBoard;
    return capturedStones;
}

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
// AI Logic (No changes needed here)
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
    if(availableMoves.length === 0) return {pass: true};
    for (const move of availableMoves) {
        let score = 0;
        const tempBoard = board.map(r => r.slice());
        const capturedStones = placeStone(move.r, move.c, 2); 
        if (capturedStones === null) continue; 
        score += capturedStones.length * 100;
        board = tempBoard; 
        const neighbors = getNeighbors(move.r, move.c);
        for (const n of neighbors) {
            if (board[n.row][n.col] === 1) { 
                const group = findGroup(n.row, n.col, board);
                if (group.liberties === 2) score += 25;
            }
        }
        for (const n of neighbors) {
            if (board[n.row][n.col] === 2) {
                const group = findGroup(n.row, n.col, board);
                if (group.liberties === 1) score += 50; 
            }
        }
        for (const n of neighbors) {
            if (board[n.row][n.col] === 2) score += 1;
        }
        if (difficulty !== 'easy') {
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
    board = board.map(r => r.slice()); 
    if (bestMoves.length > 0) {
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    } else {
        return availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : {pass: true};
    }
}

// =================================================================
// Game Flow & UI (No major changes, just ensuring functions are called correctly)
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
    if (scene) Object.values(stoneModels).forEach(model => scene.remove(model));
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
    player1Settings.piece = playerPieceSelect.value; 
    player2Settings.color = player1Settings.color === '#FFFFFF' ? '#222222' : '#FFFFFF';
    player2Settings.piece = DEFAULT_PIECE_KEY;
    initThreeJS();
    updateStatusText(`Playing vs. AI (${currentDifficulty}).`);
    updateTurnText();
    passTurnButton.classList.remove('hidden');
    closeModal(gameSetupModal);
}

function handlePlayerMove(row, col) {
    const captured = placeStone(row, col, currentPlayer);
    if (captured !== null) { 
        consecutivePasses = 0;
        addStoneTo3DScene(col, row, currentPlayer);
        if (captured.length > 0) {
            captures[currentPlayer] += captured.length;
            captured.forEach(stone => removeStoneFrom3DScene(stone.col, stone.row));
            updateScoreUI();
        }
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        if (gameMode === 'multiplayer') {
            updateGameInFirebase({ board, captures, currentPlayer, consecutivePasses, koState });
        } else {
             updateTurnText();
            if (currentPlayer === 2) setTimeout(aiTurn, 500);
        }
    } else {
        console.log("Illegal move attempted.");
    }
}

function handlePassTurn() {
    if (gameOver || (gameMode === 'multiplayer' && currentPlayer !== localPlayerNum)) return;
    consecutivePasses++;
    if (consecutivePasses >= 2) {
        endGame();
        if (gameMode === 'multiplayer') updateGameInFirebase({ gameOver: true, winner: determineWinner(), consecutivePasses });
    } else {
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        if (gameMode === 'multiplayer') {
            updateGameInFirebase({ currentPlayer, consecutivePasses });
        } else {
            updateTurnText();
            if (currentPlayer === 2) setTimeout(aiTurn, 500);
        }
    }
}

function aiTurn() {
    if (gameOver) return;
    const move = getAIMove();
    if(move.pass) handlePassTurn();
    else handlePlayerMove(move.r, move.c);
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
    return 0; 
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
    } else if (gameMode === 'multiplayer' && activeGameId) {
        turnText.textContent = currentPlayer === localPlayerNum ? "Your turn." : "Opponent's turn.";
    }
}

// =================================================================
// Multiplayer (Firebase) (No major changes needed here)
// =================================================================

async function createMultiplayerGame() {
    if (!auth.currentUser) return;
    resetGame();
    gameMode = 'multiplayer';
    localPlayerNum = 1;
    gameOver = false;
    player1Settings.uid = auth.currentUser.uid;
    player1Settings.color = playerColorInput.value;
    player1Settings.piece = playerPieceSelect.value; 
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
        document.getElementById('share-game-code-display').value = activeGameId;
        document.getElementById('share-game-link-display').value = `${window.location.origin}${window.location.pathname}?game=${activeGameId}`;
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
        player2Settings.piece = playerPieceSelect.value; 
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
            board = gameData.board;
            captures = gameData.captures;
            currentPlayer = gameData.currentPlayer;
            consecutivePasses = gameData.consecutivePasses;
            koState = gameData.koState;
            player1Settings = gameData.player1;
            if(gameData.player2) player2Settings = gameData.player2;
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
function openModal(modal) { if (modal) modal.classList.remove('hidden'); }
function closeModal(modal) { if (modal) modal.classList.add('hidden'); }
function copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => alert("Copied!")); }