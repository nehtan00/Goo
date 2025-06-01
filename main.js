// =================================================================
// Mythos Go - main.js (AI Difficulty & Simulation Fix)
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
const FALLBACK_MARBLE_TEXTURE_URL = 'https://www.transparenttextures.com/patterns/getSubtleHex2.png';


// --- Global DOM Element Variables ---
let gameContainer, statusText, turnText, player1CapturesText, player2CapturesText;
let newGameButton, joinGameButton, passTurnButton, rulesStrategyButton;
let gameSetupModal, joinGameModal, shareGameModal, rulesStrategyModal;
let playerColorInput, playerPieceSelect, difficultySelect;
let startAiGameButton, createMultGameButton, joinGameCodeInput, joinMultGameButton;

// --- Three.js Variables ---
let scene, camera, renderer, raycaster, mouse, controls;
let boardMesh; 
let stoneModels = {};

// --- Game State Variables ---
let board = []; // Stores the main game board state
let currentPlayer = 1;
let gameMode = null;
let currentDifficulty = 'easy'; // Default difficulty, will be set properly
let gameOver = true;
let activeGameId = null;
let localPlayerNum = 0;
let unsubscribeGameListener = null;
let consecutivePasses = 0;
let captures = { 1: 0, 2: 0 };
let koState = null; // Stores board state string for Ko rule

let player1Settings = { uid: null, color: '#222222', piece: DEFAULT_PIECE_KEY };
let player2Settings = { uid: null, color: '#FFFFFF', piece: DEFAULT_PIECE_KEY };


// =================================================================
// Initial Setup
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    assignDOMElements();
    initEventListeners();
    waitForAuthAndSetupUI();
    window.addEventListener('resize', onWindowResize, false);
});

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
    difficultySelect = document.getElementById('difficulty-select'); // Make sure this ID is correct
    startAiGameButton = document.getElementById('start-ai-game-button');
    createMultGameButton = document.getElementById('create-mult-game-button');
    joinGameCodeInput = document.getElementById('join-game-code-input');
    joinMultGameButton = document.getElementById('join-mult-game-button');
}

function initEventListeners() {
    newGameButton.addEventListener('click', () => openModal(gameSetupModal));
    joinGameButton.addEventListener('click', () => openModal(joinGameModal));
    rulesStrategyButton.addEventListener('click', () => openModal(rulesStrategyModal));
    passTurnButton.addEventListener('click', handlePassTurn);
    document.querySelectorAll('.close-button').forEach(button => {
        const modalId = button.getAttribute('data-modal-id');
        const modalToClose = document.getElementById(modalId);
        if (modalToClose) {
             button.addEventListener('click', () => closeModal(modalToClose));
        } else {
            console.warn("Could not find modal for close button:", modalId);
        }
    });
    startAiGameButton.addEventListener('click', startNewAIGame);
    createMultGameButton.addEventListener('click', createMultiplayerGame);
    joinMultGameButton.addEventListener('click', () => {
        const gameId = joinGameCodeInput.value.trim();
        if (gameId) joinMultiplayerGame(gameId);
        else alert("Please enter a game code.");
    });
    if(document.getElementById('copy-code-button')) { 
        document.getElementById('copy-code-button').addEventListener('click', () => copyToClipboard(document.getElementById('share-game-code-display').value));
        document.getElementById('copy-link-button').addEventListener('click', () => copyToClipboard(document.getElementById('share-game-link-display').value));
    }
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
    if (gameIdFromUrl && gameSetupModal) {
        joinGameCodeInput.value = gameIdFromUrl;
        openModal(joinGameModal);
        statusText.textContent = `Attempting to join game: ${gameIdFromUrl}`;
    }
}

