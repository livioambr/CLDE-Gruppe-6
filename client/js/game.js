// Hangman Multiplayer Game - Client-Side Logic
import {
  initSocket,
  on,
  joinLobbySocket,
  startGameSocket,
  guessLetterSocket,
  sendChatMessage,
  resetGameSocket
} from './socket-client.js';

// ============================================
// GLOBALE VARIABLEN
// ============================================
let gameState = {
  lobbyId: null,
  lobbyCode: null,
  playerId: null,
  playerName: null,
  isHost: false,
  players: [],
  currentTurnIndex: 0,
  wordProgress: '',
  guessedLetters: [],
  incorrectGuesses: [],
  attemptsLeft: 6,
  maxAttempts: 6,
  status: 'waiting',
  word: null
};

// DOM Elemente
const canvas = document.getElementById('hangmanCanvas');
const ctx = canvas.getContext('2d');
const wordDisplay = document.getElementById('wordDisplay');
const lettersGrid = document.getElementById('lettersGrid');
const attemptsLeftDisplay = document.getElementById('attemptsLeft');
const currentPlayerNameDisplay = document.getElementById('currentPlayerName');
const lobbyCodeDisplay = document.getElementById('lobbyCodeDisplay');
const startGameBtn = document.getElementById('startGameBtn');
const newGameBtn = document.getElementById('newGameBtn');
const gameMessage = document.getElementById('gameMessage');
const menuBtn = document.getElementById('menuBtn');
const playersListContainer = document.getElementById('playersList');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

// ============================================
// INITIALISIERUNG
// ============================================
async function init() {
  console.log('🎮 Initialisiere Hangman Multiplayer...');

  // Lade Session-Daten
  gameState.lobbyId = sessionStorage.getItem('lobbyId');
  gameState.playerId = sessionStorage.getItem('playerId');
  gameState.playerName = sessionStorage.getItem('playerName');
  gameState.lobbyCode = sessionStorage.getItem('lobbyCode');
  gameState.isHost = sessionStorage.getItem('isHost') === 'true';

  // Prüfe Session-Daten
  if (!gameState.lobbyId || !gameState.playerId || !gameState.playerName) {
    alert('Keine gültige Session gefunden. Bitte erstelle eine neue Session.');
    window.location.href = 'lobby.html';
    return;
  }

  // Zeige Lobby-Code
  lobbyCodeDisplay.textContent = `CODE: ${gameState.lobbyCode}`;

  // Initialisiere Socket.io
  console.log('🔌 Verbinde mit Server...');
  initSocket();

  // Setup Socket-Event-Listener
  setupSocketListeners();

  // Tritt Lobby bei
  try {
    const response = await joinLobbySocket(
      gameState.lobbyId,
      gameState.playerId,
      gameState.playerName
    );

    console.log('✅ Lobby beigetreten:', response);

    // Aktualisiere Game State
    updateGameState(response.lobby);

    // Lade Chat-Historie
    if (response.chatHistory && response.chatHistory.length > 0) {
      response.chatHistory.forEach(msg => {
        addChatMessage(msg.player_name, msg.message, msg.message_type);
      });
    }

    // Zeige Start-Button nur für Host
    if (gameState.isHost && gameState.status === 'waiting') {
      startGameBtn.style.display = 'block';
    }

  } catch (error) {
    console.error('❌ Fehler beim Beitreten:', error);
    alert('Fehler beim Beitreten der Lobby: ' + error);
    window.location.href = 'lobby.html';
  }

  // Erstelle Buchstaben-Tastatur
  createLetterButtons();

  // Event Listener
  startGameBtn.addEventListener('click', handleStartGame);
  newGameBtn.addEventListener('click', handleNewGame);
  menuBtn.addEventListener('click', handleMenu);
  chatForm.addEventListener('submit', handleChatSubmit);
}

