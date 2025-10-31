// Lobby System - REST API Integration

const API_BASE = window.location.origin + '/api';

// DOM Elemente
const playerNameInput = document.getElementById('playerName');
const sessionCodeInput = document.getElementById('sessionCode');
const createSessionBtn = document.getElementById('createSessionBtn');
const joinSessionBtn = document.getElementById('joinSessionBtn');
const lobbyMessage = document.getElementById('lobbyMessage');
const loading = document.getElementById('loading');

// Session erstellen
createSessionBtn.addEventListener('click', async () => {
  const playerName = playerNameInput.value.trim();

  if (!playerName) {
    showMessage('Bitte gib einen Spielernamen ein.', 'error');
    return;
  }

  if (playerName.length < 2) {
    showMessage('Spielername muss mindestens 2 Zeichen lang sein.', 'error');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/lobby/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ playerName })
    });

    const data = await response.json();

    if (data.success) {
      // Speichere Session-Daten in sessionStorage
      sessionStorage.setItem('playerId', data.player.id);
      sessionStorage.setItem('playerName', data.player.name);
      sessionStorage.setItem('lobbyId', data.lobby.id);
      sessionStorage.setItem('lobbyCode', data.lobby.code);
      sessionStorage.setItem('sessionId', data.sessionId);
      sessionStorage.setItem('isHost', data.player.isHost);

      showMessage(`Session erstellt! Code: ${data.lobby.code}`, 'success');

      // Weiterleitung nach kurzer Verzögerung
      setTimeout(() => {
        window.location.href = 'game.html';
      }, 1500);
    } else {
      showMessage(data.error || 'Fehler beim Erstellen der Session', 'error');
    }
  } catch (error) {
    console.error('Fehler beim Erstellen:', error);
    showMessage('Verbindung zum Server fehlgeschlagen. Ist der Server gestartet?', 'error');
  } finally {
    setLoading(false);
  }
});

// Session beitreten
joinSessionBtn.addEventListener('click', async () => {
  const playerName = playerNameInput.value.trim();
  const lobbyCode = sessionCodeInput.value.trim().toUpperCase();

  if (!playerName) {
    showMessage('Bitte gib einen Spielernamen ein.', 'error');
    return;
  }

  if (playerName.length < 2) {
    showMessage('Spielername muss mindestens 2 Zeichen lang sein.', 'error');
    return;
  }

  if (!lobbyCode || lobbyCode.length !== 6) {
    showMessage('Bitte gib einen gültigen 6-stelligen Code ein.', 'error');
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/lobby/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ playerName, lobbyCode })
    });

    const data = await response.json();

    if (data.success) {
      // Speichere Session-Daten
      sessionStorage.setItem('playerId', data.player.id);
      sessionStorage.setItem('playerName', data.player.name);
      sessionStorage.setItem('lobbyId', data.lobby.id);
      sessionStorage.setItem('lobbyCode', data.lobby.code);
      sessionStorage.setItem('sessionId', data.sessionId);
      sessionStorage.setItem('isHost', data.player.isHost);

      showMessage(`Beigetreten! Code: ${data.lobby.code}`, 'success');

      // Weiterleitung nach kurzer Verzögerung
      setTimeout(() => {
        window.location.href = 'game.html';
      }, 1500);
    } else {
      showMessage(data.error || 'Fehler beim Beitreten', 'error');
    }
  } catch (error) {
    console.error('Fehler beim Beitreten:', error);
    showMessage('Verbindung zum Server fehlgeschlagen. Ist der Server gestartet?', 'error');
  } finally {
    setLoading(false);
  }
});

// Helper: Nachricht anzeigen
function showMessage(msg, type = 'info') {
  lobbyMessage.textContent = msg;
  lobbyMessage.className = `message ${type}`;
  lobbyMessage.style.display = 'block';

  // Nach 5 Sekunden ausblenden (außer bei success)
  if (type !== 'success') {
    setTimeout(() => {
      lobbyMessage.style.display = 'none';
    }, 5000);
  }
}

// Helper: Loading-Zustand
function setLoading(isLoading) {
  loading.style.display = isLoading ? 'block' : 'none';
  createSessionBtn.disabled = isLoading;
  joinSessionBtn.disabled = isLoading;
  playerNameInput.disabled = isLoading;
  sessionCodeInput.disabled = isLoading;
}

// Auto-uppercase für Session-Code
sessionCodeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

// Enter-Taste Handler
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    createSessionBtn.click();
  }
});

sessionCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinSessionBtn.click();
  }
});

// Prüfe ob bereits eine Session vorhanden ist
window.addEventListener('DOMContentLoaded', () => {
  const existingLobbyId = sessionStorage.getItem('lobbyId');
  const existingPlayerName = sessionStorage.getItem('playerName');

  if (existingLobbyId && existingPlayerName) {
    showMessage(
      `Du bist bereits in einer Session als "${existingPlayerName}". Möchtest du fortfahren?`,
      'info'
    );

    // Button hinzufügen um zurückzukehren
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Zur Session zurückkehren';
    continueBtn.className = 'btn btn-secondary';
    continueBtn.style.marginTop = '10px';
    continueBtn.onclick = () => {
      window.location.href = 'game.html';
    };

    lobbyMessage.appendChild(document.createElement('br'));
    lobbyMessage.appendChild(continueBtn);
  }
});

console.log('🎮 Lobby System geladen');
console.log('🔗 API Basis-URL:', API_BASE);
