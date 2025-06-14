// =================================================================
// Mythos Go - main.js (Individual Piece Scaling)
// =================================================================

// --- ES6 Module Imports ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'; 
import { collection, addDoc, doc, updateDoc, onSnapshot, getDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { db } from './firebase.js';

console.log("main.js: SCRIPT EXECUTION STARTED (TOP OF FILE).");

// --- Constants ---
const BOARD_SIZE = 13;

// **NEW: PIECE DEFINITIONS with individual scale multipliers**
// You will need to adjust the `scaleMultiplier` for each piece
// to get the visual balance you want. 1.0 is the baseline.
const PIECE_DEFINITIONS = {
    'Achilles':     { path: 'assets/achilles.glb',      scaleMultiplier: 2.0 },
    'War Elephant': { path: 'assets/war_elephant.glb',  scaleMultiplier: 1.6 }, // You'll likely want to adjust this
    'Valkyrie':     { path: 'assets/valkyrie.glb',  scaleMultiplier: 1.3 },
    'Aztec':        { path: 'assets/aztec.glb',         scaleMultiplier: 1.4 }
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
let player2SetupModal, player2ColorInput, player2PieceSelect, confirmJoinGameButton;
let resignGameButton, manageGamesButton;


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

let prevBoard = []; // <-- Moved up for global access

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
        // Offer to resume AI game if present
        if (loadAIGameFromLocal()) {
            // Optionally, you can prompt the user instead:
            // if (confirm("Resume your previous AI game?")) loadAIGameFromLocal();
            // else clearAIGameFromLocal();
        }
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
    player2SetupModal = document.getElementById('player2-setup-modal');
    player2ColorInput = document.getElementById('player2-color-input');
    player2PieceSelect = document.getElementById('player2-piece-select');
    confirmJoinGameButton = document.getElementById('confirm-join-game-button');
    resignGameButton = document.getElementById('resign-game-button');
    manageGamesButton = document.getElementById('manage-games-button');
    if (!newGameButton) console.error("main.js: newGameButton NOT FOUND in assignDOMElements!");
    if (!gameContainer) console.error("main.js: gameContainer NOT FOUND in assignDOMElements!");
    if (!startAiGameButton) console.error("main.js: startAiGameButton NOT FOUND in assignDOMElements!");
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
    if (startAiGameButton) {
        startAiGameButton.addEventListener('click', () => {
            console.log("Start AI Game button CLICKED");
            startNewAIGame();
        });
    } else {
        console.error("Start AI Game button not found for listener.");
    }
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
    if (resignGameButton) resignGameButton.addEventListener('click', deleteCurrentGame);
    if (manageGamesButton) manageGamesButton.addEventListener('click', showGamePicker);
    console.log("main.js: initEventListeners() FINISHED.");
}
function waitForAuthAndSetupUI() {
    console.log("main.js: waitForAuthAndSetupUI() CALLED.");
    if (typeof auth !== 'undefined' && auth) {
        if (createMultGameButton) createMultGameButton.disabled = true;
        auth.onAuthStateChanged(user => {
            if (user) {
                player1Settings.uid = user.uid;
                if (createMultGameButton) createMultGameButton.disabled = false;
                tryAutoRejoinGame(); // <-- Add this line
                checkUrlForGameToJoin();
                console.log("main.js: User authenticated, UID:", user.uid);
            } else {
                if (createMultGameButton) createMultGameButton.disabled = true;
                console.log("main.js: User is signed out or anonymous sign-in pending in onAuthStateChanged.");
            }
        });
    } else {
        console.error("main.js: Firebase Auth object (auth) not available globally. Check firebase.js loading order and initialization.");
        if(statusText) statusText.textContent = "Error: Auth services unavailable.";
    }
}
async function checkUrlForGameToJoin() {
    if (!auth || !auth.currentUser) {
        console.warn("checkUrlForGameToJoin: auth.currentUser not ready, skipping.");
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    console.log("Attempting to join game with ID:", gameIdFromUrl);
    if (gameIdFromUrl && joinGameModal && joinGameCodeInput) {
        // Check if the current user is already player1 for this game
        const gameDocRef = doc(db, 'games', gameIdFromUrl);
        try {
            const docSnap = await getDoc(gameDocRef);
            if (docSnap.exists()) {
                const gameData = docSnap.data();
                if (auth.currentUser && gameData.player1 && gameData.player1.uid === auth.currentUser.uid) {
                    // Remove ?game=... from the URL for the creator
                    if (window.history.replaceState) {
                        const url = window.location.origin + window.location.pathname;
                        window.history.replaceState({}, document.title, url);
                    }
                    return;
                }
            }
        } catch (e) {
            console.warn("Error checking game ownership in checkUrlForGameToJoin:", e);
        }
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
    scene = new THREE.Scene(); scene.background = new THREE.Color(0xf7efe6); // Warmer, candle-lit background

    camera = new THREE.PerspectiveCamera(45, gameContainer.clientWidth / gameContainer.clientHeight, 0.1, 1000);
    camera.position.set(BOARD_SIZE / 2, BOARD_SIZE * 1.6, BOARD_SIZE * 1.4);

    // Rotate camera for player 2 in multiplayer
    if (gameMode === 'multiplayer' && localPlayerNum === 2) {
        camera.position.set(BOARD_SIZE / 2, BOARD_SIZE * 1.6, -BOARD_SIZE * 1.4);
        controls.target.set(BOARD_SIZE / 2, 0, BOARD_SIZE / 2);
        controls.update();
    }
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(gameContainer.clientWidth, gameContainer.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1; // Slightly brighter to let marble color show
    renderer.outputEncoding = THREE.sRGBEncoding;
    gameContainer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(BOARD_SIZE / 2, 0, BOARD_SIZE / 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = BOARD_SIZE * 0.7;
    controls.maxDistance = BOARD_SIZE * 2.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    // --- Candlelight Setup ---
    const candleColor = 0xffe4b2; // warm candle color
    const candleIntensity = 2.2;
    const candleLight = new THREE.PointLight(candleColor, candleIntensity, 30, 2.2);
    candleLight.position.set(BOARD_SIZE / 2, 7, BOARD_SIZE / 2);
    candleLight.castShadow = true;
    candleLight.shadow.mapSize.width = 2048;
    candleLight.shadow.mapSize.height = 2048;
    candleLight.shadow.bias = -0.001;
    scene.add(candleLight);

    // Soft ambient fill to avoid harsh shadows, but keep it subtle
    const ambient = new THREE.AmbientLight(0xffe4b2, 0.22);
    scene.add(ambient);

    // Remove or reduce hemisphere and directional lights to let marble color show
    // (If you want a faint hemisphere for subtle fill, keep it very low)
    // const hemiLight = new THREE.HemisphereLight(0xffe4b2, 0x402808, 0.08);
    // scene.add(hemiLight);

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
    const gridLineMaterial = new THREE.MeshStandardMaterial({ color: 0x00241B, roughness: 0.1, metalness: 0.9 }); 
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


const modelCache = {};

function addStoneTo3DScene(x, z, player) {
    const key = `${x}-${z}`; if (stoneModels[key]) return;
    const playerSettings = player === 1 ? player1Settings : player2Settings;
    const pieceDefinition = PIECE_DEFINITIONS[playerSettings.piece] || PIECE_DEFINITIONS[DEFAULT_PIECE_KEY];
    const modelPath = pieceDefinition.path;
    const pieceSpecificScaleMultiplier = pieceDefinition.scaleMultiplier || 1.0; 
    const targetVisualPieceHeight = 0.7;
    const pieceYOnBoard = 0.15;

    function placeModel(gltf) {
        const model = gltf.scene.clone(true);

        // --- SCALE TO TARGET HEIGHT ---
        const initialBox = new THREE.Box3().setFromObject(model);
        const initialSize = initialBox.getSize(new THREE.Vector3()); 
        let finalScale = 0.5 * pieceSpecificScaleMultiplier;
        if (initialSize.y !== 0) {
            const scaleToTargetHeight = targetVisualPieceHeight / initialSize.y;
            finalScale = scaleToTargetHeight * pieceSpecificScaleMultiplier;
        }
        model.scale.set(finalScale, finalScale, finalScale);

        // --- ORIENT PIECE TO FACE OPPONENT ---
        // If this piece IS the local player's, rotate it 180° around Y
        if (gameMode === 'multiplayer' && player === localPlayerNum) {
            model.rotation.y = Math.PI;
        }

        // --- ALIGN BASE TO Y=0 AND CENTER X/Z ---
        const scaledBox = new THREE.Box3().setFromObject(model);
        const size = scaledBox.getSize(new THREE.Vector3());
        const center = scaledBox.getCenter(new THREE.Vector3());
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
    }

    if (modelCache[modelPath]) {
        placeModel(modelCache[modelPath]);
    } else {
        const loader = new GLTFLoader();
        loader.load(modelPath, gltf => {
            modelCache[modelPath] = gltf;
            placeModel(gltf);
        }, undefined, error => {
            // ...fallback unchanged...
        });
    }
}

function removeStoneFrom3DScene(x, z) {
    const key = `${x}-${z}`;
    const model = stoneModels[key];
    if (model) {
        const duration = 300; const startTime = Date.now();
        const originalScaleX = model.scale.x; const originalScaleY = model.scale.y; const originalScaleZ = model.scale.z; 
        const startY = model.position.y;
        function animateCapture() {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / duration, 1); 
            model.position.y = startY + progress * 0.5; 
            model.scale.set(originalScaleX * (1 - progress), originalScaleY * (1 - progress), originalScaleZ * (1 - progress));
            model.traverse(child => { 
                if (child.isMesh && child.material && child.material.isMeshStandardMaterial) { 
                    if (!child.material.userData) child.material.userData = {}; 
                    if (child.material.userData.originalOpacity === undefined) child.material.userData.originalOpacity = child.material.opacity !== undefined ? child.material.opacity : 1;
                    child.material.transparent = true;
                    child.material.opacity = child.material.userData.originalOpacity * (1 - progress);
                }
            });
            if (progress < 1) requestAnimationFrame(animateCapture);
            else {
                model.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                    }
                });
                scene.remove(model); 
                delete stoneModels[key];
            }
        }
        animateCapture();
    }
}
function onBoardClick(event) {
    // Prevent input if game is over
    if (gameOver) return;

    // Prevent input if it's not the local player's turn in multiplayer
    if (gameMode === 'multiplayer' && currentPlayer !== localPlayerNum) return;

    // Prevent input if it's not the human's turn in AI mode
    if (gameMode === 'ai' && currentPlayer !== 1) return;

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

// --- AI Turn Handler ---
function aiTurn() {
    // Only proceed if it's AI's turn and the game is not over
    if (gameOver || gameMode !== 'ai' || currentPlayer !== 2) return;
    const move = getAIMove();
    if (move && !move.pass) {
        handlePlayerMove(move.r, move.c);
    } else {
        // AI passes if no moves are available
        handlePassTurn();
    }
}

// =================================================================
// Game Flow & UI (Unchanged)
// =================================================================
// ... (Game Flow & UI functions unchanged) ...
function resetGame() {
    if (unsubscribeGameListener) unsubscribeGameListener();
    gameOver = true; activeGameId = null; localPlayerNum = 0; currentPlayer = 1; consecutivePasses = 0; captures = { 1: 0, 2: 0 }; koState = null;
    initializeBoardArray();
    if (scene) Object.values(stoneModels).forEach(model => scene.remove(model));
    stoneModels = {};
    updateScoreUI();
    if(turnText) turnText.textContent = "";
    if (passTurnButton) passTurnButton.classList.add('hidden'); else console.error("Pass turn button not found in resetGame");
    if (resignGameButton) resignGameButton.classList.add('hidden');
    removeActiveGameId();
    clearAIGameFromLocal(); // <-- Add this line
}
function startNewAIGame() {
    console.log("startNewAIGame CALLED");
    resetGame();
    gameMode = 'ai';
    if(difficultySelect) currentDifficulty = difficultySelect.value;
    else currentDifficulty = 'easy';
    gameOver = false;
    if(playerColorInput) player1Settings.color = playerColorInput.value;
    if(playerPieceSelect) player1Settings.piece = playerPieceSelect.value;
    player2Settings.color = player1Settings.color === '#FFFFFF' ? '#222222' : '#FFFFFF';
    player2Settings.piece = DEFAULT_PIECE_KEY;
    initThreeJS();
    updateStatusText(`Playing vs. AI (${currentDifficulty}).`);
    updateTurnText();
    if (passTurnButton) passTurnButton.classList.remove('hidden');
    if(gameSetupModal) closeModal(gameSetupModal);
}
function handlePlayerMove(row, col) {
    const capturedStones = makeActualMove(row, col, currentPlayer);
    if (capturedStones !== null) {
        consecutivePasses = 0;
        addStoneTo3DScene(col, row, currentPlayer);
        if (capturedStones.length > 0) {
            captures[currentPlayer] += capturedStones.length;
            capturedStones.forEach(stone => removeStoneFrom3DScene(stone.col, stone.row));
            updateScoreUI();
        }
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        updateTurnText();
        if (gameMode === 'multiplayer') {
            updateGameInFirebase({ board, captures, currentPlayer, consecutivePasses, koState });
        } else {
            saveAIGameToLocal(); // <-- Add this line
            if (currentPlayer === 2) setTimeout(aiTurn, 500);
        }
    } else {
        console.log("Illegal move attempted at " + row + "," + col);
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
        if (gameMode === 'ai') {
            saveAIGameToLocal();
        }
    } else {
        currentPlayer = (currentPlayer === 1) ? 2 : 1;
        updateTurnText();
        if (gameMode === 'multiplayer') {
            updateGameInFirebase({ currentPlayer, consecutivePasses });
        } else {
            saveAIGameToLocal(); // <-- Add this line
            if (currentPlayer === 2 && !gameOver) setTimeout(aiTurn, 500);
        }
    }
}

function listenToGameUpdates(gameId) {
    if (unsubscribeGameListener) unsubscribeGameListener();
    const gameDocRef = doc(db, 'games', gameId);
    unsubscribeGameListener = onSnapshot(gameDocRef, docSnap => {
        if (!docSnap.exists()) {
            updateStatusText("Game deleted.");
            resetGame();
            removeActiveGameId();
            return; // <-- Add this return to prevent further code from running!
        }
        const gameData = docSnap.data();
        // Optionally, check if user is still a participant:
        const uid = auth.currentUser ? auth.currentUser.uid : null;
        if (uid) {
            if (gameData.player1 && gameData.player1.uid === uid) localPlayerNum = 1;
            else if (gameData.player2 && gameData.player2.uid === uid) localPlayerNum = 2;
        }
        if (uid && gameData.player1.uid !== uid && (!gameData.player2 || gameData.player2.uid !== uid)) {
            updateStatusText("You are no longer a participant in this game.");
            resetGame();
            removeActiveGameId();
            return;
        }
        // --- Ensure 3D scene is initialized before syncing UI ---
        if (!scene || !renderer) {
            initThreeJS();
        }

        // --- CRITICAL: Always set gameMode to 'multiplayer' when listening to a multiplayer game ---
        gameMode = 'multiplayer';

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

        // --- Update status text based on game state ---
        if (gameData.status === 'waiting') {
            updateStatusText("Waiting for opponent...");
        } else if (gameData.status === 'active') {
            if (localPlayerNum === 1) {
                updateStatusText("Opponent joined! Your game is ready.");
            } else if (localPlayerNum === 2) {
                updateStatusText("Joined game! Your game is ready.");
            } else {
                updateStatusText("Game in progress.");
            }
        } else if (gameData.gameOver) {
            gameOver = true; endGame();
            if (unsubscribeGameListener) unsubscribeGameListener();
        } else {
            gameOver = false; 
            if(passTurnButton) passTurnButton.classList.remove('hidden'); 
        }

        updateTurnText(); // <-- Always update turn text after syncing state

        if (gameData.status === 'waiting' || gameData.status === 'active') {
            if (resignGameButton) resignGameButton.classList.remove('hidden');
        } else {
            if (resignGameButton) resignGameButton.classList.add('hidden');
        }
    }, error => { console.error("Firebase listener error:", error); updateStatusText("Connection error."); });
}

function sync3DAndUI() {
    // Remove all stones from the scene
    if (scene && stoneModels) {
        Object.values(stoneModels).forEach(model => scene.remove(model));
        stoneModels = {};
    }
    // Redraw stones from the board array
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === 1 || board[r][c] === 2) {
                addStoneTo3DScene(c, r, board[r][c]);
            }
        }
    }
    updateScoreUI();
    updateTurnText();
}