// ============================================
// SOCKET EVENT LISTENER
// ============================================
function setupSocketListeners() {
  // Spieler joined
  on('player:joined', (data) => {
    console.log('👤 Neuer Spieler:', data.playerName);
    addSystemMessage(`${data.playerName} ist beigetreten`);
    // Game State wird automatisch über game:updated aktualisiert
  });

  // Spieler left
  on('player:left', (data) => {
    console.log('👋 Spieler verlassen:', data.playerName);
    addSystemMessage(`${data.playerName} hat die Lobby verlassen`);
  });

  // Spiel gestartet
  on('game:started', (data) => {
    console.log('🎮 Spiel gestartet!', data);
    updateGameState(data);
    startGameBtn.style.display = 'none';
    gameMessage.innerHTML = '';
  });

  // Spiel aktualisiert
  on('game:updated', (data) => {
    console.log('🔄 Spiel aktualisiert:', data);
    updateGameState(data);

    // Zeige Feedback für letzten Zug
    if (data.lastGuess) {
      const letter = data.lastGuess.letter;
      const isCorrect = data.lastGuess.isCorrect;

      if (isCorrect) {
        addSystemMessage(`Buchstabe "${letter}" ist richtig! ✅`);
      } else {
        addSystemMessage(`Buchstabe "${letter}" ist falsch! ❌`);
      }
    }

    // Prüfe auf Gewinn/Verlust
    if (data.status === 'finished') {
      handleGameEnd(data);
    }
  });

  // Spiel zurückgesetzt
  on('game:reset', (data) => {
    console.log('🔄 Spiel zurückgesetzt:', data);
    updateGameState(data);
    newGameBtn.style.display = 'none';
    if (gameState.isHost) {
      startGameBtn.style.display = 'block';
    }
    gameMessage.innerHTML = '';
    clearCanvas();
  });

  // Chat-Nachricht empfangen
  on('chat:new-message', (data) => {
    addChatMessage(data.playerName, data.message, data.messageType);
  });
}

// ============================================
// GAME STATE MANAGEMENT
// ============================================
function updateGameState(data) {
  gameState.status = data.status;
  gameState.players = data.players || [];
  gameState.currentTurnIndex = data.currentTurnIndex;
  gameState.wordProgress = data.wordProgress || '';
  gameState.guessedLetters = data.guessedLetters || [];
  gameState.incorrectGuesses = data.incorrectGuesses || [];
  gameState.attemptsLeft = data.attemptsLeft;
  gameState.word = data.word;

  updateUI();
}

function updateUI() {
  // Wort-Fortschritt
  wordDisplay.textContent = gameState.wordProgress || '_ _ _ _ _';

  // Versuche übrig
  attemptsLeftDisplay.textContent = gameState.attemptsLeft;

  // Aktueller Spieler
  if (gameState.players.length > 0) {
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    if (currentPlayer) {
      const isMyTurn = currentPlayer.id === gameState.playerId;
      currentPlayerNameDisplay.textContent = currentPlayer.player_name;
      currentPlayerNameDisplay.className = isMyTurn ? 'turn-indicator your-turn' : 'turn-indicator';
    }
  }

  // Spieler-Liste
  updatePlayersList();

  // Buchstaben-Buttons aktualisieren
  updateLetterButtons();

  // Hangman zeichnen
  drawHangman();
}

function updatePlayersList() {
  playersListContainer.innerHTML = '';

  gameState.players.forEach((player, index) => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';

    if (index === gameState.currentTurnIndex && gameState.status === 'playing') {
      playerItem.classList.add('active-turn');
    }

    const avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    avatar.textContent = player.player_name.charAt(0).toUpperCase();

    const name = document.createElement('div');
    name.className = 'player-name';
    name.textContent = player.player_name + (player.is_host ? ' 👑' : '');

    playerItem.appendChild(avatar);
    playerItem.appendChild(name);
    playersListContainer.appendChild(playerItem);
  });
}

// ============================================
// BUCHSTABEN-TASTATUR
// ============================================
function createLetterButtons() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  lettersGrid.innerHTML = '';

  for (let letter of alphabet) {
    const btn = document.createElement('button');
    btn.className = 'letter-btn';
    btn.textContent = letter;
    btn.dataset.letter = letter;
    btn.addEventListener('click', () => handleLetterClick(letter, btn));
    lettersGrid.appendChild(btn);
  }
}

function updateLetterButtons() {
  const buttons = lettersGrid.querySelectorAll('.letter-btn');

  buttons.forEach(btn => {
    const letter = btn.dataset.letter;

    if (gameState.guessedLetters.includes(letter)) {
      btn.disabled = true;
      if (gameState.incorrectGuesses.includes(letter)) {
        btn.classList.add('wrong');
      } else {
        btn.classList.add('correct');
      }
    } else {
      btn.disabled = gameState.status !== 'playing';
    }
  });
}

async function handleLetterClick(letter, btn) {
  // Prüfe ob Spieler an der Reihe ist
  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  if (!currentPlayer || currentPlayer.id !== gameState.playerId) {
    addSystemMessage('Du bist nicht an der Reihe!');
    return;
  }

  // Prüfe ob Spiel läuft
  if (gameState.status !== 'playing') {
    return;
  }

  // Deaktiviere Button sofort
  btn.disabled = true;

  try {
    await guessLetterSocket(gameState.lobbyId, gameState.playerId, letter);
    // Game State wird über 'game:updated' Event aktualisiert
  } catch (error) {
    console.error('Fehler beim Raten:', error);
    addSystemMessage('Fehler: ' + error);
    btn.disabled = false;
  }
}