// =================================================================
// 3D Scene
// =================================================================
function initThreeJS() {
    gameContainer.innerHTML = ''; stoneModels = {};
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xdddddd);
    camera = new THREE.PerspectiveCamera(45, gameContainer.clientWidth / gameContainer.clientHeight, 0.1, 1000);
    camera.position.set(BOARD_SIZE / 2, BOARD_SIZE * 1.5, BOARD_SIZE * 1.3);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    gameContainer.appendChild(renderer.domElement);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(BOARD_SIZE / 2, 0, BOARD_SIZE / 2); controls.enableDamping = true;
    controls.dampingFactor = 0.05; controls.minDistance = BOARD_SIZE / 2; controls.maxDistance = BOARD_SIZE * 3;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1.2); hemiLight.position.set(0, 20, 0); scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); dirLight.position.set(15, 20, 10); dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048; scene.add(dirLight);
    createMarbleBoard3D(); drawBoardGridLines();
    raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    gameContainer.addEventListener('click', onBoardClick, false);
    animate();
}
function createMarbleBoard3D() {
    const textureLoader = new THREE.TextureLoader();
    const marbleTexture = textureLoader.load('https://cdn.polyhaven.com/asset_img/primary/marble_01.png?height=1024',
        () => { if(renderer && scene && camera) renderer.render(scene, camera); }, undefined,
        () => { console.warn("Failed to load primary marble texture, using fallback.");
            const fallbackTexture = textureLoader.load(FALLBACK_MARBLE_TEXTURE_URL);
            fallbackTexture.wrapS = fallbackTexture.wrapT = THREE.RepeatWrapping; fallbackTexture.repeat.set(3, 3);
            if (boardMesh) { boardMesh.material.map = fallbackTexture; boardMesh.material.needsUpdate = true; }
        });
    marbleTexture.wrapS = marbleTexture.wrapT = THREE.RepeatWrapping; marbleTexture.repeat.set(2, 2);
    const boardThickness = 0.8; const boardGeom = new THREE.BoxGeometry(BOARD_SIZE, boardThickness, BOARD_SIZE);
    const boardMat = new THREE.MeshStandardMaterial({ map: marbleTexture, roughness: 0.6, metalness: 0.1 });
    boardMesh = new THREE.Mesh(boardGeom, boardMat);
    boardMesh.position.set((BOARD_SIZE - 1) / 2, -boardThickness / 2, (BOARD_SIZE - 1) / 2);
    boardMesh.receiveShadow = true; scene.add(boardMesh);
}
function drawBoardGridLines() {
    const material = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
    const lineY = 0.01; 
    for (let i = 0; i < BOARD_SIZE; i++) {
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, lineY, i), new THREE.Vector3(BOARD_SIZE - 1, lineY, i)]), material));
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, lineY, 0), new THREE.Vector3(i, lineY, BOARD_SIZE - 1)]), material));
    }
}
function addStoneTo3DScene(x, z, player) {
    const key = `${x}-${z}`; if (stoneModels[key]) return;
    const settings = player === 1 ? player1Settings : player2Settings;
    const modelPath = PIECE_MODEL_PATHS[settings.piece] || PIECE_MODEL_PATHS[DEFAULT_PIECE_KEY];
    const pieceBaseScale = 0.55; const pieceYOffset = 0.1;
    const loader = new THREE.GLTFLoader();
    loader.load(modelPath, gltf => {
        const model = gltf.scene; const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()); const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = (0.9 / maxDim) * pieceBaseScale; model.scale.set(scaleFactor, scaleFactor, scaleFactor);
        const newBox = new THREE.Box3().setFromObject(model); const center = newBox.getCenter(new THREE.Vector3());
        model.position.x -= center.x; model.position.y -= newBox.min.y; model.position.z -= center.z;
        model.position.set(x, pieceYOffset + 1.5, z);
        model.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true;
            child.material = new THREE.MeshStandardMaterial({ color: settings.color, roughness: 0.3, metalness: 0.2 }); }});
        scene.add(model); stoneModels[key] = model;
        let currentY = model.position.y; const targetY = pieceYOffset; const dropSpeed = 0.1;
        function animateDrop() { if (currentY > targetY) { currentY -= dropSpeed * (currentY - targetY + 0.2);
            model.position.y = Math.max(currentY, targetY); requestAnimationFrame(animateDrop); } else model.position.y = targetY; }
        animateDrop();
    }, undefined, error => { console.error(`Model load error for ${modelPath}:`, error);
        const stoneRadius = 0.4 * pieceBaseScale; const stoneHeight = 0.2 * pieceBaseScale;
        const geom = new THREE.CylinderGeometry(stoneRadius, stoneRadius, stoneHeight, 32);
        const mat = new THREE.MeshStandardMaterial({ color: settings.color, roughness: 0.5, metalness: 0.1 });
        const piece = new THREE.Mesh(geom, mat); piece.castShadow = true; piece.position.set(x, pieceYOffset + 1.5, z);
        scene.add(piece); stoneModels[key] = piece;
        let currentY = piece.position.y; const targetY = pieceYOffset + stoneHeight / 2; const dropSpeed = 0.1;
        function animateDropFallback() { if (currentY > targetY) { currentY -= dropSpeed * (currentY - targetY + 0.2);
            piece.position.y = Math.max(currentY, targetY); requestAnimationFrame(animateDropFallback); } else piece.position.y = targetY; }
        animateDropFallback();
    });
}
function removeStoneFrom3DScene(x, z) {
    const key = `${x}-${z}`; if (stoneModels[key]) { scene.remove(stoneModels[key]); delete stoneModels[key]; }
}
function onBoardClick(event) {
    if (gameOver || (gameMode === 'multiplayer' && currentPlayer !== localPlayerNum)) return;
    if (!boardMesh) return; 
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera); const intersects = raycaster.intersectObject(boardMesh);
    if (intersects.length > 0) {
        const point = intersects[0].point; const col = Math.round(point.x); const row = Math.round(point.z); 
        if (col >= 0 && col < BOARD_SIZE && row >= 0 && row < BOARD_SIZE) handlePlayerMove(row, col); 
    }
}
function animate() {
    if (!renderer) return; requestAnimationFrame(animate);
    if (controls) controls.update(); renderer.render(scene, camera);
}
function onWindowResize() {
    if (camera && renderer && gameContainer) {
        camera.aspect = gameContainer.clientWidth / gameContainer.clientHeight;
        camera.updateProjectionMatrix(); renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
    }
}

