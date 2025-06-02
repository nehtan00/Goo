// =================================================================
// Mythos Go - main.js (Individual Piece Scaling)
// =================================================================

// --- ES6 Module Imports ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'; 

console.log("main.js: SCRIPT EXECUTION STARTED (TOP OF FILE).");

// --- Constants ---
const BOARD_SIZE = 9;

// **NEW: PIECE DEFINITIONS with individual scale multipliers**
// You will need to adjust the `scaleMultiplier` for each piece
// to get the visual balance you want. 1.0 is the baseline.
const PIECE_DEFINITIONS = {
    'Achilles':     { path: 'assets/achilles.glb',      scaleMultiplier: 2.0 },
    'War Elephant': { path: 'assets/war_elephant.glb',  scaleMultiplier: 1.8 }, // You'll likely want to adjust this
    'Valkyrie':     { path: 'assets/valkyrie.glb',  scaleMultiplier: 1.3 },
    'Aztec':        { path: 'assets/aztec.glb',         scaleMultiplier: 1.9 }
};
const DEFAULT_PIECE_KEY = 'Achilles'; // Fallback if a selected piece isn't in PIECE_DEFINITIONS

// PBR TEXTURE PATHS FOR THE BOARD (ensure these are correct)
const MARBLE_ALBEDO_PATH = 'assets/marble_albedo.png';    
const MARBLE_ROUGHNESS_PATH = 'assets/marble_roughness.png'; 
const MARBLE_NORMAL_PATH = 'assets/marble_normal.png';    
const MARBLE_AO_PATH = 'assets/marble_ao.png'; 
const MARBLE_DISPLACEMENT_PATH = 'assets/marble_displacement.png'; 

// --- Global DOM Element Variables ---
// ... (declarations remain the same)
let gameContainer, statusText, turnText, player1CapturesText, player2CapturesText;
let newGameButton, joinGameButton, passTurnButton, rulesStrategyButton;
let gameSetupModal, joinGameModal, shareGameModal, rulesStrategyModal;
let playerColorInput, playerPieceSelect, difficultySelect;
let startAiGameButton, createMultGameButton, joinGameCodeInput, joinMultGameButton;
let logoImg; // Add this to your global DOM variables

// --- Three.js Variables ---
// ... (declarations remain the same)
let scene, camera, renderer, raycaster, mouse, controls;
let boardMesh; 
let stoneModels = {};

// --- Game State Variables ---
// ... (declarations remain the same)
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
// ... (DOMContentLoaded, assignDOMElements, initEventListeners, waitForAuthAndSetupUI, checkUrlForGameToJoin remain the same)
document.addEventListener('DOMContentLoaded', () => {
    console.log("main.js: DOMContentLoaded event FIRED.");
    try {
        assignDOMElements(); 
        initEventListeners(); 
        waitForAuthAndSetupUI();
        window.addEventListener('resize', onWindowResize, false);
        console.log("main.js: Initial setup within DOMContentLoaded COMPLETED.");
    } catch (error) {
        console.error("main.js: ERROR during initial setup inside DOMContentLoaded:", error);
        if (statusText) statusText.textContent = "Error initializing game. Please check console.";
        else console.error("main.js: statusText element NOT FOUND when trying to report DOMContentLoaded error.");
    }
});

