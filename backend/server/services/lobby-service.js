import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection.js';

// Generiere 6-stelligen Lobby-Code
function generateLobbyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Wähle zufälliges Wort aus der Datenbank
async function getRandomWord() {
  const word = await queryOne(
    'SELECT word FROM words ORDER BY RAND() LIMIT 1'
  );
  return word ? word.word : 'HANGMAN';
}

// Erstelle neue Lobby
export async function createLobby(hostName, sessionId) {
  const lobbyId = uuidv4();
  const lobbyCode = generateLobbyCode();
  const playerId = uuidv4();
  const word = await getRandomWord();

  try {
    await query(
      `INSERT INTO lobbies (id, lobby_code, host_player_id, word, status, current_turn_index, attempts_left, max_attempts)
       VALUES (?, ?, ?, ?, 'waiting', 0, 12, 12)`,
      [lobbyId, lobbyCode, playerId, word]
    );

    await query(
      `INSERT INTO players (id, lobby_id, player_name, session_id, turn_order, is_host, is_connected)
       VALUES (?, ?, ?, ?, 0, TRUE, TRUE)`,
      [playerId, lobbyId, hostName, sessionId]
    );

    await query(
      `INSERT INTO game_state (lobby_id, guessed_letters, revealed_positions, incorrect_guesses, word_progress)
       VALUES (?, '', '', '', ?)`,
      [lobbyId, '_ '.repeat(word.length).trim()]
    );

    console.log(`✅ Lobby erstellt: ${lobbyCode} (ID: ${lobbyId})`);

    return {
      success: true,
      lobby: {
        id: lobbyId,
        code: lobbyCode,
        word: word,
        status: 'waiting'
      },
      player: {
        id: playerId,
        name: hostName,
        isHost: true,
        turnOrder: 0
      }
    };
  } catch (error) {
    console.error('Fehler beim Erstellen der Lobby:', error);
    throw error;
  }
}

// Lobby beitreten
export async function joinLobby(lobbyCode, playerName, sessionId) {
  try {
    const lobby = await queryOne(
      'SELECT * FROM lobbies WHERE lobby_code = ?',
      [lobbyCode]
    );

    if (!lobby) {
      return { success: false, error: 'Lobby nicht gefunden' };
    }

    if (lobby.status !== 'waiting') {
      return { success: false, error: 'Spiel läuft bereits' };
    }

    // Fix: Prüfe ob Spielername bereits in der Lobby existiert
    const existingPlayer = await queryOne(
      'SELECT * FROM players WHERE lobby_id = ? AND player_name = ? AND is_connected = TRUE',
      [lobby.id, playerName]
    );

    if (existingPlayer) {
      return { success: false, error: 'Name bereits in Verwendung. Bitte wähle einen anderen Namen.' };
    }

    const playerCount = await query(
      'SELECT COUNT(*) as count FROM players WHERE lobby_id = ? AND is_connected = TRUE',
      [lobby.id]
    );

    const turnOrder = playerCount[0].count;
    const playerId = uuidv4();

    await query(
      `INSERT INTO players (id, lobby_id, player_name, session_id, turn_order, is_host, is_connected)
       VALUES (?, ?, ?, ?, ?, FALSE, TRUE)`,
      [playerId, lobby.id, playerName, sessionId, turnOrder]
    );

    console.log(`✅ Spieler "${playerName}" ist Lobby ${lobbyCode} beigetreten`);

    return {
      success: true,
      lobby: {
        id: lobby.id,
        code: lobby.lobby_code,
        word: lobby.word,
        status: lobby.status
      },
      player: {
        id: playerId,
        name: playerName,
        isHost: false,
        turnOrder: turnOrder
      }
    };
  } catch (error) {
    console.error('Fehler beim Beitreten der Lobby:', error);
    throw error;
  }
}

// Hole Lobby-Details
export async function getLobby(lobbyId) {
  try {
    const lobby = await queryOne(
      'SELECT * FROM lobbies WHERE id = ?',
      [lobbyId]
    );

    if (!lobby) {
      return null;
    }

    const players = await query(
      'SELECT id, player_name, turn_order, is_host, is_connected FROM players WHERE lobby_id = ? AND is_connected = TRUE ORDER BY turn_order',
      [lobbyId]
    );

    const gameState = await queryOne(
      'SELECT * FROM game_state WHERE lobby_id = ?',
      [lobbyId]
    );

    return {
      id: lobby.id,
      code: lobby.lobby_code,
      word: lobby.word,
      status: lobby.status,
      currentTurnIndex: lobby.current_turn_index,
      attemptsLeft: lobby.attempts_left,
      players: players,
      gameState: gameState
    };
  } catch (error) {
    console.error('Fehler beim Abrufen der Lobby:', error);
    throw error;
  }
}

// Starte Spiel
export async function startGame(lobbyId, maxAttempts = 8) {
  try {
    await query(
      `UPDATE lobbies SET status = 'playing', started_at = NOW(), attempts_left = ?, max_attempts = ? WHERE id = ?`,
      [maxAttempts, maxAttempts, lobbyId]
    );

    console.log(`🎮 Spiel in Lobby ${lobbyId} gestartet mit ${maxAttempts} Versuchen`);
    return { success: true };
  } catch (error) {
    console.error('Fehler beim Starten des Spiels:', error);
    throw error;
  }
}

