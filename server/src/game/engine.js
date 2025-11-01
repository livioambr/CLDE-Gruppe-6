import crypto from "node:crypto";

export const GameStatus = { IN_PROGRESS: "IN_PROGRESS", WON: "WON", LOST: "LOST" };

// Feste Wortliste im Code
const words = [
  "JAVASCRIPT", "PROGRAMMIEREN", "COMPUTER", "INTERNET", "ENTWICKLER",
  "AMAZON", "CLOUD", "SERVER", "DATABASE", "SOFTWARE",
  "ALGORITHMUS", "FUNKTION", "VARIABLE", "SCHNITTSTELLE", "FRAMEWORK",
  "MICROSERVICE", "KUBERNETES", "CONTAINER", "DEPLOYMENT", "SICHERHEIT"
];

export function newId() {
  return crypto.randomUUID();
}

export function maskWord(word, guessed) {
  const g = new Set(guessed.map(c => c.toUpperCase()));
  return [...word]
    .map(ch => (/[A-ZÄÖÜ]/.test(ch) ? (g.has(ch) ? ch : "_") : ch))
    .join("");
}

// Neues Spiel starten → zufälliges Wort aus Liste
export function startGame({ lives = 6 } = {}) {
  const word = words[Math.floor(Math.random() * words.length)];
  const game = {
    id: newId(),
    word,
    guessed: [],
    livesLeft: lives,
    status: GameStatus.IN_PROGRESS,
    createdAt: new Date().toISOString()
  };
  return publicView(game);
}

// Buchstaben prüfen & Spielstatus aktualisieren
export function applyGuess(game, letter) {
  if (game.status !== GameStatus.IN_PROGRESS) return { game, changed: false };

  const c = (letter || "").toUpperCase();
  if (!/^[A-ZÄÖÜ]$/.test(c) || game.guessed.includes(c)) return { game, changed: false };

  const next = { ...game, guessed: [...game.guessed, c] };
  if (!game.word.includes(c)) next.livesLeft = Math.max(0, game.livesLeft - 1);

  const masked = maskWord(next.word, next.guessed);
  if (!masked.includes("_")) next.status = GameStatus.WON;
  else if (next.livesLeft === 0) next.status = GameStatus.LOST;

  return { game: next, changed: true };
}

// Nur das, was der Client sehen darf
export function publicView(game) {
  return {
    id: game.id,
    maskedWord: maskWord(game.word, game.guessed),
    guessed: game.guessed,
    livesLeft: game.livesLeft,
    status: game.status,
    createdAt: game.createdAt
  };
}