function assignDOMElements() { /* ... unchanged ... */ 
    console.log("main.js: assignDOMElements() CALLED.");
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
    logoImg = document.getElementById('logo-img');
    if (!newGameButton) console.error("main.js: newGameButton NOT FOUND in assignDOMElements!");
    if (!gameContainer) console.error("main.js: gameContainer NOT FOUND in assignDOMElements!");
    console.log("main.js: assignDOMElements() FINISHED.");
}
function initEventListeners() { /* ... unchanged ... */ 
    console.log("main.js: initEventListeners() CALLED.");
    if (newGameButton) newGameButton.addEventListener('click', () => { console.log("New Game button CLICKED"); openModal(gameSetupModal); }); else console.error("New Game button not found for listener.");
    if (joinGameButton) joinGameButton.addEventListener('click', () => { console.log("Join Game button CLICKED"); openModal(joinGameModal); }); else console.error("Join Game button not found for listener.");
    if (rulesStrategyButton) rulesStrategyButton.addEventListener('click', () => { console.log("Rules button CLICKED"); openModal(rulesStrategyModal); }); else console.error("Rules button not found for listener.");
    if (passTurnButton) passTurnButton.addEventListener('click', handlePassTurn); else console.error("Pass Turn button not found for listener.");
    document.querySelectorAll('.close-button').forEach(button => {
        const modalId = button.getAttribute('data-modal-id');
        const modalToClose = document.getElementById(modalId);
        if (modalToClose) { button.addEventListener('click', () => closeModal(modalToClose)); } 
        else { console.warn("Could not find modal for close button with ID:", modalId); }
    });
    if (startAiGameButton) startAiGameButton.addEventListener('click', startNewAIGame); else console.error("Start AI Game button not found for listener.");
    if (createMultGameButton) createMultGameButton.addEventListener('click', createMultiplayerGame); else console.error("Create Multiplayer Game button not found for listener.");
    if (joinMultGameButton) joinMultGameButton.addEventListener('click', () => {
        if(joinGameCodeInput) { const gameId = joinGameCodeInput.value.trim(); if (gameId) joinMultiplayerGame(gameId); else alert("Please enter a game code."); } 
        else { console.error("Join game code input not found."); }
    }); else console.error("Join Multiplayer Game with Code button not found for listener.");
    const copyCodeBtn = document.getElementById('copy-code-button');
    const copyLinkBtn = document.getElementById('copy-link-button');
    if(copyCodeBtn) copyCodeBtn.addEventListener('click', () => copyToClipboard(document.getElementById('share-game-code-display').value));
    if(copyLinkBtn) copyLinkBtn.addEventListener('click', () => copyToClipboard(document.getElementById('share-game-link-display').value));
    if (logoImg) logoImg.addEventListener('click', () => {
        console.log("Logo clicked, restarting game.");
       openModal(gameSetupModal);
    });
    console.log("main.js: initEventListeners() FINISHED.");
}
function waitForAuthAndSetupUI() { /* ... unchanged ... */ 
    console.log("main.js: waitForAuthAndSetupUI() CALLED.");
    if (typeof auth !== 'undefined' && auth) { 
        auth.onAuthStateChanged(user => {
            if (user) { player1Settings.uid = user.uid; checkUrlForGameToJoin(); console.log("main.js: User authenticated, UID:", user.uid); } 
            else { console.log("main.js: User is signed out or anonymous sign-in pending in onAuthStateChanged."); }
        });
    } else {
        console.error("main.js: Firebase Auth object (auth) not available globally. Check firebase.js loading order and initialization.");
        if(statusText) statusText.textContent = "Error: Auth services unavailable.";
    }
}
function checkUrlForGameToJoin() { /* ... unchanged ... */ 
    console.log("main.js: checkUrlForGameToJoin() called.");
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    if (gameIdFromUrl && joinGameModal && joinGameCodeInput) { 
        joinGameCodeInput.value = gameIdFromUrl;
        openModal(joinGameModal);
        if(statusText) statusText.textContent = `Attempting to join game: ${gameIdFromUrl}`;
    }
}

