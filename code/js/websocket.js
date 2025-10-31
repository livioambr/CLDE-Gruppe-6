let socket;
let sessionId = sessionStorage.getItem("sessionId");
let playerName = sessionStorage.getItem("playerName");

export function initWebSocket(onMessage) {
  const wsUrl = "wss://example.execute-api.eu-central-1.amazonaws.com/prod"; // AWS WebSocket

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("✅ WebSocket verbunden");
    socket.send(JSON.stringify({ action: "join", sessionId, playerName }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  socket.onclose = () => console.log("❌ Verbindung geschlossen");
  socket.onerror = (err) => console.error("WebSocket-Fehler:", err);
}

export function sendAction(action, payload = {}) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ action, ...payload }));
  }
}
