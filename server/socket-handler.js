import {
  createLobby,
  joinLobby,
  getLobby,
  startGame,
  removePlayer,
  getPlayerBySession
} from './services/lobby-service.js';
import { guessLetter, getGameState, resetGame } from './services/game-service.js';
import { sendMessage, getChatHistory, sendSystemMessage } from './services/chat-service.js';

// Socket.io Event Handler
export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client verbunden: ${socket.id}`);

    let currentPlayer = null;
    let currentLobby = null;

    // Spieler tritt Lobby bei
    socket.on('player:join', async (data, callback) => {
      try {
        const { lobbyId, playerId, playerName } = data;

        // Hole Lobby-Details
        const lobby = await getLobby(lobbyId);
        if (!lobby) {
          return callback({ success: false, error: 'Lobby nicht gefunden' });
        }

        // Speichere Spieler-Info
        currentPlayer = { id: playerId, name: playerName, lobbyId };
        currentLobby = lobbyId;

        // Tritt Socket-Room bei
        socket.join(lobbyId);

        // Sende Chat-Historie
        const chatHistory = await getChatHistory(lobbyId);

        // Benachrichtige andere Spieler
        await sendSystemMessage(lobbyId, `${playerName} ist beigetreten`);
        socket.to(lobbyId).emit('player:joined', {
          playerId,
          playerName,
          playerCount: lobby.players.length
        });

        // Sende aktuelle Lobby-Daten zurück
        callback({
          success: true,
          lobby,
          chatHistory
        });

        console.log(`✅ ${playerName} trat Lobby ${lobby.code} bei`);
      } catch (error) {
        console.error('Fehler bei player:join:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Spiel starten
    socket.on('game:start', async (data, callback) => {
      try {
        const { lobbyId } = data;

        await startGame(lobbyId);
        const gameState = await getGameState(lobbyId);

        // Benachrichtige alle Spieler
        io.to(lobbyId).emit('game:started', gameState);
        await sendSystemMessage(lobbyId, 'Spiel gestartet!');

        callback({ success: true, gameState });

        console.log(`🎮 Spiel in Lobby ${lobbyId} gestartet`);
      } catch (error) {
        console.error('Fehler bei game:start:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Buchstabe raten
    socket.on('game:guess', async (data, callback) => {
      try {
        const { lobbyId, playerId, letter } = data;

        const result = await guessLetter(lobbyId, playerId, letter);

        if (!result.success) {
          return callback(result);
        }

        // Hole aktualisierten Game State
        const gameState = await getGameState(lobbyId);

        // Benachrichtige alle Spieler
        io.to(lobbyId).emit('game:updated', {
          ...gameState,
          lastGuess: {
            playerId,
            letter,
            isCorrect: result.isCorrect
          }
        });

        // System-Nachricht für Gewinn/Verlust
        if (result.hasWon) {
          await sendSystemMessage(lobbyId, '🎉 Glückwunsch! Das Wort wurde erraten!');
        } else if (result.hasLost) {
          await sendSystemMessage(lobbyId, `😢 Verloren! Das Wort war: ${result.word}`);
        }

        callback({ success: true, result, gameState });

        console.log(`🎲 Buchstabe "${letter}" geraten - ${result.isCorrect ? '✅' : '❌'}`);
      } catch (error) {
        console.error('Fehler bei game:guess:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Chat-Nachricht senden
    socket.on('chat:message', async (data, callback) => {
      try {
        const { lobbyId, playerId, playerName, message } = data;

        const result = await sendMessage(lobbyId, playerId, playerName, message);

        // Sende an alle Spieler in der Lobby
        io.to(lobbyId).emit('chat:new-message', result.message);

        callback({ success: true });
      } catch (error) {
        console.error('Fehler bei chat:message:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Spiel zurücksetzen
    socket.on('game:reset', async (data, callback) => {
      try {
        const { lobbyId } = data;

        await resetGame(lobbyId);
        const gameState = await getGameState(lobbyId);

        // Benachrichtige alle Spieler
        io.to(lobbyId).emit('game:reset', gameState);
        await sendSystemMessage(lobbyId, '🔄 Neues Spiel gestartet!');

        callback({ success: true, gameState });

        console.log(`🔄 Spiel in Lobby ${lobbyId} zurückgesetzt`);
      } catch (error) {
        console.error('Fehler bei game:reset:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Spieler-Disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 Client getrennt: ${socket.id}`);

      if (currentPlayer && currentLobby) {
        try {
          // Markiere Spieler als offline
          await removePlayer(currentPlayer.id);

          // Benachrichtige andere Spieler
          socket.to(currentLobby).emit('player:left', {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name
          });

          await sendSystemMessage(currentLobby, `${currentPlayer.name} hat die Lobby verlassen`);

          console.log(`👋 ${currentPlayer.name} hat Lobby verlassen`);
        } catch (error) {
          console.error('Fehler bei disconnect:', error);
        }
      }
    });

    // Ping-Pong für Connection-Check
    socket.on('ping', (callback) => {
      callback({ pong: true, timestamp: Date.now() });
    });
  });

  console.log('✅ Socket.io Handler eingerichtet');
}