// =================================================================
// 3D Scene
// =================================================================
function initThreeJS() {
    console.log("main.js: initThreeJS() CALLED.");
    if (!gameContainer) { console.error("main.js: gameContainer not found for Three.js."); return; }
    gameContainer.innerHTML = ''; stoneModels = {};
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xdddddd); 
    camera = new THREE.PerspectiveCamera(45, gameContainer.clientWidth / gameContainer.clientHeight, 0.1, 1000);
    camera.position.set(BOARD_SIZE / 2, BOARD_SIZE * 1.6, BOARD_SIZE * 1.4); 
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8; // Your current exposure setting
    renderer.outputEncoding = THREE.sRGBEncoding;
    gameContainer.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement); 
    controls.target.set(BOARD_SIZE / 2, 0, BOARD_SIZE / 2); controls.enableDamping = true;
    controls.dampingFactor = 0.05; controls.minDistance = BOARD_SIZE * 0.7; controls.maxDistance = BOARD_SIZE * 2.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; 
    
    // Your Candlelight Color Setup
    const candlelight = 0xffd580; 
    const groundColor = 0x402808; 
    const hemiLight = new THREE.HemisphereLight(candlelight, groundColor, 1.2); 
    hemiLight.position.set(0, 20, 0); 
    scene.add(hemiLight);
    
    const dirLight = new THREE.DirectionalLight(candlelight, 1.2); 
    dirLight.position.set(10, 15, 12); 
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; 
    dirLight.shadow.mapSize.height = 2048; 

    // ** NEW: Shadow Camera properties for dirLight to expand "beam" **
    const shadowCamSize = BOARD_SIZE * 2.5; // Adjust this multiplier to change beam size (e.g., 1.5, 2.0, 2.5)
    dirLight.shadow.camera.near = 0.5;    
    dirLight.shadow.camera.far = 50;      
    dirLight.shadow.camera.left = -shadowCamSize / 2;
    dirLight.shadow.camera.right = shadowCamSize / 2;
    dirLight.shadow.camera.top = shadowCamSize / 2;
    dirLight.shadow.camera.bottom = -shadowCamSize / 2;
    // dirLight.shadow.camera.updateProjectionMatrix(); // Usually not needed if set before first render

    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(candlelight, 0.3); 
    fillLight.position.set(-10, 10, -5);
    scene.add(fillLight);
    
    createFloatingGridBoard(); 
    raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    if (gameContainer) gameContainer.addEventListener('click', onBoardClick, false);
    animate();
}

function createFloatingGridBoard() { /* ... PBR texture loading unchanged ... */
    console.log("main.js: createFloatingGridBoard() called.");
    const boardThickness = 0.7; 
    const boardRadius = 0.25; 
    const boardSegments = 16; 
    let boardGeom;
    if (RoundedBoxGeometry) { 
        boardGeom = new RoundedBoxGeometry(BOARD_SIZE, boardThickness, BOARD_SIZE, boardSegments, boardRadius);
    } else {
        console.warn("main.js: RoundedBoxGeometry class not available, using BoxGeometry for board.");
        boardGeom = new THREE.BoxGeometry(BOARD_SIZE, boardThickness, BOARD_SIZE, boardSegments, 1, boardSegments);
    }
    if (boardGeom.attributes.uv) { boardGeom.setAttribute('uv2', new THREE.BufferAttribute(boardGeom.attributes.uv.array, 2)); } 
    else { console.warn("Board geometry does not have UV attributes; aoMap might not display correctly."); }
    const textureLoader = new THREE.TextureLoader();
    console.log("Loading PBR Textures with paths:", MARBLE_ALBEDO_PATH, MARBLE_ROUGHNESS_PATH, MARBLE_NORMAL_PATH, MARBLE_AO_PATH, MARBLE_DISPLACEMENT_PATH);
    const albedoMap = textureLoader.load(MARBLE_ALBEDO_PATH, undefined, undefined, (err) => console.error(`Albedo Load Error: ${MARBLE_ALBEDO_PATH}`, err));
    const roughnessMap = textureLoader.load(MARBLE_ROUGHNESS_PATH, undefined, undefined, (err) => console.error(`Roughness Load Error: ${MARBLE_ROUGHNESS_PATH}`, err));
    const normalMap = textureLoader.load(MARBLE_NORMAL_PATH, undefined, undefined, (err) => console.error(`Normal Load Error: ${MARBLE_NORMAL_PATH}`, err));
    const aoMap = textureLoader.load(MARBLE_AO_PATH, undefined, undefined, (err) => console.error(`AO Load Error: ${MARBLE_AO_PATH}`, err));
    const displacementMap = textureLoader.load(MARBLE_DISPLACEMENT_PATH, undefined, undefined, (err) => console.error(`Displacement Load Error: ${MARBLE_DISPLACEMENT_PATH}`, err));
    [albedoMap, roughnessMap, normalMap, aoMap, displacementMap].forEach(map => {
        if (map) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1, 1); map.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
    });
    const boardMat = new THREE.MeshStandardMaterial({ 
        map: albedoMap, roughnessMap: roughnessMap, normalMap: normalMap, aoMap: aoMap, aoMapIntensity: 0.6, 
        displacementMap: displacementMap, displacementScale: 0.01, roughness: 0.5, metalness: 0.0,
    });
    boardMesh = new THREE.Mesh(boardGeom, boardMat);
    boardMesh.position.set((BOARD_SIZE - 1) / 2, -boardThickness / 2, (BOARD_SIZE - 1) / 2);
    boardMesh.receiveShadow = true; scene.add(boardMesh);
    drawBoardGridLines(); 
}

