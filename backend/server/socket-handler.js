import {
  createLobby,
  joinLobby,
  getLobby,
  startGame,
  removePlayer,
  getPlayerBySession,
  deleteLobby
} from './services/lobby-service.js';
import { guessLetter, getGameState, resetGame } from './services/game-service.js';
import { setPlayerConnection } from './services/lobby-service.js';
import { sendMessage, getChatHistory, sendSystemMessage } from './services/chat-service.js';

// In-memory marker for lobbies being closed (prevents race condition with DB writes)
const closingLobbies = new Set();

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
        if (!lobby) {
          return callback({ success: false, error: 'Lobby nicht gefunden' });
        }

        currentPlayer = { id: playerId, name: playerName, lobbyId };
        currentLobby = lobbyId;

        // Ensure the socket joins the room immediately so room emits reach it
        socket.join(lobbyId);
        console.log(`ℹ️ Socket ${socket.id} joined room ${lobbyId}`);

        // Best-effort: persist system join message unless lobby is closing
        if (!closingLobbies.has(lobbyId)) {
          try { await sendSystemMessage(lobbyId, `${playerName} ist beigetreten`); } catch (e) { console.warn(e); }
        }

        // Fetch chat history AFTER sending system message so it includes the join message
        const chatHistory = await getChatHistory(lobbyId);

        // Get updated players list and emit to room
        const updatedLobby = await getLobby(lobbyId);
        socket.to(lobbyId).emit('player:joined', {
          playerId,
          playerName,
          playerCount: updatedLobby.players?.length || 0,
          players: updatedLobby.players || []
        });

        if (callback) callback({ success: true, lobby, chatHistory });
        console.log(`✅ ${playerName} trat Lobby ${lobby.lobby_code || lobbyId} bei`);
      } catch (error) {
        console.error('Fehler bei player:join:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Spieler reconnect mit Session
    socket.on('player:reconnect', async (data, callback) => {
      try {
        const { sessionId } = data;

        const player = await getPlayerBySession(sessionId);
        if (!player) {
          return callback({ success: false, error: 'Keine aktive Session gefunden' });
        }

        // Mark player as connected again
        await setPlayerConnection(player.id, true);

        currentPlayer = { id: player.id, name: player.player_name, lobbyId: player.lobby_id };
        currentLobby = player.lobby_id;

        socket.join(player.lobby_id);
        console.log(`ℹ️ Socket ${socket.id} reconnected to room ${player.lobby_id}`);

        const lobby = await getLobby(player.lobby_id);
        const chatHistory = await getChatHistory(player.lobby_id);
        const gameState = await getGameState(player.lobby_id);

        if (callback) callback({ 
          success: true, 
          player,
          lobby, 
          chatHistory,
          gameState
        });
        console.log(`🔄 ${player.player_name} hat sich wiederverbunden mit Lobby ${player.lobby_code}`);
      } catch (error) {
        console.error('Fehler bei player:reconnect:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Lobby/Game State abrufen
    socket.on('lobby:get-state', async (data, callback) => {
      try {
        const { lobbyId } = data;

        const lobby = await getLobby(lobbyId);
        if (!lobby) {
          return callback({ success: false, error: 'Lobby nicht gefunden' });
        }

        const gameState = await getGameState(lobbyId);
        const chatHistory = await getChatHistory(lobbyId);

        if (callback) callback({ 
          success: true, 
          lobby, 
          gameState,
          chatHistory
        });
        console.log(`📊 State abgerufen für Lobby ${lobbyId}`);
      } catch (error) {
        console.error('Fehler bei lobby:get-state:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Host verlässt Lobby → Lobby wird gelöscht
    socket.on('host:left', async (data, callback) => {
      try {
        const { lobbyId } = data;
        const lobby = await getLobby(lobbyId);
        if (!lobby) {
          if (callback) callback({ success: false, error: 'Lobby nicht gefunden' });
          return;
        }

        closingLobbies.add(lobbyId);

        console.log(`ℹ️ Emitting 'lobby:closed' for lobby ${lobbyId} (host-left)`);
        // Emit to all clients in the room (host and other players)
        io.to(lobbyId).emit('lobby:closed', { reason: 'host-left', lobbyCode: lobby.lobby_code });
        console.log(`✅ 'lobby:closed' event emitted to room ${lobbyId}`);

        try {
          await sendSystemMessage(lobbyId, `🗑️ Lobby ${lobby.lobby_code || lobbyId} wurde gelöscht (Host hat verlassen)`);
        } catch (err) {
          console.warn('Warnung: System-Nachricht konnte nicht gespeichert werden:', err);
        }

        await deleteLobby(lobbyId);
        closingLobbies.delete(lobbyId);

        console.log(`🗑️ Lobby ${lobbyId} gelöscht, da Host sie verlassen hat`);
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('Fehler bei host:left:', error);
        if (data && data.lobbyId) closingLobbies.delete(data.lobbyId);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Spieler verlässt Lobby (nicht Host)
    socket.on('player:left', async (data, callback) => {
      try {
        const { lobbyId, playerId, playerName } = data;

        if (closingLobbies.has(lobbyId)) {
          // still notify clients, but skip DB writes
          socket.to(lobbyId).emit('player:left', { playerId, playerName });
          if (callback) callback({ success: true });
          console.log(`ℹ️ Skipping DB update for player:left because lobby ${lobbyId} is closing`);
          return;
        }

        await removePlayer(playerId);
        
        // Get updated game state after player removal
        const updatedGameState = await getGameState(lobbyId);
        const updatedLobby = await getLobby(lobbyId);
        
        // Emit player left with updated game state
        socket.to(lobbyId).emit('player:left', {
          playerId,
          playerName,
          players: updatedLobby?.players || [],
          currentTurnIndex: updatedLobby?.currentTurnIndex
        });
        
        // If game is active, also emit game state update
        if (updatedGameState && updatedGameState.status === 'playing') {
          socket.to(lobbyId).emit('game:updated', updatedGameState);
        }

        try { await sendSystemMessage(lobbyId, `${playerName || 'Ein Spieler'} hat die Lobby verlassen`); } catch (e) { console.warn(e); }

        if (callback) callback({ success: true });
        console.log(`👋 Spieler ${playerId} hat Lobby ${lobbyId} verlassen`);
      } catch (error) {
        console.error('Fehler bei player:left:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Spiel starten
    socket.on('game:start', async (data, callback) => {
      try {
        const { lobbyId, maxAttempts = 8 } = data;

        await startGame(lobbyId, maxAttempts);
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
        if (closingLobbies.has(lobbyId)) return callback({ success: false, error: 'Lobby wird geschlossen' });

        const result = await guessLetter(lobbyId, playerId, letter);
        if (!result.success) return callback(result);

        const gameState = await getGameState(lobbyId);
        io.to(lobbyId).emit('game:updated', {
          ...gameState,
          lastGuess: { playerId, letter, isCorrect: result.isCorrect }
        });

        if (!closingLobbies.has(lobbyId)) {
          if (result.hasWon) await sendSystemMessage(lobbyId, '🎉 Glückwunsch! Das Wort wurde erraten!');
          else if (result.hasLost) await sendSystemMessage(lobbyId, `😢 Verloren! Das Wort war: ${result.word}`);
        }

        if (callback) callback({ success: true, result, gameState });
      } catch (error) {
        console.error('Fehler bei game:guess:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Spieler-Disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 Client getrennt: ${socket.id}`);

      if (currentPlayer && currentLobby) {
        try {
          const lobby = await getLobby(currentLobby);
          if (!lobby) {
            console.log(`ℹ️ Lobby ${currentLobby} bereits entfernt — DB-Updates übersprungen für Spieler ${currentPlayer.id}`);
            return;
          }

          const isHost = !!(
            (lobby.host_player_id && lobby.host_player_id === currentPlayer.id) ||
            (lobby.hostId === currentPlayer.id) ||
            (lobby.host === currentPlayer.id) ||
            (lobby.host && lobby.host.id === currentPlayer.id)
          );

          if (isHost) {
            // Do NOT delete lobby immediately on host disconnect; mark as disconnected
            await setPlayerConnection(currentPlayer.id, false);
            io.to(currentLobby).emit('host:disconnected', { hostId: currentPlayer.id });
            try { await sendSystemMessage(currentLobby, `⚠️ Host hat die Verbindung verloren — warte auf Wiederverbindung`); } catch (err) { console.warn(err); }
            console.log(`ℹ️ Host ${currentPlayer.id} getrennt — Lobby bleibt bestehen`);
          } else {
            if (closingLobbies.has(currentLobby)) {
              console.log(`ℹ️ Skipping disconnect DB updates for player ${currentPlayer.id} because lobby is closing`);
              return;
            }

            // Mark player as temporarily disconnected instead of deleting
            await setPlayerConnection(currentPlayer.id, false);
            
            // Get updated game state after player removal
            const updatedGameState = await getGameState(currentLobby);
            const updatedLobby = await getLobby(currentLobby);
            
            // Emit player left with updated game state
            io.to(currentLobby).emit('player:left', {
              playerId: currentPlayer.id,
              playerName: currentPlayer.name,
              players: updatedLobby?.players || [],
              currentTurnIndex: updatedLobby?.currentTurnIndex
            });
            
            // If game is active, also emit game state update
            if (updatedGameState && updatedGameState.status === 'playing') {
              io.to(currentLobby).emit('game:updated', updatedGameState);
            }

            try { await sendSystemMessage(currentLobby, `${currentPlayer.name} hat die Verbindung verloren`); } catch (err) { console.warn(err); }

            console.log(`👋 ${currentPlayer.name} hat Lobby verlassen`);
          }
        } catch (error) {
          console.error('Fehler bei disconnect:', error);
        }
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

        if (callback) callback({ success: true, gameState });
        console.log(`🔄 Spiel in Lobby ${lobbyId} zurückgesetzt`);
      } catch (error) {
        console.error('Fehler bei game:reset:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Chat-Nachricht senden
    socket.on('chat:message', async (data, callback) => {
      try {
        const { lobbyId, playerId, playerName, message } = data;

        if (!message || !message.trim()) {
          return callback({ success: false, error: 'Nachricht darf nicht leer sein' });
        }

        // Speichere Nachricht in DB
        await sendMessage(lobbyId, playerId, playerName, message.trim());

        // Sende Nachricht an alle Clients in der Lobby
        io.to(lobbyId).emit('chat:new-message', {
          playerId,
          playerName,
          message: message.trim(),
          messageType: 'player'
        });

        if (callback) callback({ success: true });
        console.log(`💬 Chat-Nachricht von ${playerName} in Lobby ${lobbyId}`);
      } catch (error) {
        console.error('Fehler bei chat:message:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ping
    socket.on('ping', (callback) => {
      callback({ pong: true, timestamp: Date.now() });
    });
  });

  console.log('✅ Socket.io Handler eingerichtet');
}
