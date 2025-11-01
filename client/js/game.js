import { connectGameWS, apiGetGame, apiGuess } from "./socket-client.js";

const $ = (s) => document.querySelector(s);

// vorhandene Elemente
const wordDisplay      = $("#wordDisplay");
const attemptsLeft     = $("#attemptsLeft");
const lettersGrid      = $("#lettersGrid");
const gameMessage      = $("#gameMessage");
const lobbyCodeDisp    = $("#lobbyCodeDisplay");
const currentPlayerEl  = $("#currentPlayerName");

// Chat
const chatForm     = $("#chatForm");
const chatInput    = $("#chatInput");
const chatMessages = $("#chatMessages");

// Spieler-Liste (Container <div id="playersList">)
const playersList  = $("#playersList");

// Query-Parameter
const params = new URLSearchParams(location.search);
const gameId = params.get("gameId");
const playerName = params.get("name") || "Player";

let ws;
let currentState = null;

function renderPlayers(players = []) {
  // 1) „Aktueller Spieler:“ -> wir zeigen ALLE (Komma-separiert) an
  if (currentPlayerEl) {
    if (players.length > 0) {
      currentPlayerEl.textContent = players.join(", ");
    } else {
      currentPlayerEl.textContent = "Warte auf Spieler...";
    }
  }

  // 2) Rechte Spalte: Liste/Kacheln
  if (playersList) {
    playersList.innerHTML = "";
    players.forEach((p) => {
      const row = document.createElement("div");
      row.className = "chat-message"; // passt in deinen Stil
      row.innerHTML = `
        <div class="message-header">
          <span class="message-user">${p}</span>
        </div>
      `;
      playersList.appendChild(row);
    });
  }
}

function buildKeyboard() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ".split("");
  lettersGrid.innerHTML = "";
  letters.forEach((ch) => {
    const b = document.createElement("button");
    b.className = "letter-btn";
    b.dataset.letter = ch;
    b.textContent = ch;
    b.addEventListener("click", () => sendGuess(ch));
    lettersGrid.appendChild(b);
  });
}

function renderState(state) {
  currentState = state;

  if (lobbyCodeDisp) lobbyCodeDisp.textContent = `CODE: ${gameId}`;
  if (wordDisplay)   wordDisplay.textContent   = (state.maskedWord || "").split("").join(" ");
  if (attemptsLeft)  attemptsLeft.textContent  = state.livesLeft ?? "-";

  if (gameMessage) {
    if (state.status === "WON")      { gameMessage.className = "game-message win";  gameMessage.textContent = "🎉 Gewonnen!"; }
    else if (state.status === "LOST"){ gameMessage.className = "game-message lose"; gameMessage.textContent = "💀 Verloren!"; }
    else                             { gameMessage.className = "game-message";      gameMessage.textContent = ""; }
  }

  for (const btn of lettersGrid.querySelectorAll("button.letter-btn")) {
    const letter = btn.dataset.letter;
    const guessed = state.guessed?.includes(letter);
    btn.disabled = state.status !== "IN_PROGRESS" || guessed;
    btn.classList.toggle("correct", guessed && state.maskedWord?.includes(letter));
    btn.classList.toggle("wrong",   guessed && !state.maskedWord?.includes(letter));
  }

  if (initialLives == null && typeof state.livesLeft === "number") {
    initialLives = state.livesLeft;
  }

  const mistakes = Math.max(0, (initialLives ?? 6) - (state.livesLeft ?? (initialLives ?? 6)));
  drawHangman(mistakes);

}

function appendChat({ user, text, ts }) {
  if (!chatMessages) return;
  const el = document.createElement("div");
  el.className = "chat-message";
  const time = ts ? new Date(ts).toLocaleTimeString() : "";
  el.innerHTML = `
    <div class="message-header">
      <span class="message-user">${user || "Player"}</span>
      <span class="message-time">${time}</span>
    </div>
    <div class="message-text">${text}</div>
  `;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function bootstrap() {
  if (!gameId) {
    if (gameMessage) gameMessage.textContent = "Keine Session-ID übergeben.";
    return;
  }

  buildKeyboard();
  fitCanvas(canvas);
  clearCanvas();
  drawGallows();


  // Initialen State laden
  try {
    const view = await apiGetGame(gameId);
    renderState(view);
  } catch {
    if (gameMessage) gameMessage.textContent = "Spiel nicht gefunden.";
    return;
  }

  // WS verbinden: wir geben den aktuellen Spielernamen mit
  ws = connectGameWS(gameId, {
    user: playerName,
    onState: (view) => renderState(view),
    onChat:  (msg)  => appendChat(msg),
    onPlayers: ({ players }) => {
      renderPlayers(players);
    }
  });

  // Chat-Submit -> Redirect verhindern + senden
  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      ws?.send({ type: "chat", gameId, user: playerName, text });
      chatInput.value = "";
    });
  }
}