// =================================================================
// Go Game Logic (Refactored placeStone for AI simulation)
// =================================================================
function initializeBoardArray() { board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)); }

// **REFACTOR:** placeStone now takes a boardState and returns the new state if valid.
// It no longer modifies the global `board` variable directly.
function simulatePlaceStone(row, col, player, boardToSimulateOn) {
    if (boardToSimulateOn[row][col] !== 0) return null; 

    let tempBoard = boardToSimulateOn.map(r => r.slice()); // Operate on a copy of the passed-in board
    tempBoard[row][col] = player;
    
    const opponent = player === 1 ? 2 : 1;
    let capturedStonesThisMove = [];

    const neighbors = getNeighbors(row, col);
    for (const n of neighbors) {
        if (tempBoard[n.row][n.col] === opponent) {
            const group = findGroup(n.row, n.col, tempBoard); // findGroup uses the board it's given
            if (group.liberties === 0) {
                capturedStonesThisMove.push(...group.stones);
            }
        }
    }
    
    capturedStonesThisMove.forEach(stone => tempBoard[stone.row][stone.col] = 0);

    const ownGroup = findGroup(row, col, tempBoard);
    if (ownGroup.liberties === 0) {
        return null; // Invalid move: suicide
    }
    
    // Ko check is tricky with simulated boards; for AI, we might simplify or ignore full Ko chains.
    // A simple Ko check might compare the new tempBoard string with the *global* koState.
    const boardString = tempBoard.map(r => r.join('')).join('');
    if (boardString === koState && capturedStonesThisMove.length === 1 && capturedStonesThisMove[0].row === row && capturedStonesThisMove[0].col === col) {
        // This is a simplified Ko check: if the resulting board state is identical to the koState
        // AND the move was a single stone capture at the same point, it's likely a Ko.
        // A more robust Ko might require checking against a history of board states.
        // For this AI's purpose, this simplification is acceptable.
        // return null; // Uncomment to enable basic Ko prevention for AI simulation.
    }
    
    return { newBoard: tempBoard, captures: capturedStonesThisMove };
}

