const createSessionBtn = document.getElementById("createSessionBtn");
const joinSessionBtn = document.getElementById("joinSessionBtn");
const playerNameInput = document.getElementById("playerName");
const sessionCodeInput = document.getElementById("sessionCode");
const lobbyMessage = document.getElementById("lobbyMessage");

// Platzhalter für AWS REST API
const API_BASE = "https://example.execute-api.eu-central-1.amazonaws.com/prod";

createSessionBtn.addEventListener("click", async () => {
  const name = playerNameInput.value.trim();
  if (!name) return showMessage("Bitte gib einen Namen ein.");

  // Hier wird später AWS API aufgerufen
  console.log("Session erstellen:", name);

  // Mock: SessionID speichern
  sessionStorage.setItem("playerName", name);
  sessionStorage.setItem("sessionId", "ABC123");
  window.location.href = "game.html";
});

joinSessionBtn.addEventListener("click", async () => {
  const name = playerNameInput.value.trim();
  const code = sessionCodeInput.value.trim();
  if (!name || !code) return showMessage("Bitte Name und Session-Code eingeben.");

  // Hier wird später AWS API aufgerufen
  console.log("Session beitreten:", code, name);

  sessionStorage.setItem("playerName", name);
  sessionStorage.setItem("sessionId", code);
  window.location.href = "game.html";
});

function showMessage(msg) {
  lobbyMessage.textContent = msg;
}