async function sendGuess(letter) {
  if (!currentState || currentState.status !== "IN_PROGRESS") return;
  try {
    const view = await apiGuess(gameId, letter);
    renderState(view);
  } catch (e) {
    console.error("guess failed", e);
  }
}

// --- Canvas Setup ---
const canvas = document.getElementById("hangmanCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

// Für sauberes Rendering auf High-DPI
function fitCanvas(cnv) {
  if (!cnv) return;
  const ratio = window.devicePixelRatio || 1;
  const displayWidth  = cnv.clientWidth  || cnv.width;
  const displayHeight = cnv.clientHeight || cnv.height;
  cnv.width  = Math.floor(displayWidth  * ratio);
  cnv.height = Math.floor(displayHeight * ratio);
  const context = cnv.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function clearCanvas() {
  if (!ctx || !canvas) return;
  // Hintergrund „hellgrau“ (wie dein Feld)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // optional: leichter Hintergrund
  // ctx.fillStyle = "#f6f7f8";
  // ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Einzelteile des Hangman
function drawGallows() {
  if (!ctx) return;
  const w = canvas.clientWidth || 640;
  const h = canvas.clientHeight || 420;
  // Koordinaten relativ definieren
  const baseY = h - 20, leftX = 60, topY = 40, beamX = 220;

  ctx.lineWidth = 6;
  ctx.strokeStyle = "#7a1f53";

  // Boden
  ctx.beginPath();
  ctx.moveTo(20, baseY); ctx.lineTo(w - 20, baseY); ctx.stroke();

  // Pfosten
  ctx.beginPath();
  ctx.moveTo(leftX, baseY); ctx.lineTo(leftX, topY); ctx.stroke();

  // Querbalken
  ctx.beginPath();
  ctx.moveTo(leftX, topY); ctx.lineTo(beamX, topY); ctx.stroke();

  // Seil
  ctx.beginPath();
  ctx.moveTo(beamX, topY); ctx.lineTo(beamX, topY + 40); ctx.stroke();
}

function drawHead() {
  if (!ctx) return;
  const beamX = 220, topY = 40;
  ctx.beginPath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#333";
  ctx.arc(beamX, topY + 70, 30, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBody() {
  if (!ctx) return;
  const beamX = 220, topY = 40;
  ctx.beginPath();
  ctx.moveTo(beamX, topY + 100);
  ctx.lineTo(beamX, topY + 180);
  ctx.stroke();
}

function drawLeftArm() {
  if (!ctx) return;
  const beamX = 220, topY = 40;
  ctx.beginPath();
  ctx.moveTo(beamX, topY + 120);
  ctx.lineTo(beamX - 40, topY + 150);
  ctx.stroke();
}

function drawRightArm() {
  if (!ctx) return;
  const beamX = 220, topY = 40;
  ctx.beginPath();
  ctx.moveTo(beamX, topY + 120);
  ctx.lineTo(beamX + 40, topY + 150);
  ctx.stroke();
}

function drawLeftLeg() {
  if (!ctx) return;
  const beamX = 220, topY = 40;
  ctx.beginPath();
  ctx.moveTo(beamX, topY + 180);
  ctx.lineTo(beamX - 35, topY + 230);
  ctx.stroke();
}

function drawRightLeg() {
  if (!ctx) return;
  const beamX = 220, topY = 40;
  ctx.beginPath();
  ctx.moveTo(beamX, topY + 180);
  ctx.lineTo(beamX + 35, topY + 230);
  ctx.stroke();
}

/**
 * Zeichnet abhängig von der Anzahl Fehler (mistakes) die Komponenten.
 * Standard: 6 Leben => 6 Fehlerstufen (0..6)
 * 0: nur Galgen, 1: Kopf, 2: Körper, 3: linker Arm, 4: rechter Arm, 5: linkes Bein, 6: rechtes Bein
 */
function drawHangman(mistakes) {
  if (!ctx || !canvas) return;
  fitCanvas(canvas);
  clearCanvas();
  drawGallows();

  if (mistakes >= 1) drawHead();
  if (mistakes >= 2) drawBody();
  if (mistakes >= 3) drawLeftArm();
  if (mistakes >= 4) drawRightArm();
  if (mistakes >= 5) drawLeftLeg();
  if (mistakes >= 6) drawRightLeg();
}


window.addEventListener("beforeunload", () => ws && ws.close());
bootstrap();