function drawBoardGridLines() {
    // ... (drawBoardGridLines from previous version with corrected span) ...
    const lineThickness = 0.05; 
    const gridLineMaterial = new THREE.MeshStandardMaterial({ color: 0x00241B, roughness: 0.6, metalness: 0.7 }); 
    const lineY = 0.001; 
    const gridLinesGroup = new THREE.Group();
    gridLinesGroup.position.y = lineY; 
    const gridSpan = BOARD_SIZE - 1;
    for (let i = 0; i < BOARD_SIZE; i++) {
        const hGeom = new THREE.BoxGeometry(gridSpan, lineThickness, lineThickness);
        const hLine = new THREE.Mesh(hGeom, gridLineMaterial);
        hLine.position.set(gridSpan / 2, 0, i); 
        gridLinesGroup.add(hLine);
        const vGeom = new THREE.BoxGeometry(lineThickness, lineThickness, gridSpan);
        const vLine = new THREE.Mesh(vGeom, gridLineMaterial);
        vLine.position.set(i, 0, gridSpan / 2);
        gridLinesGroup.add(vLine);
    }
    scene.add(gridLinesGroup);
}


function addStoneTo3DScene(x, z, player) { 
    const key = `${x}-${z}`; if (stoneModels[key]) return;
    const playerSettings = player === 1 ? player1Settings : player2Settings;
    const pieceDefinition = PIECE_DEFINITIONS[playerSettings.piece] || PIECE_DEFINITIONS[DEFAULT_PIECE_KEY];
    const modelPath = pieceDefinition.path;
    const pieceSpecificScaleMultiplier = pieceDefinition.scaleMultiplier || 1.0; 
    const targetVisualPieceHeight = 0.7;
    const pieceYOnBoard = 0.15;

    const loader = new GLTFLoader(); 
    loader.load(modelPath, gltf => {
        const model = gltf.scene; 

        // --- SCALE TO TARGET HEIGHT ---
        const initialBox = new THREE.Box3().setFromObject(model);
        const initialSize = initialBox.getSize(new THREE.Vector3()); 
        let finalScale = 0.5 * pieceSpecificScaleMultiplier;
        if (initialSize.y !== 0) {
            const scaleToTargetHeight = targetVisualPieceHeight / initialSize.y;
            finalScale = scaleToTargetHeight * pieceSpecificScaleMultiplier;
        }
        model.scale.set(finalScale, finalScale, finalScale);

        // --- ALIGN BASE TO Y=0 AND CENTER X/Z ---
        // Recompute bounding box after scaling
        const scaledBox = new THREE.Box3().setFromObject(model);
        const size = scaledBox.getSize(new THREE.Vector3());
        const center = scaledBox.getCenter(new THREE.Vector3());

        // Move model so its base is at y=0 and it's centered in X/Z
        model.position.x += (x - center.x);
        model.position.z += (z - center.z);
        model.position.y += (0 - scaledBox.min.y) + pieceYOnBoard;

        // Drop animation
        const animationStartY = model.position.y + 1.5; 
        const targetY = model.position.y;
        model.position.y = animationStartY;

        model.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true;
            child.material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(playerSettings.color), 
                roughness: 0.2, metalness: 0.25 }); 
        }});
        scene.add(model); stoneModels[key] = model;

        let currentY = animationStartY; 
        const dropSpeed = 0.10; 
        function animateDrop() { 
            if (currentY > targetY) { 
                currentY -= dropSpeed * Math.max(0.3, (currentY - targetY));
                model.position.y = Math.max(currentY, targetY); 
                requestAnimationFrame(animateDrop); 
            } else model.position.y = targetY; 
        }
        animateDrop();
    }, undefined, error => {
        // ...fallback unchanged...
    });
}

