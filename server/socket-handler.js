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

        // Hole aktualisierte Spielerliste
        const updatedLobby = await getLobby(lobbyId);

        socket.to(lobbyId).emit('player:joined', {
          playerId,
          playerName,
          playerCount: updatedLobby.players.length,
          players: updatedLobby.players // Fix: Sende komplette Spielerliste
        });

        callback({ success: true, lobby, chatHistory });
        console.log(`✅ ${playerName} trat Lobby ${lobby.code} bei`);
      } catch (error) {
        console.error('Fehler bei player:join:', error);
        callback({ success: false, error: error.message });
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

        // Informiere alle Clients in der Lobby-Room (sicher, weil sockets join(lobbyId) nutzen)
        io.to(lobbyId).emit('lobby:closed');

        // Sende System-Nachricht bevor die DB-Zeilen gelöscht werden (vermeidet FK-Fehler)
        try {
          await sendSystemMessage(lobbyId, `🗑️ Lobby ${lobby.code} wurde gelöscht (Host hat verlassen)`);
        } catch (err) {
          console.error('Warnung: System-Nachricht konnte nicht gespeichert werden:', err);
          // Weiterfahren – löschen trotzdem ausführen
        }

        // Alle Spieler & Game-State löschen (deleteLobby löscht abhängige Tabellen)
        await deleteLobby(lobbyId);

        console.log(`🗑️ Lobby ${lobbyId} gelöscht, da Host sie verlassen hat`);

        if (callback) callback({ success: true });
      } catch (error) {
        console.error('Fehler bei host:left:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });



    // Spieler verlässt Lobby (nicht Host)
    socket.on('player:left', async (data, callback) => {
      try {
        const { lobbyId, playerId } = data;
        await removePlayer(playerId);

        socket.to(lobbyId).emit('player:left', { playerId });
        await sendSystemMessage(lobbyId, `${currentPlayer?.name || 'Ein Spieler'} hat die Lobby verlassen`);

        console.log(`👋 Spieler ${playerId} hat Lobby ${lobbyId} verlassen`);

        if (callback) callback({ success: true });
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
          // Hole Lobby, um zu prüfen ob der disconnectende Spieler der Host ist
          const lobby = await getLobby(currentLobby);

          // Wenn Lobby bereits gelöscht wurde (z.B. Host hat sie entfernt), NICHTS an der DB ändern
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
            // Wenn Host disconnectet → Lobby schließen: zuerst die Clients informieren, dann DB löschen
            io.to(currentLobby).emit('lobby:closed', { reason: 'host-disconnect' });

            try {
              await sendSystemMessage(currentLobby, `🗑️ Lobby ${lobby.code} wurde gelöscht (Host hat die Verbindung verloren)`);
            } catch (err) {
              console.warn('Warnung: System-Nachricht konnte nicht gespeichert werden:', err);
              // Weiterfahren – löschen trotzdem ausführen
            }

            await deleteLobby(currentLobby);
            console.log(`🗑️ Lobby ${currentLobby} gelöscht, da Host die Verbindung verloren hat`);
          } else {
            // Nicht-Host: Markiere Spieler als disconnected und informiere andere Spieler
            await removePlayer(currentPlayer.id);

            socket.to(currentLobby).emit('player:left', {
              playerId: currentPlayer.id,
              playerName: currentPlayer.name
            });

            // Nur System-Chat-Nachricht senden, wenn Lobby noch existiert und es kein Host-Fall ist
            try {
              await sendSystemMessage(currentLobby, `${currentPlayer.name} hat die Lobby verlassen`);
            } catch (err) {
              console.warn('Warnung: System-Nachricht konnte nicht gespeichert werden:', err);
            }

            console.log(`👋 ${currentPlayer.name} hat Lobby verlassen`);
          }
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
