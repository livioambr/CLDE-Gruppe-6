import { WebSocketServer } from "ws";
import * as repo from "../repo/memoryRepo.js";
import { publicView } from "../game/engine.js";

export function attachWs(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Räume + Presence
  const rooms = new Map();             // gameId -> Set(ws)
  const meta  = new WeakMap();         // ws -> { gameId, user }

  function join(gameId, ws, user = "Player") {
    if (!rooms.has(gameId)) rooms.set(gameId, new Set());
    rooms.get(gameId).add(ws);
    meta.set(ws, { gameId, user });
    ws.on("close", () => {
      rooms.get(gameId)?.delete(ws);
      broadcastPlayers(gameId);
    });
  }

  function broadcast(gameId, message) {
    const room = rooms.get(gameId);
    if (!room) return;
    const data = JSON.stringify(message);
    for (const client of room) if (client.readyState === 1) client.send(data);
  }

  function broadcastPlayers(gameId) {
    const room = rooms.get(gameId);
    if (!room) return;
    const players = [...room]
      .map(ws => meta.get(ws)?.user || "Player")
      .filter(Boolean);
    broadcast(gameId, { type: "players", payload: { gameId, players, count: players.length } });
  }

  wss.on("connection", (ws) => {
    ws.on("message", async (buf) => {
      try {
        const msg = JSON.parse(buf.toString());

        if (msg.type === "join") {
          const gameId = String(msg.gameId || "");
          const user   = String(msg.user || "Player").slice(0, 32);
          join(gameId, ws, user);

          // initialen State an den neuen Client
          const g = await repo.get(gameId);
          if (g) ws.send(JSON.stringify({ type: "state", payload: publicView(g) }));

          // Presence an alle
          broadcastPlayers(gameId);

        } else if (msg.type === "chat") {
          const text   = String(msg.text || "").trim();
          const gameId = String(msg.gameId || "");
          const user   = String(msg.user || "Player").slice(0, 32);
          if (!text || !gameId) return;
          broadcast(gameId, { type: "chat", payload: { gameId, user, text, ts: new Date().toISOString() } });
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", payload: "bad message" }));
      }
    });
  });

  return { broadcast };
}