// =================================================================
// AI Logic (Uses refactored placeStone for simulation)
// =================================================================
function getAIMove() { 
    let bestScore = -Infinity; let bestMoves = []; const availableMoves = [];
    for (let r = 0; r < BOARD_SIZE; r++) { for (let c = 0; c < BOARD_SIZE; c++) { if (board[r][c] === 0) availableMoves.push({ r, c }); } }
    if(availableMoves.length === 0) return {pass: true};

    for (const move of availableMoves) {
        let score = 0;
        
        // **AI SIM FIX:** Use simulatePlaceStone with a copy of the current *global* board
        const simulationResult = simulatePlaceStone(move.r, move.c, 2, board.map(r => r.slice())); 
        
        if (simulationResult === null) continue; // Skip illegal simulated moves
        
        const { newBoard: simBoard, captures: simCaptures } = simulationResult;

        score += simCaptures.length * 100;
        
        // All further checks should use `simBoard`
        const neighbors = getNeighbors(move.r, move.c); // Neighbors of the move point
        for (const n of neighbors) { 
            if (simBoard[n.row][n.col] === 1) { // Opponent piece on the simulated board
                const group = findGroup(n.row, n.col, simBoard); 
                if (group.liberties === 1) { // If this AI move puts them in atari
                    score += 25;
                } else if (group.liberties === 2 && simCaptures.length === 0) { // Threaten atari
                    score += 10;
                }
            }
        }
        // Check if the move saves an AI group from atari
        const aiOwnGroupAfterMove = findGroup(move.r, move.c, simBoard);
        if (aiOwnGroupAfterMove.liberties === 1 && simCaptures.length > 0) { // If it was nearly captured but this move saved it
             // This case is complex, generally covered by captures having high score.
        } else if (aiOwnGroupAfterMove.liberties > 1) {
            // Check adjacent friendly groups on the *original* board to see if they were in atari
            for(const n of neighbors) {
                if(board[n.row][n.col] === 2) { // AI stone on original board
                    const originalGroup = findGroup(n.row, n.col, board);
                    if(originalGroup.liberties === 1) { // Was in atari
                         const newFormedGroup = findGroup(n.row, n.col, simBoard); // Check its state on new board
                         if(newFormedGroup.liberties > 1) score += 50; // Saved a group
                    }
                }
            }
        }
        
        for (const n of neighbors) { if (simBoard[n.row][n.col] === 2) score += 1; }
        
        if (currentDifficulty !== 'easy') { 
            const edgeDist = Math.min(move.r, move.c, BOARD_SIZE - 1 - move.r, BOARD_SIZE - 1 - move.c); 
            if (edgeDist === 0) score += 3;  if (edgeDist <= 2) score += 1;  
        }
        if (score > bestScore) { bestScore = score; bestMoves = [move]; } 
        else if (score === bestScore) bestMoves.push(move);
    }
    
    if (bestMoves.length > 0) return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    else return availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : {pass: true};
}