// Entferne Spieler aus Lobby
export async function removePlayer(playerId) {
  try {
    // Get player info before deletion
    const player = await queryOne(
      'SELECT * FROM players WHERE id = ?',
      [playerId]
    );

    if (!player) {
      console.log(`ℹ️ Spieler ${playerId} bereits entfernt`);
      return { success: true };
    }

    const lobbyId = player.lobby_id;
    const removedTurnOrder = player.turn_order;

    // Delete the player
    await query(
      'DELETE FROM players WHERE id = ?',
      [playerId]
    );

    // Get remaining players in this lobby
    const remainingPlayers = await query(
      'SELECT * FROM players WHERE lobby_id = ? ORDER BY turn_order',
      [lobbyId]
    );

    // If there are remaining players, rebalance turn orders
    if (remainingPlayers.length > 0) {
      // Reassign turn orders sequentially (0, 1, 2, ...)
      for (let i = 0; i < remainingPlayers.length; i++) {
        await query(
          'UPDATE players SET turn_order = ? WHERE id = ?',
          [i, remainingPlayers[i].id]
        );
      }

      // Get current lobby state
      const lobby = await queryOne(
        'SELECT * FROM lobbies WHERE id = ?',
        [lobbyId]
      );

      if (lobby) {
        let newTurnIndex = lobby.current_turn_index;

        // If the removed player was before or at the current turn, adjust the index
        if (removedTurnOrder <= lobby.current_turn_index) {
          newTurnIndex = Math.max(0, lobby.current_turn_index - 1);
        }

        // Make sure the turn index doesn't exceed the number of remaining players
        if (newTurnIndex >= remainingPlayers.length) {
          newTurnIndex = 0;
        }

        // Update the lobby's current turn index
        await query(
          'UPDATE lobbies SET current_turn_index = ? WHERE id = ?',
          [newTurnIndex, lobbyId]
        );

        console.log(`🔄 Turn index angepasst: ${lobby.current_turn_index} -> ${newTurnIndex} (${remainingPlayers.length} Spieler übrig)`);
      }
    }

    console.log(`👋 Spieler ${playerId} hat die Lobby verlassen`);
    return { success: true };
  } catch (error) {
    console.error('Fehler beim Entfernen des Spielers:', error);
    throw error;
  }
}

// Hole Spieler nach Session-ID
export async function getPlayerBySession(sessionId) {
  try {
    const player = await queryOne(
      `SELECT p.*, l.lobby_code
       FROM players p
       JOIN lobbies l ON p.lobby_id = l.id
       WHERE p.session_id = ? AND p.is_connected = TRUE`,
      [sessionId]
    );
    return player;
  } catch (error) {
    console.error('Fehler beim Abrufen des Spielers:', error);
    throw error;
  }
}

/* 🧹 NEU: Lobby vollständig löschen */
export async function deleteLobby(lobbyId) {
  try {
    // Lösche zuerst Chat-Nachrichten (vermeidet FK-Fehler), dann Spieler, game_state und zuletzt die Lobby
    await query('DELETE FROM chat_messages WHERE lobby_id = ?', [lobbyId]);
    await query('DELETE FROM players WHERE lobby_id = ?', [lobbyId]);
    await query('DELETE FROM game_state WHERE lobby_id = ?', [lobbyId]);
    await query('DELETE FROM lobbies WHERE id = ?', [lobbyId]);

    console.log(`🗑️ Lobby ${lobbyId} und zugehörige Daten gelöscht`);
    return { success: true };
  } catch (error) {
    console.error('Fehler beim Löschen der Lobby:', error);
    throw error;
  }
}

/* 🧹 Cleanup: Lösche alte/inaktive Lobbies */
export async function cleanupStaleLobbies(hoursInactive = 24) {
  try {
    // Find lobbies that haven't been updated in X hours
    const staleLobbies = await query(
      `SELECT id, lobby_code, status, 
              TIMESTAMPDIFF(HOUR, created_at, NOW()) as hours_inactive
       FROM lobbies 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [hoursInactive]
    );

    let deletedCount = 0;
    for (const lobby of staleLobbies) {
      try {
        await deleteLobby(lobby.id);
        deletedCount++;
        console.log(`🗑️ Gelöscht: Lobby ${lobby.lobby_code} (inaktiv seit ${lobby.hours_inactive}h)`);
      } catch (error) {
        console.error(`Fehler beim Löschen von Lobby ${lobby.id}:`, error);
      }
    }

    console.log(`🧹 Lobby-Cleanup abgeschlossen: ${deletedCount} von ${staleLobbies.length} Lobbies gelöscht`);
    return { success: true, deleted: deletedCount, total: staleLobbies.length };
  } catch (error) {
    console.error('Fehler beim Lobby-Cleanup:', error);
    throw error;
  }
}

// (Removed socket event handlers — service layer must not reference socket/io)
