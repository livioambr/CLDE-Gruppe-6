import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLobby, joinLobby, getLobby } from '../services/lobby-service.js';

const router = express.Router();

// POST /api/lobby/create - Neue Lobby erstellen
router.post('/create', async (req, res) => {
  try {
    const { playerName } = req.body;

    if (!playerName || playerName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Spielername erforderlich'
      });
    }

    // Generiere Session-ID
    const sessionId = uuidv4();

    const result = await createLobby(playerName.trim(), sessionId);

    res.json({
      success: true,
      lobby: result.lobby,
      player: result.player,
      sessionId
    });
  } catch (error) {
    console.error('Fehler beim Erstellen der Lobby:', error);
    res.status(500).json({
      success: false,
      error: 'Serverfehler beim Erstellen der Lobby'
    });
  }
});

// POST /api/lobby/join - Lobby beitreten
router.post('/join', async (req, res) => {
  try {
    const { lobbyCode, playerName } = req.body;

    if (!lobbyCode || !playerName || playerName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lobby-Code und Spielername erforderlich'
      });
    }

    // Generiere Session-ID
    const sessionId = uuidv4();

    const result = await joinLobby(lobbyCode.toUpperCase(), playerName.trim(), sessionId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      lobby: result.lobby,
      player: result.player,
      sessionId
    });
  } catch (error) {
    console.error('Fehler beim Beitreten der Lobby:', error);
    res.status(500).json({
      success: false,
      error: 'Serverfehler beim Beitreten der Lobby'
    });
  }
});

// GET /api/lobby/:id - Lobby-Details abrufen
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lobby = await getLobby(id);

    if (!lobby) {
      return res.status(404).json({
        success: false,
        error: 'Lobby nicht gefunden'
      });
    }

    res.json({
      success: true,
      lobby
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Lobby:', error);
    res.status(500).json({
      success: false,
      error: 'Serverfehler beim Abrufen der Lobby'
    });
  }
});

export default router;