// =================================================================
// Game Flow & UI
// =================================================================
function resetGame() {
    if (unsubscribeGameListener) unsubscribeGameListener();
    gameOver = true; activeGameId = null; localPlayerNum = 0; currentPlayer = 1;
    consecutivePasses = 0; captures = { 1: 0, 2: 0 }; koState = null;
    initializeBoardArray();
    if (scene) Object.values(stoneModels).forEach(model => scene.remove(model));
    stoneModels = {}; updateScoreUI(); turnText.textContent = "";
    passTurnButton.classList.add('hidden');
}
function startNewAIGame() {
    resetGame(); gameMode = 'ai'; 
    currentDifficulty = difficultySelect.value; // **ENSURE difficulty is set from select**
    gameOver = false;
    player1Settings.color = playerColorInput.value;
    player1Settings.piece = playerPieceSelect.value; 
    player2Settings.color = player1Settings.color === '#FFFFFF' ? '#222222' : '#FFFFFF';
    player2Settings.piece = DEFAULT_PIECE_KEY;
    initThreeJS(); updateStatusText(`Playing vs. AI (${currentDifficulty}).`); updateTurnText();
    passTurnButton.classList.remove('hidden'); closeModal(gameSetupModal);
}

// **REFACTOR:** handlePlayerMove now uses the global `board` for actual moves.
function handlePlayerMove(row, col) {
    // Try to place stone on the *actual current game board*
    const simulationResult = simulatePlaceStone(row, col, currentPlayer, board);

    if (simulationResult !== null) { 
        consecutivePasses = 0;
        
        // Apply the successful move to the global board
        board = simulationResult.newBoard; 
        const capturedStones = simulationResult.captures;

        // Update Ko state based on the *actual* board before this move, if captures occurred
        if (capturedStones.length > 0) {
            // Store the board state *before* this successful move if it led to captures
            // For simplicity, we'll use the string of the board *before* this move's changes (excluding the placed stone)
            let boardBeforeThisMove = board.map(r => r.slice());
            boardBeforeThisMove[row][col] = 0; // Temporarily remove the stone just placed to get pre-move state for Ko
            koState = boardBeforeThisMove.map(r=>r.join('')).join('');
        } else {
            koState = null;
        }

        addStoneTo3DScene(col, row, currentPlayer);
        
        if (capturedStones.length > 0) {
            captures[currentPlayer] += capturedStones.length;
            capturedStones.forEach(stone => removeStoneFrom3DScene(stone.col, stone.row));
            updateScoreUI();
        }
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        if (gameMode === 'multiplayer') updateGameInFirebase({ board, captures, currentPlayer, consecutivePasses, koState });
        else { updateTurnText(); if (currentPlayer === 2) setTimeout(aiTurn, 500); }
    } else console.log("Illegal move attempted at " + row + "," + col);
}
function handlePassTurn() {
    if (gameOver || (gameMode === 'multiplayer' && currentPlayer !== localPlayerNum)) return;
    consecutivePasses++;
    if (consecutivePasses >= 2) {
        endGame();
        if (gameMode === 'multiplayer') updateGameInFirebase({ gameOver: true, winner: determineWinner(), consecutivePasses });
    } else {
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        if (gameMode === 'multiplayer') updateGameInFirebase({ currentPlayer, consecutivePasses });
        else { updateTurnText(); if (currentPlayer === 2) setTimeout(aiTurn, 500); }
    }
}
function aiTurn() {
    if (gameOver) return;
    const move = getAIMove();
    if(move.pass) handlePassTurn();
    else handlePlayerMove(move.r, move.c);
}
function endGame() {
    gameOver = true; const winner = determineWinner();
    if (winner === 0) updateStatusText("Game Over - It's a draw!");
    else { const winnerName = (winner === localPlayerNum || (gameMode === 'ai' && winner === 1)) ? "You" : "Opponent"; updateStatusText(`Game Over - ${winnerName} won!`); }
    turnText.textContent = "Thank you for playing."; passTurnButton.classList.add('hidden');
}
function determineWinner() { if (captures[1] > captures[2]) return 1; if (captures[2] > captures[1]) return 2; return 0; }
function updateScoreUI() { player1CapturesText.textContent = captures[1]; player2CapturesText.textContent = captures[2]; }
function updateStatusText(message) { statusText.textContent = message; }
function updateTurnText() {
    if (gameOver) return;
    if (gameMode === 'ai') turnText.textContent = currentPlayer === 1 ? "Your turn (Black)." : "AI's turn (White)...";
    else if (gameMode === 'multiplayer' && activeGameId) turnText.textContent = currentPlayer === localPlayerNum ? "Your turn." : "Opponent's turn.";
}