// ============================================
// HANGMAN ZEICHNUNG
// ============================================
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawHangman() {
  clearCanvas();

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  const wrongCount = gameState.maxAttempts - gameState.attemptsLeft;

  if (wrongCount >= 1) {
    // Galgen Basis
    ctx.beginPath();
    ctx.moveTo(20, 280);
    ctx.lineTo(180, 280);
    ctx.stroke();
  }

  if (wrongCount >= 2) {
    // Vertikaler Balken
    ctx.beginPath();
    ctx.moveTo(50, 280);
    ctx.lineTo(50, 20);
    ctx.stroke();
  }

  if (wrongCount >= 3) {
    // Horizontaler Balken
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(150, 20);
    ctx.stroke();
  }

  if (wrongCount >= 4) {
    // Seil
    ctx.beginPath();
    ctx.moveTo(150, 20);
    ctx.lineTo(150, 50);
    ctx.stroke();
  }

  if (wrongCount >= 5) {
    // Kopf
    ctx.beginPath();
    ctx.arc(150, 70, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (wrongCount >= 6) {
    // Körper
    ctx.beginPath();
    ctx.moveTo(150, 90);
    ctx.lineTo(150, 150);
    ctx.stroke();

    // Arme
    ctx.beginPath();
    ctx.moveTo(150, 110);
    ctx.lineTo(120, 130);
    ctx.moveTo(150, 110);
    ctx.lineTo(180, 130);
    ctx.stroke();

    // Beine
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.lineTo(120, 190);
    ctx.moveTo(150, 150);
    ctx.lineTo(180, 190);
    ctx.stroke();
  }
}

// ============================================
// GAME EVENTS
// ============================================
async function handleStartGame() {
  if (!gameState.isHost) {
    return;
  }

  startGameBtn.disabled = true;

  try {
    await startGameSocket(gameState.lobbyId);
    // Game State wird über 'game:started' Event aktualisiert
  } catch (error) {
    console.error('Fehler beim Starten:', error);
    alert('Fehler beim Starten des Spiels: ' + error);
    startGameBtn.disabled = false;
  }
}

async function handleNewGame() {
  if (!gameState.isHost) {
    return;
  }

  newGameBtn.disabled = true;

  try {
    await resetGameSocket(gameState.lobbyId);
    // Game State wird über 'game:reset' Event aktualisiert
  } catch (error) {
    console.error('Fehler beim Zurücksetzen:', error);
    alert('Fehler beim Zurücksetzen: ' + error);
    newGameBtn.disabled = false;
  }
}

function handleGameEnd(data) {
  const hasWon = !data.wordProgress.includes('_');

  if (hasWon) {
    gameMessage.innerHTML = '<div class="game-message win">🎉 Glückwunsch! Das Wort wurde erraten!</div>';
  } else {
    gameMessage.innerHTML = `<div class="game-message lose">😢 Verloren! Das Wort war: <strong>${data.word}</strong></div>`;
  }

  // Zeige "Neues Spiel" Button für Host
  if (gameState.isHost) {
    newGameBtn.style.display = 'block';
  }
}

function handleMenu() {
  const confirmLeave = confirm('Möchtest du die Lobby wirklich verlassen?');
  if (confirmLeave) {
    sessionStorage.clear();
    window.location.href = '../index.html';
  }
}

// ============================================
// CHAT SYSTEM
// ============================================
async function handleChatSubmit(e) {
  e.preventDefault();

  const message = chatInput.value.trim();
  if (!message) return;

  try {
    await sendChatMessage(
      gameState.lobbyId,
      gameState.playerId,
      gameState.playerName,
      message
    );
    chatInput.value = '';
  } catch (error) {
    console.error('Fehler beim Senden:', error);
  }
}

function addChatMessage(playerName, message, type = 'player') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;

  if (type === 'system') {
    messageDiv.innerHTML = `<div class="message-text">${message}</div>`;
  } else {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
                    now.getMinutes().toString().padStart(2, '0');

    messageDiv.innerHTML = `
      <div class="message-header">
        <span class="message-user">${playerName}</span>
        <span class="message-time">${timeStr}</span>
      </div>
      <div class="message-text">${escapeHtml(message)}</div>
    `;
  }

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(message) {
  addChatMessage('System', message, 'system');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// START
// ============================================
window.addEventListener('DOMContentLoaded', init);

console.log('🎮 Hangman Game Module geladen');
