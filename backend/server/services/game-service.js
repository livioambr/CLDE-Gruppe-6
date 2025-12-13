import { query, queryOne } from '../db/connection.js';

// Verarbeite Buchstaben-Rätsel
export async function guessLetter(lobbyId, playerId, letter) {
  try {
    // Hole Lobby und Game State
    const lobby = await queryOne(
      'SELECT * FROM lobbies WHERE id = ?',
      [lobbyId]
    );

    if (!lobby || lobby.status !== 'playing') {
      return { success: false, error: 'Spiel ist nicht aktiv' };
    }

    // Hole Spieler
    const player = await queryOne(
      'SELECT * FROM players WHERE id = ? AND lobby_id = ?',
      [playerId, lobbyId]
    );

    if (!player) {
      return { success: false, error: 'Spieler nicht gefunden' };
    }

    // Prüfe ob Spieler an der Reihe ist
    if (player.turn_order !== lobby.current_turn_index) {
      return { success: false, error: 'Du bist nicht an der Reihe' };
    }

    // Hole Game State
    const gameState = await queryOne(
      'SELECT * FROM game_state WHERE lobby_id = ?',
      [lobbyId]
    );

    // Prüfe ob Buchstabe bereits geraten wurde
    const guessedLetters = gameState.guessed_letters ? gameState.guessed_letters.split(',') : [];
    if (guessedLetters.includes(letter)) {
      return { success: false, error: 'Buchstabe wurde bereits geraten' };
    }

    // Füge Buchstabe zu geratenen Buchstaben hinzu
    guessedLetters.push(letter);

    // Prüfe ob Buchstabe im Wort vorkommt
    const word = lobby.word.toUpperCase();
    const isCorrect = word.includes(letter);

    let newAttemptsLeft = lobby.attempts_left;
    let incorrectGuesses = gameState.incorrect_guesses ? gameState.incorrect_guesses.split(',') : [];

    if (!isCorrect) {
      // Falscher Buchstabe
      newAttemptsLeft--;
      incorrectGuesses.push(letter);
    }

    // Aktualisiere Wort-Fortschritt
    const wordProgress = word
      .split('')
      .map(char => guessedLetters.includes(char) ? char : '_')
      .join(' ');

    // Prüfe Gewinn-/Verlustbedingung
    const hasWon = !wordProgress.includes('_');
    const hasLost = newAttemptsLeft <= 0;
    const newStatus = hasWon || hasLost ? 'finished' : 'playing';

    // Nächster Spieler - get all players to find the next valid one
    const allPlayers = await query(
      'SELECT * FROM players WHERE lobby_id = ? AND is_connected = TRUE ORDER BY turn_order',
      [lobbyId]
    );
    const totalPlayers = allPlayers.length;

    // Wenn kein Spieler mehr vorhanden ist (Lobby evtl. geschlossen), return
    if (totalPlayers === 0) {
      return { success: false, error: 'Keine Spieler in der Lobby' };
    }

    // Find next player by incrementing turn_order
    let nextTurnIndex = (lobby.current_turn_index + 1) % totalPlayers;
    
    // Ensure the next turn index is valid (a player with that turn_order exists)
    // This handles edge cases where turn orders might be inconsistent
    const nextPlayer = allPlayers.find(p => p.turn_order === nextTurnIndex);
    if (!nextPlayer && totalPlayers > 0) {
      // Fallback: use the first player if the calculated index doesn't exist
      nextTurnIndex = allPlayers[0].turn_order;
      console.log(`⚠️ Turn index ${nextTurnIndex} nicht gefunden, verwende ersten Spieler mit turn_order ${allPlayers[0].turn_order}`);
    }


    // Update Lobby
    await query(
      `UPDATE lobbies
       SET attempts_left = ?, current_turn_index = ?, status = ?, finished_at = IF(? = 'finished', NOW(), NULL)
       WHERE id = ?`,
      [newAttemptsLeft, nextTurnIndex, newStatus, newStatus, lobbyId]
    );

    // Update Game State
    await query(
      `UPDATE game_state
       SET guessed_letters = ?, incorrect_guesses = ?, word_progress = ?,
           last_guess_player_id = ?, last_guess_letter = ?, last_guess_correct = ?
       WHERE lobby_id = ?`,
      [
        guessedLetters.join(','),
        incorrectGuesses.join(','),
        wordProgress,
        playerId,
        letter,
        isCorrect,
        lobbyId
      ]
    );

    console.log(`🎲 Spieler ${player.player_name} rät "${letter}" - ${isCorrect ? 'Richtig ✅' : 'Falsch ❌'}`);

    return {
      success: true,
      isCorrect,
      letter,
      wordProgress,
      attemptsLeft: newAttemptsLeft,
      guessedLetters,
      incorrectGuesses,
      nextTurnIndex,
      hasWon,
      hasLost,
      word: hasWon || hasLost ? word : null
    };
  } catch (error) {
    console.error('Fehler beim Raten:', error);
    throw error;
  }
}