function removeStoneFrom3DScene(x, z) { /* ... unchanged ... */
    const key = `${x}-${z}`; const model = stoneModels[key];
    if (model) {
        const duration = 300; const startTime = Date.now();
        const originalScaleX = model.scale.x; const originalScaleY = model.scale.y; const originalScaleZ = model.scale.z; 
        const startY = model.position.y;
        function animateCapture() {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / duration, 1); 
            model.position.y = startY + progress * 0.5; 
            model.scale.set(originalScaleX * (1 - progress), originalScaleY * (1 - progress), originalScaleZ * (1 - progress));
            model.traverse(child => { if (child.isMesh && child.material && child.material.isMeshStandardMaterial) { 
                if (!child.material.userData) child.material.userData = {}; 
                if (child.material.userData.originalOpacity === undefined) child.material.userData.originalOpacity = child.material.opacity !== undefined ? child.material.opacity : 1;
                child.material.transparent = true;
                child.material.opacity = child.material.userData.originalOpacity * (1 - progress);}});
            if (progress < 1) requestAnimationFrame(animateCapture);
            else { scene.remove(model); delete stoneModels[key]; }}
        animateCapture();
    }
}
function onBoardClick(event) {
    if (gameOver || (gameMode === 'multiplayer' && currentPlayer !== localPlayerNum)) return;
    if (!boardMesh) return; 
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(boardMesh);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        // Correct the offset so clicks match grid spaces
        const col = Math.round(point.x - boardMesh.position.x + (BOARD_SIZE - 1) / 2);
        const row = Math.round(point.z - boardMesh.position.z + (BOARD_SIZE - 1) / 2);
        if (col >= 0 && col < BOARD_SIZE && row >= 0 && row < BOARD_SIZE) handlePlayerMove(row, col); 
    }
}
function animate() { /* ... unchanged ... */ if (!renderer) return; requestAnimationFrame(animate); if (controls) controls.update(); renderer.render(scene, camera); }
function onWindowResize() { /* ... unchanged ... */ if (camera && renderer && gameContainer) { camera.aspect = gameContainer.clientWidth / gameContainer.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);}}

// =================================================================
// Go Game Logic (Unchanged)
// =================================================================
// ... (All Go game logic functions: getNeighbors, initializeBoardArray, makeActualMove, simulatePlaceStone, findGroup remain unchanged) ...
function getNeighbors(row, col) { const neighbors = []; if (row > 0) neighbors.push({ row: row - 1, col: col }); if (row < BOARD_SIZE - 1) neighbors.push({ row: row + 1, col: col }); if (col > 0) neighbors.push({ row: row, col: col - 1 }); if (col < BOARD_SIZE - 1) neighbors.push({ row: row, col: col + 1 }); return neighbors;}
function initializeBoardArray() { board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)); }
function makeActualMove(row, col, player) { const simulationResult = simulatePlaceStone(row, col, player, board); if (simulationResult === null) return null; board = simulationResult.newBoard; if (simulationResult.captures.length > 0) { let boardStateBeforeThisMove = board.map(r => r.slice()); boardStateBeforeThisMove[row][col] = 0; simulationResult.captures.forEach(s => boardStateBeforeThisMove[s.row][s.col] = player === 1 ? 2 : 1); koState = boardStateBeforeThisMove.map(r=>r.join('')).join(''); } else koState = null; return simulationResult.captures; }
function simulatePlaceStone(row, col, player, boardToSimulateOn) { if (boardToSimulateOn[row][col] !== 0) return null; let tempBoard = boardToSimulateOn.map(r => r.slice()); tempBoard[row][col] = player; const opponent = player === 1 ? 2 : 1; let capturedStonesThisMove = []; const neighbors = getNeighbors(row, col); for (const n of neighbors) { if (tempBoard[n.row][n.col] === opponent) { const group = findGroup(n.row, n.col, tempBoard); if (group.liberties === 0) capturedStonesThisMove.push(...group.stones); } } capturedStonesThisMove.forEach(stone => tempBoard[stone.row][stone.col] = 0); const ownGroup = findGroup(row, col, tempBoard); if (ownGroup.liberties === 0) return null; const boardString = tempBoard.map(r => r.join('')).join(''); if (koState !== null && boardString === koState) return null; return { newBoard: tempBoard, captures: capturedStonesThisMove }; }
function findGroup(startRow, startCol, boardState) { const player = boardState[startRow][startCol]; if (player === 0) return { stones: [], liberties: 0 }; const queue = [{ row: startRow, col: startCol }]; const visited = new Set([`${startRow},${startCol}`]); const groupStones = []; const libertyPoints = new Set(); while (queue.length > 0) { const { row, col } = queue.shift(); groupStones.push({ row, col }); const neighbors = getNeighbors(row, col); for (const n of neighbors) { const key = `${n.row},${n.col}`; if (visited.has(key)) continue; const neighborState = boardState[n.row][n.col]; if (neighborState === 0) libertyPoints.add(key); else if (neighborState === player) { visited.add(key); queue.push({ row: n.row, col: n.col }); } } } return { stones: groupStones, liberties: libertyPoints.size }; }