function updateTurnText() {
    if (gameOver) return;
    if (!turnText) return;
    if (gameMode === 'ai')
        turnText.textContent = currentPlayer === 1 ? "Your turn (Black)." : "AI's turn (White)...";
    else if (gameMode === 'multiplayer' && activeGameId)
        turnText.textContent = currentPlayer === localPlayerNum ? "Your turn." : "Opponent's turn.";
    else
        turnText.textContent = "";
}

function updateStatusText(text) {
    if (statusText) statusText.textContent = text;
    else console.warn("updateStatusText: statusText element not found.");
}

function updateScoreUI() {
    if (player1CapturesText) player1CapturesText.textContent = captures[1] || "0";
    if (player2CapturesText) player2CapturesText.textContent = captures[2] || "0";
}

// --- Utility Functions ---
function openModal(modal) { if (modal) modal.classList.remove('hidden'); else console.warn("Attempted to open null modal"); }
function closeModal(modal) { if (modal) modal.classList.add('hidden'); else console.warn("Attempted to close null modal");}
function copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => alert("Copied!")); }

function tryAutoRejoinGame() {
    const gameId = getCurrentGameId();
    if (gameId) {
        joinMultiplayerGame(gameId);
    }
}
function getActiveGameIds() {
    try {
        return JSON.parse(localStorage.getItem('activeGameIds')) || [];
    } catch {
        return [];
    }
}
function setActiveGameIds(ids) {
    localStorage.setItem('activeGameIds', JSON.stringify(ids));
}
function addActiveGameId(gameId) {
    const ids = getActiveGameIds();
    if (!ids.includes(gameId)) {
        ids.push(gameId);
        setActiveGameIds(ids);
    }
    setCurrentGameId(gameId);
}
function removeActiveGameId(gameId) {
    let ids = getActiveGameIds();
    ids = ids.filter(id => id !== gameId);
    setActiveGameIds(ids);
    // If the removed game was current, pick another or clear
    const current = getCurrentGameId();
    if (current === gameId) {
        setCurrentGameId(ids[0] || null);
    }
}
function setCurrentGameId(gameId) {
    if (gameId)
        localStorage.setItem('currentGameId', gameId);
    else
        localStorage.removeItem('currentGameId');
}
function getCurrentGameId() {
    return localStorage.getItem('currentGameId');
}
function showGamePicker() {
    const ids = getActiveGameIds();
    if (ids.length === 0) {
        alert("No active games.");
        return;
    }
    const pick = prompt("Enter the number of the game to rejoin:\n" + ids.map((id, i) => `${i+1}: ${id}`).join('\n'));
    const idx = parseInt(pick, 10) - 1;
    if (ids[idx]) {
        setCurrentGameId(ids[idx]);
        joinMultiplayerGame(ids[idx]);
    }
}

