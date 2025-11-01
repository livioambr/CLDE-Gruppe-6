// ---- Auto-Detect der API/WS-URLs, mit optionalen Overrides via Query (?api= & ?ws= & ?apiPort=) ----
function qp(name) { return new URLSearchParams(location.search).get(name); }
const proto   = location.protocol === "https:" ? "https" : "http";
const wsProto = proto === "https" ? "wss" : "ws";
const host    = location.hostname || "localhost";
const port    = qp("apiPort") || "8080";

export const API_BASE = qp("api") || `${proto}://${host}:${port}`;
export const WS_BASE  = qp("ws")  || `${wsProto}://${host}:${port}/ws`;

// ---- WebSocket Helper ----
export function connectGameWS(gameId, { onOpen, onState, onChat, onPlayers, onError, onClose, user } = {}) {
  const ws = new WebSocket(WS_BASE);

  ws.addEventListener("open", () => {
    onOpen && onOpen();
    ws.send(JSON.stringify({ type: "join", gameId, user: user || "Player" })); // <-- user mitsenden
  });

  ws.addEventListener("message", (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === "state")   onState   && onState(msg.payload);
      else if (msg.type === "chat")    onChat    && onChat(msg.payload);
      else if (msg.type === "players") onPlayers && onPlayers(msg.payload);   // <-- neu
    } catch (e) { console.error("WS parse error", e); }
  });

  ws.addEventListener("error", (e) => onError && onError(e));
  ws.addEventListener("close", () => onClose && onClose());

  return {
    send(obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); },
    close() { ws.close(); }
  };
}

// ---- REST Helper (entspricht exakt deinem Server) ----
export async function apiCreateGame() {
  const r = await fetch(`${API_BASE}/games`, { method: "POST" });
  if (!r.ok) throw new Error("create failed");
  return r.json();
}

export async function apiGetGame(id) {
  const r = await fetch(`${API_BASE}/games/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error("not found");
  return r.json();
}

export async function apiGuess(id, letter) {
  const r = await fetch(`${API_BASE}/games/${encodeURIComponent(id)}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ letter })
  });
  if (!r.ok) throw new Error("guess failed");
  return r.json();
}