// =================================================================
// AI Logic (Unchanged)
// =================================================================
// ... (getAIMove unchanged) ...
function getAIMove() { let bestScore = -Infinity; let bestMoves = []; const availableMoves = []; for (let r = 0; r < BOARD_SIZE; r++) { for (let c = 0; c < BOARD_SIZE; c++) { if (board[r][c] === 0) availableMoves.push({ r, c }); } } if(availableMoves.length === 0) return {pass: true}; for (const move of availableMoves) { let score = 0; const simulationResult = simulatePlaceStone(move.r, move.c, 2, board.map(r => r.slice())); if (simulationResult === null) continue; const { newBoard: simBoard, captures: simCaptures } = simulationResult; score += simCaptures.length * 100; const neighbors = getNeighbors(move.r, move.c); for (const n of neighbors) { if (simBoard[n.row][n.col] === 1) { const group = findGroup(n.row, n.col, simBoard); if (group.liberties === 1) score += 25; else if (group.liberties === 2 && simCaptures.length === 0) score += 10; } } const aiOwnGroupAfterMove = findGroup(move.r, move.c, simBoard); if (aiOwnGroupAfterMove.liberties > 1) { for(const n of neighbors) { if(board[n.row][n.col] === 2) { const originalGroup = findGroup(n.row, n.col, board); if(originalGroup.liberties === 1) { const newFormedGroup = findGroup(n.row, n.col, simBoard); if(newFormedGroup.liberties > 1) score += 50; }}}} for (const n of neighbors) { if (simBoard[n.row][n.col] === 2) score += 1; } if (currentDifficulty !== 'easy') { const edgeDist = Math.min(move.r, move.c, BOARD_SIZE - 1 - move.r, BOARD_SIZE - 1 - move.c); if (edgeDist === 0) score += 3;  if (edgeDist <= 2) score += 1;  } if (score > bestScore) { bestScore = score; bestMoves = [move]; } else if (score === bestScore) bestMoves.push(move); } if (bestMoves.length > 0) return bestMoves[Math.floor(Math.random() * bestMoves.length)]; else return availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : {pass: true};}

