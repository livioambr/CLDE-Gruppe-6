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

    // Nächster Spieler
    const playerCount = await query(
      'SELECT COUNT(*) as count FROM players WHERE lobby_id = ? AND is_connected = TRUE',
     [lobbyId]
    );
    const totalPlayers = playerCount[0].count;

    // Wenn kein Spieler mehr vorhanden ist (Lobby evtl. geschlossen), return
    if (totalPlayers === 0) {
      return { success: false, error: 'Keine Spieler in der Lobby' };
    }

    const nextTurnIndex = (lobby.current_turn_index + 1) % totalPlayers;


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

    return {
      lobbyCode: lobby.lobby_code,
      status: lobby.status,
      word: lobby.word,
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
    // Hole neues Wort
    const wordResult = await queryOne(
      'SELECT word FROM words ORDER BY RAND() LIMIT 1'
    );
    const newWord = wordResult ? wordResult.word : 'HANGMAN';

    // Reset Lobby
    await query(
      `UPDATE lobbies
       SET word = ?, status = 'waiting', current_turn_index = 0, attempts_left = 6,
           started_at = NULL, finished_at = NULL
       WHERE id = ?`,
      [newWord, lobbyId]
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