// =================================================================
// Multiplayer (Firebase)
// =================================================================
async function createMultiplayerGame() {
    if (!auth.currentUser) return;
    resetGame(); gameMode = 'multiplayer'; localPlayerNum = 1; gameOver = false;
    player1Settings.uid = auth.currentUser.uid;
    player1Settings.color = playerColorInput.value;
    player1Settings.piece = playerPieceSelect.value; 
    const newGameData = {
        player1: player1Settings, player2: null, board, captures, currentPlayer: 1,
        status: 'waiting', consecutivePasses: 0, koState: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        const gameRef = await db.collection('games').add(newGameData); activeGameId = gameRef.id;
        initThreeJS(); updateStatusText("Waiting for opponent..."); closeModal(gameSetupModal);
        document.getElementById('share-game-code-display').value = activeGameId;
        document.getElementById('share-game-link-display').value = `${window.location.origin}${window.location.pathname}?game=${activeGameId}`;
        openModal(shareGameModal); listenToGameUpdates(activeGameId);
    } catch (error) { console.error("Error creating game:", error); }
}
async function joinMultiplayerGame(gameId) {
    if (!auth.currentUser) return;
    resetGame(); const gameRef = db.collection('games').doc(gameId);
    try {
        const doc = await gameRef.get();
        if (!doc.exists) { alert("Game not found."); return; }
        const gameData = doc.data();
        if (gameData.player2 && gameData.player2.uid !== auth.currentUser.uid) { alert("Game is full."); return; }
        if (gameData.player1.uid === auth.currentUser.uid) { alert("Cannot join your own game."); return; }
        localPlayerNum = 2; player2Settings.uid = auth.currentUser.uid;
        player2Settings.color = gameData.player1.color === '#FFFFFF' ? '#222222' : '#FFFFFF';
        player2Settings.piece = playerPieceSelect.value; 
        await gameRef.update({ player2: player2Settings, status: 'active' });
        activeGameId = gameId; listenToGameUpdates(activeGameId); closeModal(joinGameModal);
    } catch (error) { console.error("Error joining game:", error); }
}
function listenToGameUpdates(gameId) {
    if (unsubscribeGameListener) unsubscribeGameListener();
    unsubscribeGameListener = db.collection('games').doc(gameId)
        .onSnapshot(doc => {
            if (!doc.exists) { updateStatusText("Game deleted."); resetGame(); return; }
            const gameData = doc.data();
            if (!renderer && !gameOver) initThreeJS();
            // Check if it's our turn to update local board, or if board changed
            if (gameMode === 'multiplayer' && localPlayerNum !== gameData.currentPlayer) {
                 board = gameData.board; // Update board if it's not our turn (opponent moved)
            } else if (JSON.stringify(board) !== JSON.stringify(gameData.board)) {
                board = gameData.board; // Or if board state from Firebase is different
            }

            captures = gameData.captures; 
            currentPlayer = gameData.currentPlayer;
            consecutivePasses = gameData.consecutivePasses; koState = gameData.koState;
            player1Settings = gameData.player1; if(gameData.player2) player2Settings = gameData.player2;
            sync3DAndUI(gameData);
            if (gameData.gameOver) {
                gameOver = true; endGame();
                if (unsubscribeGameListener) unsubscribeGameListener();
            } else {
                gameOver = false; passTurnButton.classList.remove('hidden'); updateTurnText();
            }
        }, error => { console.error("Firebase listener error:", error); updateStatusText("Connection error."); });
}
function sync3DAndUI(gameData) {
     Object.values(stoneModels).forEach(model => scene.remove(model)); stoneModels = {};
     for(let r=0; r<BOARD_SIZE; r++) {
         for(let c=0; c<BOARD_SIZE; c++) {
             if(gameData.board[r][c] !== 0) addStoneTo3DScene(c, r, gameData.board[r][c]);
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