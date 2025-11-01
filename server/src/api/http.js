import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startGame, applyGuess, publicView, GameStatus } from "../game/engine.js";
import * as repo from "../repo/memoryRepo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const words = fs.readFileSync(path.join(__dirname, "..", "game", "words.txt"), "utf-8")
  .split(/\r?\n/).filter(Boolean);

export function buildHttpApp({ broadcast }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_, res) => res.json({ ok: true, status: "up" }));

  app.post("/games", async (_, res) => {
    const word = words[Math.floor(Math.random() * words.length)];
    const view = startGame({ word, lives: 6 });
    await repo.create({ ...view, word }); // speichere internes Wort dazu
    res.status(201).json(view);
  });

  app.get("/games/:id", async (req, res) => {
    const g = await repo.get(req.params.id);
    if (!g) return res.status(404).json({ error: "not found" });
    res.json(publicView(g));
  });

  app.post("/games/:id/guess", async (req, res) => {
    const { letter } = req.body || {};
    const current = await repo.get(req.params.id);
    if (!current) return res.status(404).json({ error: "not found" });

    const { game, changed } = applyGuess(current, letter);
    await repo.put(game);

    const view = publicView(game);
    if (changed) broadcast(req.params.id, { type: "state", payload: view });

    res.json(view);
  });

  return app;
}