// =================================================================
// Game Flow & UI (Unchanged)
// =================================================================
// ... (Game Flow & UI functions unchanged) ...
function resetGame() { if (unsubscribeGameListener) unsubscribeGameListener(); gameOver = true; activeGameId = null; localPlayerNum = 0; currentPlayer = 1; consecutivePasses = 0; captures = { 1: 0, 2: 0 }; koState = null; initializeBoardArray(); if (scene) Object.values(stoneModels).forEach(model => scene.remove(model)); stoneModels = {}; updateScoreUI(); if(turnText) turnText.textContent = ""; if (passTurnButton) passTurnButton.classList.add('hidden'); else console.error("Pass turn button not found in resetGame"); }
function startNewAIGame() { resetGame(); gameMode = 'ai'; if(difficultySelect) currentDifficulty = difficultySelect.value; else currentDifficulty = 'easy'; gameOver = false; if(playerColorInput) player1Settings.color = playerColorInput.value; if(playerPieceSelect) player1Settings.piece = playerPieceSelect.value; player2Settings.color = player1Settings.color === '#FFFFFF' ? '#222222' : '#FFFFFF'; player2Settings.piece = DEFAULT_PIECE_KEY; initThreeJS(); updateStatusText(`Playing vs. AI (${currentDifficulty}).`); updateTurnText(); if (passTurnButton) passTurnButton.classList.remove('hidden'); if(gameSetupModal) closeModal(gameSetupModal); }
function handlePlayerMove(row, col) { const capturedStones = makeActualMove(row, col, currentPlayer); if (capturedStones !== null) { consecutivePasses = 0; addStoneTo3DScene(col, row, currentPlayer); if (capturedStones.length > 0) { captures[currentPlayer] += capturedStones.length; capturedStones.forEach(stone => removeStoneFrom3DScene(stone.col, stone.row)); updateScoreUI(); } currentPlayer = (currentPlayer === 1) ? 2 : 1; if (gameMode === 'multiplayer') updateGameInFirebase({ board, captures, currentPlayer, consecutivePasses, koState }); else { updateTurnText(); if (currentPlayer === 2) setTimeout(aiTurn, 500); } } else console.log("Illegal move attempted at " + row + "," + col); }
function handlePassTurn() { if (gameOver || (gameMode === 'multiplayer' && currentPlayer !== localPlayerNum)) return; consecutivePasses++; if (consecutivePasses >= 2) { endGame(); if (gameMode === 'multiplayer') updateGameInFirebase({ gameOver: true, winner: determineWinner(), consecutivePasses }); } else { currentPlayer = (currentPlayer === 1) ? 2 : 1; if (gameMode === 'multiplayer') updateGameInFirebase({ currentPlayer, consecutivePasses }); else { updateTurnText(); if (currentPlayer === 2) setTimeout(aiTurn, 500); } } }
function aiTurn() { if (gameOver) return; const move = getAIMove(); if(move.pass) handlePassTurn(); else handlePlayerMove(move.r, move.c); }
function endGame() { gameOver = true; const winner = determineWinner(); if (winner === 0) updateStatusText("Game Over - It's a draw!"); else { const winnerName = (winner === localPlayerNum || (gameMode === 'ai' && winner === 1)) ? "You" : "Opponent"; updateStatusText(`Game Over - ${winnerName} won!`); } if(turnText) turnText.textContent = "Thank you for playing."; if(passTurnButton) passTurnButton.classList.add('hidden'); }
function determineWinner() { if (captures[1] > captures[2]) return 1; if (captures[2] > captures[1]) return 2; return 0; }
function updateScoreUI() { if(player1CapturesText) player1CapturesText.textContent = captures[1]; if(player2CapturesText) player2CapturesText.textContent = captures[2];}
function updateStatusText(message) { if(statusText) statusText.textContent = message; }
function updateTurnText() { if (gameOver) return; if (!turnText) return; if (gameMode === 'ai') turnText.textContent = currentPlayer === 1 ? "Your turn (Black)." : "AI's turn (White)..."; else if (gameMode === 'multiplayer' && activeGameId) turnText.textContent = currentPlayer === localPlayerNum ? "Your turn." : "Opponent's turn.";}