// Hole aktuellen Spielstatus
export async function getGameState(lobbyId) {
  try {
    const lobby = await queryOne(
      'SELECT * FROM lobbies WHERE id = ?',
      [lobbyId]
    );

    if (!lobby) {
      return null;
    }

    const gameState = await queryOne(
      'SELECT * FROM game_state WHERE lobby_id = ?',
      [lobbyId]
    );

    const players = await query(
      'SELECT id, player_name, turn_order, is_host, is_connected FROM players WHERE lobby_id = ? ORDER BY turn_order',
      [lobbyId]
    );

    const guessedLetters = gameState.guessed_letters ? gameState.guessed_letters.split(',') : [];
    const incorrectGuesses = gameState.incorrect_guesses ? gameState.incorrect_guesses.split(',') : [];

    // Determine if word should be revealed (only when game is finished and lost)
    const hasLost = lobby.status === 'finished' && lobby.attempts_left <= 0;
    const hasWon = lobby.status === 'finished' && !gameState.word_progress.includes('_');

    return {
      lobbyCode: lobby.lobby_code,
      status: lobby.status,
      word: (hasLost || hasWon) ? lobby.word : null, // Only reveal word when game is finished
      wordProgress: gameState.word_progress,
      guessedLetters,
      incorrectGuesses,
      attemptsLeft: lobby.attempts_left,
      maxAttempts: lobby.max_attempts,
      currentTurnIndex: lobby.current_turn_index,
      players,
      lastGuess: {
        playerId: gameState.last_guess_player_id,
        letter: gameState.last_guess_letter,
        correct: gameState.last_guess_correct
      }
    };
  } catch (error) {
    console.error('Fehler beim Abrufen des Game States:', error);
    throw error;
  }
}

// Reset Spiel für neue Runde
export async function resetGame(lobbyId) {
  try {
    // Hole aktuellen max_attempts Wert
    const currentLobby = await queryOne(
      'SELECT max_attempts FROM lobbies WHERE id = ?',
      [lobbyId]
    );
    const maxAttempts = currentLobby?.max_attempts || 8;

    // Hole neues Wort
    const wordResult = await queryOne(
      'SELECT word FROM words ORDER BY RAND() LIMIT 1'
    );
    const newWord = wordResult ? wordResult.word : 'HANGMAN';

    // Reset Lobby
    await query(
      `UPDATE lobbies
       SET word = ?, status = 'waiting', current_turn_index = 0, attempts_left = ?,
           started_at = NULL, finished_at = NULL
       WHERE id = ?`,
      [newWord, maxAttempts, lobbyId]
    );

    // Reset Game State
    await query(
      `UPDATE game_state
       SET guessed_letters = '', revealed_positions = '', incorrect_guesses = '',
           word_progress = ?, last_guess_player_id = NULL, last_guess_letter = NULL, last_guess_correct = NULL
       WHERE lobby_id = ?`,
      ['_ '.repeat(newWord.length).trim(), lobbyId]
    );

    console.log(`🔄 Spiel in Lobby ${lobbyId} wurde zurückgesetzt`);

    return { success: true, newWord };
  } catch (error) {
    console.error('Fehler beim Zurücksetzen des Spiels:', error);
    throw error;
  }
}
