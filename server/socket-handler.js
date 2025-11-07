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

        const lobby = await getLobby(lobbyId);
        if (!lobby) return callback({ success: false, error: 'Lobby nicht gefunden' });

        currentPlayer = { id: playerId, name: playerName, lobbyId };
        currentLobby = lobbyId;

        socket.join(lobbyId);

        const chatHistory = await getChatHistory(lobbyId);
        await sendSystemMessage(lobbyId, `${playerName} ist beigetreten`);

        socket.to(lobbyId).emit('player:joined', {
          playerId,
          playerName,
          playerCount: lobby.players.length
        });

        callback({ success: true, lobby, chatHistory });
        console.log(`✅ ${playerName} trat Lobby ${lobby.code} bei`);
      } catch (error) {
        console.error('Fehler bei player:join:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Host verlässt Lobby → alle Spieler raus
    socket.on('host:left', async (data) => {
      try {
        const { lobbyId } = data;
        const lobby = await getLobby(lobbyId);
        if (!lobby) return;

        // Hole alle Spieler
        const players = lobby.players || [];

        // Informiere alle Spieler, dass die Lobby geschlossen wird
        players.forEach(p => {
          if (p.id !== currentPlayer?.id) {
            io.to(p.id).emit('lobby:closed');
          }
        });

        // Lobby, Spieler und Game State löschen
        await removePlayer(null, lobbyId); // löscht alle Spieler der Lobby
        await resetGame(lobbyId);          // optional: reset GameState
        console.log(`🗑️ Lobby ${lobbyId} geschlossen vom Host`);
      } catch (error) {
        console.error('Fehler bei host:left:', error);
      }
    });

    // Spieler verlässt Lobby (nicht Host)
    socket.on('player:left', async (data) => {
      try {
        const { lobbyId, playerId } = data;
        await removePlayer(playerId);

        socket.to(lobbyId).emit('player:left', { playerId });
        await sendSystemMessage(lobbyId, `${currentPlayer?.name} hat die Lobby verlassen`);

        console.log(`👋 Spieler ${playerId} hat Lobby ${lobbyId} verlassen`);
      } catch (error) {
        console.error('Fehler bei player:left:', error);
      }
    });

    // Spiel starten
    socket.on('game:start', async (data, callback) => {
      try {
        const { lobbyId } = data;

        await startGame(lobbyId);
        const gameState = await getGameState(lobbyId);

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
        if (!result.success) return callback(result);

        const gameState = await getGameState(lobbyId);
        io.to(lobbyId).emit('game:updated', {
          ...gameState,
          lastGuess: { playerId, letter, isCorrect: result.isCorrect }
        });

        if (result.hasWon) await sendSystemMessage(lobbyId, '🎉 Glückwunsch! Das Wort wurde erraten!');
        else if (result.hasLost) await sendSystemMessage(lobbyId, `😢 Verloren! Das Wort war: ${result.word}`);

        callback({ success: true, result, gameState });
        console.log(`🎲 Buchstabe "${letter}" geraten - ${result.isCorrect ? '✅' : '❌'}`);
      } catch (error) {
        console.error('Fehler bei game:guess:', error);
        callback({ success: false, error: error.message });
      }
    });

    // Spiel zurücksetzen
    socket.on('game:reset', async (data, callback) => {
      try {
        const { lobbyId } = data;

        await resetGame(lobbyId);
        const gameState = await getGameState(lobbyId);

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
          await removePlayer(currentPlayer.id);
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

    // Ping-Pong
    socket.on('ping', (callback) => {
      callback({ pong: true, timestamp: Date.now() });
    });
  });

  console.log('✅ Socket.io Handler eingerichtet');
}
