import { query, queryOne } from '../db/connection.js';

// Sende Chat-Nachricht
export async function sendMessage(lobbyId, playerId, playerName, message, messageType = 'player') {
  try {
    await query(
      `INSERT INTO chat_messages (lobby_id, player_id, player_name, message, message_type)
       VALUES (?, ?, ?, ?, ?)`,
      [lobbyId, playerId, playerName, message, messageType]
    );

    console.log(`💬 ${playerName}: ${message}`);

    return {
      success: true,
      message: {
        playerId,
        playerName,
        message,
        messageType,
        timestamp: new Date()
      }
    };
  } catch (error) {
    console.error('Fehler beim Senden der Nachricht:', error);
    throw error;
  }
}

// Hole Chat-Historie
export async function getChatHistory(lobbyId, limit = 50) {
  try {
    const messages = await query(
      `SELECT player_id, player_name, message, message_type, timestamp
       FROM chat_messages
       WHERE lobby_id = ?
       ORDER BY timestamp DESC
       LIMIT ${parseInt(limit)}`,
      [lobbyId]
    );

    // Reihenfolge umkehren (älteste zuerst)
    return messages.reverse();
  } catch (error) {
    console.error('Fehler beim Abrufen der Chat-Historie:', error);
    throw error;
  }
}

// Sende System-Nachricht
export async function sendSystemMessage(lobbyId, message) {
  try {
    await query(
      `INSERT INTO chat_messages (lobby_id, player_id, player_name, message, message_type)
       VALUES (?, NULL, 'System', ?, 'system')`,
      [lobbyId, message]
    );

    console.log(`📢 System: ${message}`);

    return {
      success: true,
      message: {
        playerId: null,
        playerName: 'System',
        message,
        messageType: 'system',
        timestamp: new Date()
      }
    };
  } catch (error) {
    console.error('Fehler beim Senden der System-Nachricht:', error);
    throw error;
  }
}

// Lösche alte Nachrichten (Cleanup)
export async function cleanupOldMessages(daysOld = 7) {
  try {
    const result = await query(
      `DELETE FROM chat_messages WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [daysOld]
    );

    console.log(`🧹 ${result.affectedRows} alte Nachrichten gelöscht`);
    return { success: true, deleted: result.affectedRows };
  } catch (error) {
    console.error('Fehler beim Cleanup:', error);
    throw error;
  }
}
