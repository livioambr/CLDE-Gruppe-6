  // Socket.io Client für Hangman Multiplayer
// Exportiert Socket-Instanz und Helper-Funktionen

const SERVER_URL = window.location.origin; // Verwendet automatisch die aktuelle URL
let socket = null;
let isConnected = false;

// Socket.io initialisieren
export function initSocket() {
  if (socket && isConnected) {
    console.log('Socket bereits verbunden');
    return socket;
  }

  socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  // Connection Events
  socket.on('connect', () => {
    console.log('✅ Socket verbunden:', socket.id);
    isConnected = true;
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket getrennt:', reason);
    isConnected = false;
  });

  socket.on('connect_error', (error) => {
    console.error('Socket Verbindungsfehler:', error);
    isConnected = false;
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Reconnected nach ${attemptNumber} Versuchen`);
    isConnected = true;
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ Reconnect fehlgeschlagen');
    showError('Verbindung zum Server verloren. Bitte Seite neu laden.');
  });

  return socket;
}

// Socket-Instanz abrufen
export function getSocket() {
  if (!socket) {
    return initSocket();
  }
  return socket;
}

// Prüfe ob Socket verbunden ist
export function isSocketConnected() {
  return socket && isConnected;
}

// Event-Handler registrieren
export function on(event, callback) {
  const s = getSocket();
  s.on(event, callback);
}

// Event mit einmaliger Ausführung
export function once(event, callback) {
  const s = getSocket();
  s.once(event, callback);
}

// Event-Handler entfernen
export function off(event, callback) {
  if (socket) {
    socket.off(event, callback);
  }
}

// Event senden (mit Callback)
export function emit(event, data, callback) {
  const s = getSocket();
  if (callback) {
    s.emit(event, data, callback);
  } else {
    return new Promise((resolve, reject) => {
      s.emit(event, data, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(response.error || 'Unbekannter Fehler');
        }
      });
    });
  }
}

// Helper: Lobby beitreten
export async function joinLobbySocket(lobbyId, playerId, playerName) {
  try {
    const response = await emit('player:join', {
      lobbyId,
      playerId,
      playerName
    });
    console.log('Lobby beigetreten:', response);
    return response;
  } catch (error) {
    console.error('Fehler beim Beitreten:', error);
    throw error;
  }
}


// Helper: Host verlässt Lobby
export async function hostLeaveLobby(lobbyId) {
  return emit('host:left', { lobbyId });
}

// Helper: Spieler verlässt Lobby
export async function playerLeaveLobby(lobbyId, playerId) {
  return emit('player:left', { lobbyId, playerId });
}



// Helper: Spiel starten
export async function startGameSocket(lobbyId) {
  try {
    const response = await emit('game:start', { lobbyId });
    console.log('Spiel gestartet:', response);
    return response;
  } catch (error) {
    console.error('Fehler beim Starten:', error);
    throw error;
  }
}

// Helper: Buchstabe raten
export async function guessLetterSocket(lobbyId, playerId, letter) {
  try {
    const response = await emit('game:guess', {
      lobbyId,
      playerId,
      letter
    });
    console.log('Buchstabe geraten:', letter, response);
    return response;
  } catch (error) {
    console.error('Fehler beim Raten:', error);
    throw error;
  }
}

// Helper: Chat-Nachricht senden
export async function sendChatMessage(lobbyId, playerId, playerName, message) {
  try {
    const response = await emit('chat:message', {
      lobbyId,
      playerId,
      playerName,
      message
    });
    console.log('Nachricht gesendet:', message);
    return response;
  } catch (error) {
    console.error('Fehler beim Senden:', error);
    throw error;
  }
}

// Helper: Spiel zurücksetzen
export async function resetGameSocket(lobbyId) {
  try {
    const response = await emit('game:reset', { lobbyId });
    console.log('Spiel zurückgesetzt:', response);
    return response;
  } catch (error) {
    console.error('Fehler beim Zurücksetzen:', error);
    throw error;
  }
}

// Ping-Pong für Connection-Check
export function ping() {
  return new Promise((resolve) => {
    const s = getSocket();
    s.emit('ping', (response) => {
      resolve(response);
    });
  });
}

// Fehler-Nachricht anzeigen (kann überschrieben werden)
function showError(message) {
  console.error(message);
  alert(message);
}

// Socket trennen
export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected = false;
    console.log('Socket getrennt');
  }
}

export default {
  initSocket,
  getSocket,
  isSocketConnected,
  on,
  once,
  off,
  emit,
  joinLobbySocket,
  startGameSocket,
  guessLetterSocket,
  sendChatMessage,
  resetGameSocket,
  ping,
  disconnect
};
