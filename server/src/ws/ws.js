import { WebSocketServer } from "ws";
import * as repo from "../repo/memoryRepo.js";
import { publicView } from "../game/engine.js";

export function attachWs(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const rooms = new Map(); // gameId -> Set(ws)

  function join(gameId, ws) {
    if (!rooms.has(gameId)) rooms.set(gameId, new Set());
    rooms.get(gameId).add(ws);
    ws.on("close", () => rooms.get(gameId)?.delete(ws));
  }

  function broadcast(gameId, message) {
    const room = rooms.get(gameId);
    if (!room) return;
    const data = JSON.stringify(message);
    for (const client of room) if (client.readyState === 1) client.send(data);
  }

  wss.on("connection", (ws) => {
    ws.on("message", async (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        if (msg.type === "join") {
          join(msg.gameId, ws);
          const g = await repo.get(msg.gameId);
          if (g) ws.send(JSON.stringify({ type: "state", payload: publicView(g) }));
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: "error", payload: "bad message" }));
      }
    });
  });

  return { broadcast };
}