// =================================================================
// Multiplayer (Firebase)
// =================================================================
// ... (Multiplayer functions with Firebase nested array fix) ...
async function createMultiplayerGame() {
    if (!auth || !auth.currentUser) {console.error("Auth not ready for createMultiplayerGame"); return; }
    resetGame(); gameMode = 'multiplayer'; localPlayerNum = 1; gameOver = false;
    player1Settings.uid = auth.currentUser.uid;
    player1Settings.color = playerColorInput.value;
    player1Settings.piece = playerPieceSelect.value; 
    const newGameData = {
        player1: player1Settings, player2: null,
        boardString: JSON.stringify(board), 
        captures, currentPlayer: 1, status: 'waiting', 
        consecutivePasses: 0, koState: koState, 
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        const gameRef = await db.collection('games').add(newGameData); activeGameId = gameRef.id;
        initThreeJS(); updateStatusText("Waiting for opponent..."); closeModal(gameSetupModal);
        const shareCodeDisplay = document.getElementById('share-game-code-display');
        const shareLinkDisplay = document.getElementById('share-game-link-display');
        if(shareCodeDisplay) shareCodeDisplay.value = activeGameId;
        if(shareLinkDisplay) shareLinkDisplay.value = `${window.location.origin}${window.location.pathname}?game=${activeGameId}`;
        openModal(shareGameModal); listenToGameUpdates(activeGameId);
    } catch (error) { 
        console.error("Error creating game:", error); 
        console.error("Data that caused error in createMultiplayerGame:", newGameData);
    }
}
async function joinMultiplayerGame(gameId) { /* ... unchanged ... */ 
    if (!auth || !auth.currentUser) { console.error("Auth not ready for joinMultiplayerGame"); return;}
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
function listenToGameUpdates(gameId) { /* ... with boardString parsing ... */
    if (unsubscribeGameListener) unsubscribeGameListener();
    unsubscribeGameListener = db.collection('games').doc(gameId)
        .onSnapshot(doc => {
            if (!doc.exists) { updateStatusText("Game deleted."); resetGame(); return; }
            const gameData = doc.data();
            if (!renderer && !gameOver) initThreeJS();
            
            if (gameData.boardString) {
                try { board = JSON.parse(gameData.boardString); } 
                catch (e) { console.error("Error parsing boardString from Firebase:", e, gameData.boardString); initializeBoardArray(); }
            } else { console.warn("boardString missing, initializing empty board."); initializeBoardArray(); }

            koState = gameData.koState !== undefined ? gameData.koState : null; 
            
            captures = gameData.captures; 
            currentPlayer = gameData.currentPlayer;
            consecutivePasses = gameData.consecutivePasses; 
            player1Settings = gameData.player1; if(gameData.player2) player2Settings = gameData.player2;
            
            sync3DAndUI(); 
            
            if (gameData.gameOver) {
                gameOver = true; endGame();
                if (unsubscribeGameListener) unsubscribeGameListener();
            } else {
                gameOver = false; 
                if(passTurnButton) passTurnButton.classList.remove('hidden'); 
                updateTurnText();
            }
        }, error => { console.error("Firebase listener error:", error); updateStatusText("Connection error."); });
}
function sync3DAndUI() { /* ... uses global board ... */
     Object.values(stoneModels).forEach(model => scene.remove(model)); stoneModels = {};
     for(let r=0; r<BOARD_SIZE; r++) {
         for(let c=0; c<BOARD_SIZE; c++) {
             if(board[r][c] !== 0) addStoneTo3DScene(c, r, board[r][c]);
         }
     }
     updateScoreUI();
}
async function updateGameInFirebase(dataToUpdate) { /* ... with boardString stringification ... */
    if (!activeGameId || !auth || !auth.currentUser) return;
    const dataToSend = { ...dataToUpdate }; 
    if (dataToSend.hasOwnProperty('board')) {
        dataToSend.boardString = JSON.stringify(dataToSend.board);
        delete dataToSend.board; 
    }
    try { 
        await db.collection('games').doc(activeGameId).update(dataToSend); 
    } catch (error) { 
        console.error("Firebase update error:", error);
        console.error("Data that caused update error:", dataToSend);
    }
}

// --- Utility Functions ---
function openModal(modal) { if (modal) modal.classList.remove('hidden'); else console.warn("Attempted to open null modal"); }
function closeModal(modal) { if (modal) modal.classList.add('hidden'); else console.warn("Attempted to close null modal");}
function copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => alert("Copied!")); }

console.log("main.js: SCRIPT EXECUTION FINISHED (END OF FILE).");
