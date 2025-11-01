import { apiCreateGame, apiGetGame } from "./socket-client.js";

const $ = (s) => document.querySelector(s);

const playerNameInput = $("#playerName");
const createBtn       = $("#createSessionBtn");
const joinBtn         = $("#joinSessionBtn");
const codeInput       = $("#sessionCode");
const msg             = $("#lobbyMessage");
const loading         = $("#loading");

function setLoading(on) {
  if (loading) loading.style.display = on ? "block" : "none";
  if (createBtn) createBtn.disabled = on;
  if (joinBtn)   joinBtn.disabled   = on;
}

function goGame(gameId, name) {
  const p = new URLSearchParams({ gameId, name });
  // Auf die Spielseite wechseln und gameId/playerName übergeben
  window.location.href = `./game.html?${p.toString()}`;
}

createBtn?.addEventListener("click", async () => {
  const name = (playerNameInput?.value || "").trim() || "Player";
  setLoading(true);
  if (msg) { msg.className = "message info"; msg.textContent = "Erstelle Spiel..."; }
  try {
    const game = await apiCreateGame();   // POST /games
    goGame(game.id, name);
  } catch {
    if (msg) { msg.className = "message error"; msg.textContent = "Erstellen fehlgeschlagen."; }
  } finally { setLoading(false); }
});

joinBtn?.addEventListener("click", async () => {
  const name = (playerNameInput?.value || "").trim() || "Player";
  const id   = (codeInput?.value || "").trim();
  if (!id) {
    if (msg) { msg.className = "message error"; msg.textContent = "Bitte Session-ID eingeben."; }
    return;
  }
  setLoading(true);
  if (msg) { msg.className = "message info"; msg.textContent = "Prüfe Session..."; }
  try {
    await apiGetGame(id);                 // GET /games/:id
    goGame(id, name);
  } catch {
    if (msg) { msg.className = "message error"; msg.textContent = "Session nicht gefunden."; }
  } finally { setLoading(false); }
});
