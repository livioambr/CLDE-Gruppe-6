import http from "node:http";
import { buildHttpApp } from "./api/http.js";
import { attachWs } from "./ws/ws.js";

const PORT = process.env.PORT || 8080;

const httpServer = http.createServer(); // leeres Server-Objekt
const { broadcast } = attachWs(httpServer);
const app = buildHttpApp({ broadcast });

httpServer.on("request", app);
httpServer.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
