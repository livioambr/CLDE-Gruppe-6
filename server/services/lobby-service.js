import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/connection.js';

// Generiere 6-stelligen Lobby-Code
function generateLobbyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ohne ähnliche Zeichen
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
  return word ? word.word : 'HANGMAN'; // Fallback
}

// Erstelle neue Lobby
export async function createLobby(hostName, sessionId) {
  const lobbyId = uuidv4();
  const lobbyCode = generateLobbyCode();
  const playerId = uuidv4();
  const word = await getRandomWord();

  try {
    // Erstelle Lobby
    await query(
      `INSERT INTO lobbies (id, lobby_code, host_player_id, word, status, current_turn_index, attempts_left)
       VALUES (?, ?, ?, ?, 'waiting', 0, 6)`,
      [lobbyId, lobbyCode, playerId, word]
    );

    // Füge Host als ersten Spieler hinzu
    await query(
      `INSERT INTO players (id, lobby_id, player_name, session_id, turn_order, is_host, is_connected)
       VALUES (?, ?, ?, ?, 0, TRUE, TRUE)`,
      [playerId, lobbyId, hostName, sessionId]
    );

    // Initialisiere Game State
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
    // Finde Lobby
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

    // Zähle aktuelle Spieler
    const playerCount = await query(
      'SELECT COUNT(*) as count FROM players WHERE lobby_id = ? AND is_connected = TRUE',
      [lobby.id]
    );

    const turnOrder = playerCount[0].count;
    const playerId = uuidv4();

    // Füge Spieler hinzu
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

    // Hole alle Spieler
    const players = await query(
      'SELECT id, player_name, turn_order, is_host, is_connected FROM players WHERE lobby_id = ? ORDER BY turn_order',
      [lobbyId]
    );

    // Hole Game State
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
export async function startGame(lobbyId) {
  try {
    await query(
      `UPDATE lobbies SET status = 'playing', started_at = NOW() WHERE id = ?`,
      [lobbyId]
    );

    console.log(`🎮 Spiel in Lobby ${lobbyId} gestartet`);
    return { success: true };
  } catch (error) {
    console.error('Fehler beim Starten des Spiels:', error);
    throw error;
  }
}

// Entferne Spieler aus Lobby
export async function removePlayer(playerId) {
  try {
    await query(
      'UPDATE players SET is_connected = FALSE WHERE id = ?',
      [playerId]
    );

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
