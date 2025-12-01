// Hangman Multiplayer Game - Client-Side Logic
import {
  initSocket,
  on,
  joinLobbySocket,
  startGameSocket,
  guessLetterSocket,
  sendChatMessage,
  resetGameSocket,
  hostLeaveLobby,
  playerLeaveLobby
} from '../../js/socket-client.js';

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
const myPlayerNameDisplay = document.getElementById('myPlayerNameDisplay');
const difficultySelector = document.getElementById('difficultySelector');


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

  // Zeige Lobby-Code und Spielername
  lobbyCodeDisplay.textContent = `CODE: ${gameState.lobbyCode}`;
  if (myPlayerNameDisplay) {
    myPlayerNameDisplay.textContent = gameState.playerName;
  }

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

    // Zeige Start-Button und Difficulty Selector nur für Host
    if (gameState.isHost && gameState.status === 'waiting') {
      startGameBtn.style.display = 'block';
      if (difficultySelector) {
        difficultySelector.style.display = 'block';
      }
    }

  } catch (error) {
    console.error('❌ Fehler beim Beitreten:', error);
    alert('Fehler beim Beitreten der Lobby: ' + error);
    sessionStorage.clear(); // Fix: Session löschen, wenn Beitritt fehlschlägt (z.B. Lobby existiert nicht mehr)
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

    // Fix: Aktualisiere Spielerliste sofort
    if (data.players) {
      gameState.players = data.players;
      updatePlayersList();
    }
  });

  // Spieler left
  on('player:left', (data) => {
    console.log('👋 Spieler verlassen:', data.playerName);
    addSystemMessage(`${data.playerName || 'Ein Spieler'} hat die Lobby verlassen`);

    // Fix: Entferne Spieler aus der Liste und aktualisiere UI
    if (data.playerId) {
      gameState.players = gameState.players.filter(p => p.id !== data.playerId);
      updatePlayersList();
    }
  });

  // Spiel gestartet
  on('game:started', (data) => {
    console.log('🎮 Spiel gestartet!');
    updateGameState(data);
    startGameBtn.style.display = 'none';
    if (difficultySelector) {
      difficultySelector.style.display = 'none';
    }
    gameMessage.innerHTML = '';
  });

  // Spiel aktualisiert
  on('game:updated', (data) => {
    console.log('🔄 Spiel aktualisiert:');
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
    console.log('🔄 Spiel zurückgesetzt:');
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

// Lobby geschlossen (z. B. Host hat verlassen)
on('lobby:closed', () => {
  // Fix: Session sofort löschen, damit kein Rejoin-Versuch möglich ist
  sessionStorage.clear();

  addSystemMessage('Der Host hat die Lobby verlassen. Du wirst zurück ins Menü geleitet.');

  setTimeout(() => {
    window.location.href = '../index.html';
  }, 3000); // 3 Sekunden warten, um Nachricht zu sehen
});

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
  gameState.maxAttempts = data.maxAttempts || 8; // Add maxAttempts from server


  updateUI();
}

function updateUI() {
  // Wort-Fortschritt
  wordDisplay.textContent = gameState.wordProgress || '';

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
  const maxAttempts = gameState.maxAttempts || 8;

  // Calculate how many of the 12 parts to draw
  // Use Math.ceil to ensure we start drawing from the first error
  const partsToDraw = Math.ceil((wrongCount / maxAttempts) * 12);

  // Step 1: Galgen Basis
  if (partsToDraw >= 1) {
    ctx.beginPath();
    ctx.moveTo(20, 280);
    ctx.lineTo(180, 280);
    ctx.stroke();
  }

  // Step 2: Vertikaler Pfosten (unten)
  if (partsToDraw >= 2) {
    ctx.beginPath();
    ctx.moveTo(50, 280);
    ctx.lineTo(50, 200);
    ctx.stroke();
  }

  // Step 3: Vertikaler Pfosten (mitte)
  if (partsToDraw >= 3) {
    ctx.beginPath();
    ctx.moveTo(50, 200);
    ctx.lineTo(50, 120);
    ctx.stroke();
  }

  // Step 4: Vertikaler Pfosten (oben)
  if (partsToDraw >= 4) {
    ctx.beginPath();
    ctx.moveTo(50, 120);
    ctx.lineTo(50, 20);
    ctx.stroke();
  }

  // Step 5: Horizontaler Balken (links)
  if (partsToDraw >= 5) {
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(100, 20);
    ctx.stroke();
  }

  // Step 6: Horizontaler Balken (rechts)
  if (partsToDraw >= 6) {
    ctx.beginPath();
    ctx.moveTo(100, 20);
    ctx.lineTo(150, 20);
    ctx.stroke();
  }

  // Step 7: Seil
  if (partsToDraw >= 7) {
    ctx.beginPath();
    ctx.moveTo(150, 20);
    ctx.lineTo(150, 50);
    ctx.stroke();
  }

  // Step 8: Kopf
  if (partsToDraw >= 8) {
    ctx.beginPath();
    ctx.arc(150, 70, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Step 9: Körper
  if (partsToDraw >= 9) {
    ctx.beginPath();
    ctx.moveTo(150, 90);
    ctx.lineTo(150, 150);
    ctx.stroke();
  }

  // Step 10: Arme (beide)
  if (partsToDraw >= 10) {
    // Linker Arm
    ctx.beginPath();
    ctx.moveTo(150, 110);
    ctx.lineTo(120, 130);
    ctx.stroke();

    // Rechter Arm
    ctx.beginPath();
    ctx.moveTo(150, 110);
    ctx.lineTo(180, 130);
    ctx.stroke();
  }

  // Step 11: Beine (beide)
  if (partsToDraw >= 11) {
    // Linkes Bein
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.lineTo(120, 190);
    ctx.stroke();

    // Rechtes Bein
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.lineTo(180, 190);
    ctx.stroke();
  }

  // Step 12: Gesicht (Augen)
  if (partsToDraw >= 12) {
    // Linkes Auge
    ctx.beginPath();
    ctx.arc(145, 67, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();

    // Rechtes Auge
    ctx.beginPath();
    ctx.arc(155, 67, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================
// GAME EVENTS
// ============================================
async function handleStartGame() {
  if (!gameState.isHost) {
    return;
  }

  // Get selected difficulty
  let maxAttempts = 8; // default
  if (difficultySelector) {
    const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked');
    if (selectedDifficulty) {
      maxAttempts = parseInt(selectedDifficulty.value);
    }
  }

  startGameBtn.disabled = true;

  try {
    await startGameSocket(gameState.lobbyId, maxAttempts);
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
    createLetterButtons();
    startGameBtn.disabled = false
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
    newGameBtn.disabled = false;
  }
}

function handleMenu() {
  const confirmLeave = confirm('Möchtest du die Lobby wirklich verlassen?');
  if (confirmLeave) {
    (async () => {
      try {
        if (gameState.isHost) {
          await hostLeaveLobby(gameState.lobbyId);
        } else {
          await playerLeaveLobby(gameState.lobbyId, gameState.playerId);
        }
      } catch (error) {
        console.error('Fehler beim Verlassen der Lobby:', error);
      } finally {
        sessionStorage.clear();
        window.location.href = '../index.html';
      }
    })();
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