async function deleteCurrentGame() {
    if (!activeGameId) return;
    if (!confirm("Are you sure you want to resign and delete this game? This cannot be undone.")) return;
    try {
        const gameDocRef = doc(db, 'games', activeGameId);
        await deleteDoc(gameDocRef);
        removeActiveGameId(activeGameId);
        resetGame();
        updateStatusText("Game ended and deleted.");
        if (resignGameButton) resignGameButton.classList.add('hidden');
    } catch (error) {
        alert("Failed to delete game: " + error.message);
        console.error("Error deleting game:", error);
    }
}

async function joinMultiplayerGame(gameId) {
    if (!auth || !auth.currentUser) {
        alert("You must be signed in to join a game.");
        return;
    }
    resetGame();
    const gameDocRef = doc(db, 'games', gameId);
    try {
        const docSnap = await getDoc(gameDocRef);
        if (!docSnap.exists()) {
            alert("Game not found.");
            return;
        }
        const gameData = docSnap.data();
        if (!gameData || !gameData.player1) {
            updateStatusText("Game data incomplete or corrupted.");
            resetGame();
            removeActiveGameId();
            return;
        }
        if (gameData.player2 && gameData.player2.uid !== auth.currentUser.uid) {
            alert("Game is full.");
            return;
        }
        if (gameData.player1.uid === auth.currentUser.uid) {
            // Allow player1 to rejoin/manage their own game!
            localPlayerNum = 1;
            activeGameId = gameId;
            addActiveGameId(activeGameId);
            listenToGameUpdates(activeGameId);
            closeModal(joinGameModal);
            return;
        }
        if (gameData.player2 && gameData.player2.uid === auth.currentUser.uid) {
            // Allow player2 to rejoin/manage their own game!
            localPlayerNum = 2;
            activeGameId = gameId;
            addActiveGameId(activeGameId);
            listenToGameUpdates(activeGameId);
            closeModal(joinGameModal);
            return;
        }
        if (!gameData.player2) {
            // Show Player 2 setup modal
            openModal(player2SetupModal);

            // Remove previous listeners to avoid stacking
            const newConfirmBtn = confirmJoinGameButton.cloneNode(true);
            confirmJoinGameButton.parentNode.replaceChild(newConfirmBtn, confirmJoinGameButton);
            confirmJoinGameButton = newConfirmBtn;

            confirmJoinGameButton.onclick = async () => {
                player2Settings.uid = auth.currentUser.uid;
                player2Settings.color = player2ColorInput ? player2ColorInput.value : '#FFFFFF';
                player2Settings.piece = player2PieceSelect ? player2PieceSelect.value : DEFAULT_PIECE_KEY;
                try {
                    await updateDoc(gameDocRef, {
                        player2: player2Settings,
                        status: 'active'
                    });
                    localPlayerNum = 2;
                    activeGameId = gameId;
                    addActiveGameId(activeGameId);
                    listenToGameUpdates(activeGameId);
                    closeModal(player2SetupModal);
                    closeModal(joinGameModal);
                } catch (error) {
                    alert("Failed to join as Player 2: " + error.message);
                    console.error("Error joining as Player 2:", error);
                }
            };
            return;
        }
    } catch (error) {
        alert("Failed to join game: " + error.message);
        console.error("Error joining game:", error);
    }
}

async function createMultiplayerGame() {
    if (!auth || !auth.currentUser) {
        alert("You must be signed in to create a game.");
        return;
    }
    resetGame();
    player1Settings.uid = auth.currentUser.uid;
    player1Settings.color = playerColorInput ? playerColorInput.value : '#222222';
    player1Settings.piece = playerPieceSelect ? playerPieceSelect.value : DEFAULT_PIECE_KEY;

    const gameData = {
        player1: player1Settings,
        status: 'waiting',
        boardString: JSON.stringify(Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0))),
        captures: { 1: 0, 2: 0 },
        currentPlayer: 1,
        consecutivePasses: 0,
        koState: null,
        created: serverTimestamp()
    };

    try {
        const gameRef = await addDoc(collection(db, 'games'), gameData);
        activeGameId = gameRef.id;
        localPlayerNum = 1;
        addActiveGameId(activeGameId);
        listenToGameUpdates(activeGameId);
        closeModal(gameSetupModal);
        openModal(shareGameModal);
        document.getElementById('share-game-code-display').value = activeGameId;
        document.getElementById('share-game-link-display').value = `${window.location.origin}?game=${activeGameId}`;

        // Remove ?game=... from the URL for the creator
        if (window.history.replaceState) {
            const url = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, url);
        }
    } catch (error) {
        alert("Failed to create game: " + error.message);
        console.error("Error creating game:", error);
    }
}

// =================================================================
// AI Game State Management (FIXED)
// =================================================================
function saveAIGameToLocal() {
    if (gameMode === 'ai') {
        localStorage.setItem('aiGameState', JSON.stringify({
            board,
            captures,
            currentPlayer,
            consecutivePasses,
            player1Settings,
            player2Settings,
            gameOver,
            koState,
            currentDifficulty
        }));
    }
}

function loadAIGameFromLocal() {
    const data = localStorage.getItem('aiGameState');
    if (data) {
        try {
            const state = JSON.parse(data);
            board = state.board;
            captures = state.captures;
            currentPlayer = state.currentPlayer;
            consecutivePasses = state.consecutivePasses;
            player1Settings = state.player1Settings;
            player2Settings = state.player2Settings;
            gameOver = state.gameOver;
            koState = state.koState;
            currentDifficulty = state.currentDifficulty || 'easy';
            gameMode = 'ai';
            initThreeJS();
            updateScoreUI();
            updateTurnText();
            updateStatusText(`Resumed AI game (${currentDifficulty}).`);
            if (passTurnButton) passTurnButton.classList.remove('hidden');
            return true;
        } catch (e) {
            console.warn("Failed to load AI game from localStorage:", e);
        }
    }
    return false;
}

function clearAIGameFromLocal() {
    localStorage.removeItem('aiGameState');
}
console.log("main.js: SCRIPT EXECUTION FINISHED (END OF FILE).");
